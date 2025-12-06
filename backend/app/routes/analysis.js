const express = require('express');
const { Op } = require('sequelize');
const { KF_VENDOR, COMPANY_REVIEWS, sequelize } = require('../models');
const { getGoogleReviews } = require('../scrapers/google');
const { analyzeSentiment } = require('../nlp/sentiment');
const { getLLMSummary, generateLLMResponseForReview } = require('../services/llm');
const { analyzeReviewForResponse } = require('../response_generator');
const logger = require('../utils/logger');

const router = express.Router();

/**
 * Get recent reviews for a company
 */
async function getRecentReviews(companyId, days = 2) {
  const daysAgo = new Date();
  daysAgo.setDate(daysAgo.getDate() - days);
  try {
    return await COMPANY_REVIEWS.findAll({
      where: {
        COMPANY_ID: companyId,
        INSERTED_AT: {
          [Op.gte]: daysAgo
        }
      },
      order: [['INSERTED_AT', 'DESC']]
    });
  } catch (err) {
    // If table does not exist or DB error, log and return empty list to avoid 500
    const msg = err?.original?.sqlMessage || err?.message || String(err);
    logger.warn(`getRecentReviews fallback due to DB error: ${msg}`);
    return [];
  }
}

/**
 * Insert a company review
 */
async function insertCompanyReview(reviewData) {
  try {
    return await COMPANY_REVIEWS.create(reviewData);
  } catch (err) {
    const msg = err?.original?.sqlMessage || err?.message || String(err);
    logger.warn(`insertCompanyReview skipped due to DB error: ${msg}`);
    return null;
  }
}

/**
 * Insert notification
 */
async function insertNotification(companyId, notiText, alertType = 'NEGATIVE_REVIEW_ALERT') {
  const { MOB_NOTIFICATIONS } = require('../models');
  
  const priority = alertType.toUpperCase() === 'NEGATIVE' ? 10 : 1;
  try {
    return await MOB_NOTIFICATIONS.create({
      USER_ID: 1,
      NOTI_TEXT: notiText,
      CREATED_AT: new Date(),
      STATUS: 'SUCCESS',
      NOTIFICATION_TYPE: 'REPA',
      NOTIFICATION_PRIORITY: priority,
      COMPANY_ID: companyId,
      ALERT_TYPE: alertType,
      VOICE_FILE_URL: '',
      DESCRIPTION: ''
    });
  } catch (err) {
    const msg = err?.original?.sqlMessage || err?.message || String(err);
    logger.warn(`insertNotification skipped due to DB error: ${msg}`);
    return null;
  }
}

/**
 * Detect business type from company name and description
 */
function detectBusinessType(companyName, companyDescription) {
  const text = `${companyName} ${companyDescription}`.toLowerCase();
  
  const businessTypes = {
    'restaurant': ['restaurant', 'cafe', 'diner', 'bistro', 'eatery', 'food', 'cuisine'],
    'hotel': ['hotel', 'resort', 'inn', 'lodge', 'accommodation'],
    'retail': ['store', 'shop', 'retail', 'boutique', 'market'],
    'healthcare': ['hospital', 'clinic', 'medical', 'doctor', 'dentist', 'health'],
    'automotive': ['auto', 'car', 'vehicle', 'garage', 'mechanic'],
    'service': ['service', 'repair', 'maintenance', 'consulting']
  };
  
  for (const [type, keywords] of Object.entries(businessTypes)) {
    if (keywords.some(keyword => text.includes(keyword))) {
      return type;
    }
  }
  
  return 'general';
}

/**
 * Convert flat recommendations into timeframes for UI
 */
function toTimeframedRecommendations(recommendations = []) {
  const immediate = [];
  const short_term = [];
  const long_term = [];
  recommendations.forEach((rec, idx) => {
    if (idx < 2) immediate.push(rec);
    else if (idx < 4) short_term.push(rec);
    else long_term.push(rec);
  });
  return { immediate, short_term, long_term };
}

/**
 * Enrich a review entry with response suggestions and actions
 */
function enrichReviewWithSuggestions(entry, companyName, companyDescription, businessType) {
  try {
    const analysis = analyzeReviewForResponse(entry, companyName, companyDescription, businessType);
    const suggested = analysis?.response_templates?.[0] || '';
    const actions = toTimeframedRecommendations(analysis?.recommended_actions || []);
    return {
      ...entry,
      priority_level: analysis?.response_priority || 'low',
      identified_issues: analysis?.key_issues || [],
      action_recommendations: actions,
      response_suggestion: { suggested_response: suggested }
    };
  } catch (e) {
    logger.warn('Failed to enrich review with suggestions:', e.message);
    return entry;
  }
}

/**
 * Get platform display name
 */
function getPlatformDisplayName(source) {
  const platformMap = {
    'GOOGLE': 'Google Reviews',
    'YELP': 'Yelp',
    'FACEBOOK': 'Facebook',
    'TRIPADVISOR': 'TripAdvisor'
  };
  
  return platformMap[source] || source;
}

// POST /analyze/google/ - Analyze Google reviews
router.post('/google', async (req, res) => {
  try {
  const { company_id } = req.query;
  const llmPerReview = req.query.llm_review === 'true';
    const forceRefresh = req.query.force_refresh === 'true' || req.body?.force_refresh === true;
    
    if (!company_id) {
      return res.status(400).json({ error: 'company_id is required' });
    }
    
    logger.info(`Looking up company info for company_id=${company_id}`);
    
    // Find company
    const company = await KF_VENDOR.findByPk(company_id);
    if (!company) {
      logger.error(`Company with ID ${company_id} not found in KF_VENDOR`);
      return res.status(404).json({ error: 'Company not found' });
    }
    
    // Get company name
    let companyName = company.VEND_TITL;
    const companyAddress = company.VEND_CON_ADDR;
    
    if (!companyName || companyName.trim() === '') {
      logger.error(`Company with ID ${company_id} has no company title set`);
      companyName = company.COMPANY_NAME || `Company_${company_id}`;
      logger.info(`Using fallback name: ${companyName}`);
    }
    
    logger.info(`Found company: ${companyName}`);
    
    // Detect business type
    const companyDescription = company.VEND_DESC || '';
    const businessType = detectBusinessType(companyName, companyDescription);
    logger.info(`Detected business type: ${businessType}`);
    
    // Check for recent reviews unless force refresh
    logger.info(`Checking for recent reviews within last 2 days... (force_refresh=${forceRefresh})`);
    const recentReviews = forceRefresh ? [] : await getRecentReviews(company_id, 2);
    
    let reviews = [];
    let sentimentCounts = { positive: 0, neutral: 0, negative: 0 };
    let llmSummary = '';
    
    if (recentReviews && recentReviews.length > 0) {
      logger.info(`Found ${recentReviews.length} recent reviews. Using existing data instead of scraping.`);
      
      // Convert existing reviews to expected format
      for (const review of recentReviews) {
        const reviewData = {
          text: review.REVIEW_TEXT,
          sentiment: review.SENTIMENT,
          polarity: review.POLARITY,
          reviewer_name: review.REVIEWER_NAME,
          rating: review.RATING,
          review_date: review.REVIEW_DATE,
          collected_at: review.INSERTED_AT ? review.INSERTED_AT.toISOString() : null,
          platform: getPlatformDisplayName(review.SOURCE),
          source: review.SOURCE
        };
        let enriched = enrichReviewWithSuggestions(reviewData, companyName, companyDescription, businessType);
        if (llmPerReview) {
          const llmResp = await generateLLMResponseForReview(enriched, companyName, businessType);
          if (llmResp) {
            enriched.response_suggestion.llm_generated = llmResp;
            enriched.response_suggestion.source = 'LLM';
          } else {
            enriched.response_suggestion.source = 'TEMPLATE';
          }
        }
        reviews.push(enriched);
        sentimentCounts[review.SENTIMENT]++;
      }
      
      logger.info(`Using ${reviews.length} existing reviews. Sentiment distribution:`, sentimentCounts);
      
      // Generate new LLM summary
      logger.info('Generating LLM summary from existing reviews...');
      const positive = reviews.filter(r => r.sentiment === 'positive');
      const neutral = reviews.filter(r => r.sentiment === 'neutral');
      const negative = reviews.filter(r => r.sentiment === 'negative');
      
      llmSummary = await getLLMSummary(positive, neutral, negative);
      
    } else {
      logger.info('No recent reviews found. Proceeding with scraping...');
      
      if (companyAddress && companyAddress.trim()) {
        logger.info(`Company address: ${companyAddress}`);
        logger.info(`Scraping Google reviews for '${companyName}' at '${companyAddress}'...`);
      } else {
        logger.info(`No address available, scraping for '${companyName}' only...`);
      }
      
      // Check if this company has ANY reviews in the database (determines first scrape vs refresh)
      const existingReviewsCount = await COMPANY_REVIEWS.count({
        where: {
          COMPANY_ID: company_id,
          SOURCE: 'GOOGLE'
        }
      });
      
      // First scrape: get all reviews. Refresh: get top 50 recent reviews
      const maxReviewsLimit = existingReviewsCount === 0 ? 999999 : 50;
      logger.info(existingReviewsCount === 0 
        ? 'First scrape - fetching all reviews' 
        : `Refresh scrape - limiting to ${maxReviewsLimit} most recent reviews`);
      
      // Scrape reviews
      let rawReviews;
      let scrapeError = null;
      let extractedGoogleUrl = null;
      try {
        const scrapeResult = await getGoogleReviews(company, { 
          maxReviews: maxReviewsLimit,
          includeMeta: true 
        });
        
        // Handle new format with URL extraction
        if (scrapeResult && typeof scrapeResult === 'object' && scrapeResult.reviews) {
          rawReviews = scrapeResult.reviews;
          extractedGoogleUrl = scrapeResult.google_url;
        } else {
          rawReviews = scrapeResult || [];
        }
        
        // Update company's Google URL if extracted and company doesn't have one
        if (extractedGoogleUrl && (!company.GOOGLE_RVW_LINK || company.GOOGLE_RVW_LINK === 'Not Available')) {
          logger.info(`Updating company Google URL: ${extractedGoogleUrl}`);
          await KF_VENDOR.update(
            { GOOGLE_RVW_LINK: extractedGoogleUrl },
            { where: { VEND_ID: company_id } }
          );
        }
      } catch (error) {
        logger.error('Scraping failed:', error);
        // Don’t fail the entire request; continue with empty reviews and report the error in metadata
        rawReviews = [];
        scrapeError = error?.message || 'Unknown scraping error';
      }
      
  logger.info(`${rawReviews.length} reviews scraped. Analyzing sentiment...`);
      
      // Process each review
      for (const reviewData of rawReviews) {
        const text = reviewData.text || '';
        const reviewerName = reviewData.reviewer || null;
        const rating = reviewData.rating || null;
        const reviewDate = reviewData.date || null;
        
        if (!text || text.trim() === '') {
          continue; // Skip empty reviews
        }
        
        // Analyze sentiment
        const sentimentResult = analyzeSentiment(text);
        
        let reviewEntry = {
          text,
          sentiment: sentimentResult.sentiment,
          polarity: sentimentResult.polarity,
          reviewer_name: reviewerName,
          rating,
          review_date: reviewDate,
          collected_at: new Date().toISOString(),
          platform: getPlatformDisplayName('GOOGLE'),
          source: 'GOOGLE'
        };
        reviewEntry = enrichReviewWithSuggestions(reviewEntry, companyName, companyDescription, businessType);
        if (llmPerReview) {
          const llmResp = await generateLLMResponseForReview(reviewEntry, companyName, businessType);
          if (llmResp) {
            reviewEntry.response_suggestion.llm_generated = llmResp;
            reviewEntry.response_suggestion.source = 'LLM';
          } else {
            reviewEntry.response_suggestion.source = 'TEMPLATE';
          }
        }
        reviews.push(reviewEntry);
        sentimentCounts[sentimentResult.sentiment]++;
        
        // Insert into database
        try {
          await insertCompanyReview({
            COMPANY_ID: company_id,
            USERID: 1,
            FIRMID: 1,
            REVIEWER_NAME: reviewerName,
            RATING: rating,
            REVIEW_TEXT: text,
            REVIEW_DATE: reviewDate,
            SENTIMENT: sentimentResult.sentiment,
            POLARITY: sentimentResult.polarity,
            SOURCE: 'GOOGLE',
            INSERTED_AT: new Date()
          });
          
          // Insert notification
          await insertNotification(
            company_id,
            `New review inserted with sentiment: ${sentimentResult.sentiment}`,
            sentimentResult.sentiment.toUpperCase()
          );
        } catch (dbError) {
          logger.error('Error inserting review to database:', dbError);
        }
      }
    }
    
    // Fetch ALL reviews from database for this company to include in response and generate summary
    logger.info('Fetching all reviews from database for this company...');
    const allDbReviews = await COMPANY_REVIEWS.findAll({
      where: {
        COMPANY_ID: company_id
      },
      order: [['INSERTED_AT', 'DESC']],
      subQuery: false,
      raw: true
    });
    
    logger.info(`✓ Fetched ${allDbReviews.length} total reviews from database for company ${company_id}`);
    
    // Convert DB reviews to response format
    const allReviews = allDbReviews.map(review => ({
      text: review.REVIEW_TEXT,
      sentiment: review.SENTIMENT,
      polarity: review.POLARITY,
      reviewer_name: review.REVIEWER_NAME,
      rating: review.RATING,
      review_date: review.REVIEW_DATE,
      collected_at: review.INSERTED_AT ? review.INSERTED_AT.toISOString() : null,
      platform: getPlatformDisplayName(review.SOURCE),
      source: review.SOURCE
    }));
    
    logger.info(`Total reviews in database for this company: ${allReviews.length}`);
    
    // Generate LLM summary using ALL reviews from database
    const allPositive = allReviews.filter(r => r.sentiment === 'positive');
    const allNeutral = allReviews.filter(r => r.sentiment === 'neutral');
    const allNegative = allReviews.filter(r => r.sentiment === 'negative');
    
    logger.info('Generating LLM summary from all reviews in database...');
    if (allReviews.length > 0) {
      llmSummary = await getLLMSummary(allPositive, allNeutral, allNegative);
    } else {
      llmSummary = 'No reviews available in database.';
    }
    
    // Calculate sentiment counts from all reviews
    const totalSentimentCounts = {
      positive: allPositive.length,
      neutral: allNeutral.length,
      negative: allNegative.length
    };
    
    // Prepare top reviews from all database reviews
    const topReviews = {
      positive: allPositive.slice(0, 5),
      neutral: allNeutral.slice(0, 5),
      negative: allNegative.slice(0, 5)
    };
    
    const chartData = [
      { sentiment: 'positive', count: totalSentimentCounts.positive },
      { sentiment: 'neutral', count: totalSentimentCounts.neutral },
      { sentiment: 'negative', count: totalSentimentCounts.negative }
    ];
    
    // Calculate metadata - use review_date (when reviews were posted) not collected_at (when scraped)
    const reviewDates = allReviews.map(r => r.review_date).filter(Boolean);
    const earliestCollection = reviewDates.length > 0 ? Math.min(...reviewDates.map(d => new Date(d))) : null;
    const latestCollection = reviewDates.length > 0 ? Math.max(...reviewDates.map(d => new Date(d))) : null;
    
    // Platform breakdown from all reviews
    const platformCounts = {};
    allReviews.forEach(review => {
      const platform = review.platform || 'Unknown';
      platformCounts[platform] = (platformCounts[platform] || 0) + 1;
    });
    
    // Business insights from all reviews
    const negativeReviews = allReviews.filter(r => r.sentiment === 'negative');
    const highPriorityIssues = [];
    const commonNegativeIssues = [];
    
    logger.info('Analysis complete. Returning results.');
    
  res.json({
      company_id: parseInt(company_id),
      company_name: companyName,
      sentiment_counts: totalSentimentCounts, // Use total counts from all DB reviews
      chart_data: chartData,
      top_reviews: topReviews,
      llm_summary: llmSummary,
      reviews: allReviews, // All reviews from database
      newly_scraped_reviews: reviews, // Just the reviews from this scrape
      source: 'google',
      analysis_metadata: {
        analyzed_at: new Date().toISOString(),
        total_reviews: allReviews.length, // Total from database
        newly_scraped_count: reviews.length, // Count from this scrape
        platforms: platformCounts,
        primary_platform: getPlatformDisplayName('GOOGLE'),
  business_type: businessType,
  scrape_error: typeof scrapeError !== 'undefined' ? scrapeError : null,
        collection_period: {
          earliest: earliestCollection ? new Date(earliestCollection).toISOString() : null,
          latest: latestCollection ? new Date(latestCollection).toISOString() : null
        },
        using_cached_data: recentReviews && recentReviews.length > 0,
        business_insights: {
          high_priority_issues: highPriorityIssues,
          common_issues: commonNegativeIssues,
          negative_review_count: negativeReviews.length,
          needs_immediate_attention: highPriorityIssues.length > 0
        }
      }
    });
    
  } catch (error) {
    logger.error('Error in Google analysis endpoint:', error);
    const sqlState = error?.original?.sqlState || error?.parent?.sqlState;
    const sqlMessage = error?.original?.sqlMessage || error?.parent?.sqlMessage || error?.message;
    const code = error?.original?.code || error?.parent?.code;

    // If database table is missing, degrade gracefully instead of 500
    if (code === 'ER_NO_SUCH_TABLE') {
      return res.json({
        company_id: req?.query?.company_id ? parseInt(req.query.company_id) : null,
        company_name: null,
        sentiment_counts: { positive: 0, neutral: 0, negative: 0 },
        chart_data: [
          { sentiment: 'positive', count: 0 },
          { sentiment: 'neutral', count: 0 },
          { sentiment: 'negative', count: 0 }
        ],
        top_reviews: { positive: [], neutral: [], negative: [] },
        llm_summary: 'No reviews available due to missing database tables.',
        reviews: [],
        source: 'google',
        analysis_metadata: {
          analyzed_at: new Date().toISOString(),
          total_reviews: 0,
          platforms: {},
          primary_platform: getPlatformDisplayName('GOOGLE'),
          business_type: 'general',
          collection_period: { earliest: null, latest: null },
          using_cached_data: false,
          business_insights: {
            high_priority_issues: [],
            common_issues: [],
            negative_review_count: 0,
            needs_immediate_attention: false
          },
          db_error: {
            code,
            sqlState,
            message: sqlMessage
          }
        }
      });
    }

    res.status(500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
});

module.exports = router;