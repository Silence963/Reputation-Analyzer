const express = require('express');
const { Op } = require('sequelize');
const { KF_VENDOR, COMPANY_REVIEWS, sequelize } = require('../models');
const { getGoogleReviews, getGoogleTotalReviewCount } = require('../scrapers/google');
const { analyzeSentiment, analyzeSentimentWithLLM } = require('../nlp/sentiment');
const { getLLMSummary, generateLLMResponseForReview, detectBusinessTypeWithLLM } = require('../services/llm');
const { analyzeReviewForResponse } = require('../response_generator');
const logger = require('../utils/logger');

const router = express.Router();

/**
 * SCRAPING BEHAVIOR:
 * - If review_count is a specific number (e.g., 10, 50): Always scrape that exact number of FRESH reviews
 * - If review_count is "all": Scrape only the gap between DB and Google's total available reviews
 * - Summary generation: ALWAYS uses ALL reviews in the database (including newly scraped ones)
 */

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
async function insertNotification(companyId, notiText, alertType = 'NEGATIVE_REVIEW_ALERT', userId = 1, firmId = 1) {
  const { MOB_NOTIFICATIONS } = require('../models');
  
  const priority = alertType.toUpperCase() === 'NEGATIVE' ? 10 : 1;
  try {
    const notification = await MOB_NOTIFICATIONS.create({
      USER_ID: userId,
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
    logger.info(`📬 Alert sent to MOB_NOTIFICATIONS for user_id=${userId}: "${notiText}" (priority=${priority})`);
    return notification;
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
    
    // The suggested response is already personalized with reviewer name in response_generator.js
    const personalizedResponse = suggested;
    
    return {
      ...entry,
      priority_level: analysis?.response_priority || 'low',
      identified_issues: analysis?.key_issues || [],
      action_recommendations: actions,
      response_suggestion: { 
        suggested_response: personalizedResponse,
        custom_reply: '', // User can fill this in
        reply_options: [
          { id: 1, label: 'Use Suggested Response', value: personalizedResponse },
          { id: 2, label: 'Write Custom Reply', value: '' },
          { id: 3, label: 'No Reply Needed', value: null }
        ]
      }
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
    const userId = req.query.userid || req.body?.userid || req.headers['x-user-id'] || 'unknown';
    const firmId = req.query.firmid || req.body?.firmid || req.headers['x-firm-id'] || 'unknown';
    const review_count = req.query.review_count || req.body?.review_count;
    const llmPerReview = req.query.llm_review === 'true';
    const forceRefresh = req.query.force_refresh === 'true' || req.body?.force_refresh === true;
    
    logger.info(`📊 Analysis request: company_id=${company_id}, user_id=${userId}, firm_id=${firmId}, review_count=${review_count}, force_refresh=${forceRefresh}`);
    
    if (!company_id) {
      return res.status(400).json({ error: 'company_id is required' });
    }
    
    logger.info(`Looking up company info for company_id=${company_id}, review_count=${review_count}`);
    
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
    
    // Parse user's requested review count FIRST
    const useAllReviews = review_count === 'all';
    let userRequestedCount = null;
    if (forceRefresh) {
      // Force refresh: always set to 50 reviews
      userRequestedCount = 50;
      logger.info(`🔄 Force refresh enabled - will scrape 50 reviews`);
    } else if (!useAllReviews && review_count) {
      const parsedCount = parseInt(review_count, 10);
      if (!isNaN(parsedCount) && parsedCount > 0) {
        userRequestedCount = parsedCount;
        logger.info(`👤 User ${userId} requested ${userRequestedCount} reviews for analysis`);
      } else {
        logger.warn(`⚠️ Invalid review_count: ${review_count}. Will use default behavior.`);
      }
    } else if (useAllReviews) {
      logger.info(`👤 User ${userId} requested ALL reviews for analysis`);
    }
    
    // Quick check: if user requested specific count, check if we have enough reviews already
    const existingReviewsCountQuick = await COMPANY_REVIEWS.count({
      where: {
        COMPANY_ID: company_id,
        SOURCE: 'GOOGLE'
      }
    });
    
    // Detect business type - try LLM first, fallback to local detection
    const companyDescription = company.VEND_DESC || '';
    let businessType = 'general';
    
    // OPTIMIZATION: Skip LLM business type detection if we have enough cached reviews
    // This saves 30+ seconds when user requests fewer reviews than we have in DB
    if (!forceRefresh && userRequestedCount && existingReviewsCountQuick >= userRequestedCount) {
      logger.info(`⚡ Fast path: Skipping LLM business type detection (have ${existingReviewsCountQuick} reviews, need ${userRequestedCount})`);
      businessType = detectBusinessType(companyName, companyDescription);
      logger.info(`Local detected business type: ${businessType}`);
    } else {
      // Try LLM detection with a few sample reviews for context
      const sampleReviews = await COMPANY_REVIEWS.findAll({
        where: { COMPANY_ID: company_id },
        limit: 5,
        order: [['INSERTED_AT', 'DESC']],
        raw: true
      }).catch(() => []);
      
      logger.info(`🤖 Calling detectBusinessTypeWithLLM for company: ${companyName}...`);
      const llmBusinessType = await detectBusinessTypeWithLLM(companyName, companyDescription, sampleReviews, userId, firmId);
      logger.info(`🤖 detectBusinessTypeWithLLM completed. Result: ${llmBusinessType || 'null'}`);
      if (llmBusinessType) {
        businessType = llmBusinessType;
        logger.info(`✅ LLM detected business type: ${businessType}`);
      } else {
        // Fallback to local detection
        logger.info(`⚠️  LLM detection returned null, using local detection...`);
        businessType = detectBusinessType(companyName, companyDescription);
        logger.info(`Local detected business type: ${businessType}`);
      }
    }
    
    logger.info(`Final business type: ${businessType}`);
    
    let reviews = [];
    let sentimentCounts = { positive: 0, neutral: 0, negative: 0 };
    let llmSummary = '';
    let newReviewsAdded = 0;
    
    // Check current review count in database for this company
    logger.info(`Checking database for existing reviews for company ${company_id}...`);
    const existingReviewsCount = await COMPANY_REVIEWS.count({
      where: {
        COMPANY_ID: company_id,
        SOURCE: 'GOOGLE'
      }
    });
    logger.info(`✓ Database contains ${existingReviewsCount} reviews for this company`);
    
    // Determine if we need to scrape to meet user's requested limit
    let needsScraping = false;
    let targetReviewCount = useAllReviews ? Infinity : (userRequestedCount || existingReviewsCount);
    let googleTotalReviews = null; // Track total reviews available on Google

    // NEW LOGIC: If user requested a specific number (not "all"), always scrape fresh reviews
    if (forceRefresh) {
      logger.info(`🔄 Force refresh enabled - will scrape top 50 reviews for new/updated reviews`);
      needsScraping = true;
      targetReviewCount = 50; // Always scrape top 50 for refresh
    } else if (userRequestedCount && !useAllReviews) {
      logger.info(`🔄 User requested ${userRequestedCount} specific reviews - will scrape fresh data`);
      needsScraping = true;
    } else if (useAllReviews) {
      // For "all" requests, check if we already know the total from Google
      const lastScrapeMetadata = company.LAST_SCRAPE_METADATA;
      if (lastScrapeMetadata) {
        try {
          const metadata = JSON.parse(lastScrapeMetadata);
          googleTotalReviews = metadata.total_reviews_available;
          
          if (googleTotalReviews && existingReviewsCount >= googleTotalReviews) {
            logger.info(`📊 Database has all ${existingReviewsCount} available reviews from Google (total=${googleTotalReviews}). No scraping needed.`);
            needsScraping = false;
          } else if (googleTotalReviews) {
            const reviewsNeeded = googleTotalReviews - existingReviewsCount;
            logger.info(`📊 User requested ALL reviews - database has ${existingReviewsCount}/${googleTotalReviews}. Need ${reviewsNeeded} more reviews.`);
            needsScraping = true;
            targetReviewCount = googleTotalReviews;
          } else {
            logger.info(`📊 User requested ALL reviews - will scrape to fetch everything available`);
            needsScraping = true;
          }
        } catch (e) {
          logger.warn(`Could not parse last scrape metadata: ${e.message}`);
          logger.info(`📊 User requested ALL reviews - will scrape to fetch everything available`);
          needsScraping = true;
        }
      } else {
        logger.info(`📊 User requested ALL reviews (first time) - will scrape to fetch everything available`);
        needsScraping = true;
      }
    } else if (userRequestedCount && existingReviewsCount < userRequestedCount) {
      logger.info(`📊 User requested ${userRequestedCount} reviews but database only has ${existingReviewsCount} - will scrape to fill gap`);
      needsScraping = true;
    } else if (existingReviewsCount === 0) {
      logger.info(`📊 No reviews in database - will scrape initial batch`);
      needsScraping = true;
      targetReviewCount = userRequestedCount || 50; // Default to 50 if no specific count requested
    }

    // Scrape if needed
    logger.info(`🔍 Scraping decision: needsScraping=${needsScraping}`);
    logger.info(`🔍 About to check if statement: needsScraping=${needsScraping}, type=${typeof needsScraping}`);
    if (needsScraping) {
      logger.info(`🚀 Starting scraping process...`);
      logger.info(`⏱️  About to enter scraping logic...`);
      if (companyAddress && companyAddress.trim()) {
        logger.info(`Company address: ${companyAddress}`);
        logger.info(`Scraping Google reviews for '${companyName}' at '${companyAddress}'...`);
      } else {
        logger.info(`No address available, scraping for '${companyName}' only...`);
      }
      
      // For "all reviews" requests: Extract total count FIRST to calculate actual need
      let googleTotalFromScraper = null;
      if (useAllReviews) {
        logger.info(`🔍 Extracting total review count from Google...`);
        const totalCountResult = await getGoogleTotalReviewCount(company);
        if (totalCountResult && totalCountResult.total_reviews_available) {
          googleTotalFromScraper = totalCountResult.total_reviews_available;
          logger.info(`📊 Google has ${googleTotalFromScraper} reviews available`);
          
          // Check if we already have all of them
          if (existingReviewsCount >= googleTotalFromScraper) {
            logger.info(`✅ Database already has all ${existingReviewsCount} reviews (Google total: ${googleTotalFromScraper}). Skipping scrape.`);
            needsScraping = false;
          } else {
            // Calculate exact number needed
            const reviewsNeeded = googleTotalFromScraper - existingReviewsCount;
            logger.info(`📊 Need to scrape ${reviewsNeeded} more reviews (DB: ${existingReviewsCount}, Google: ${googleTotalFromScraper})`);
            targetReviewCount = googleTotalFromScraper;
          }
        }
      }
      
      // Only scrape if still needed
      if (needsScraping) {
        // Calculate how many reviews to scrape to meet target
        let reviewsNeeded;
        if (forceRefresh) {
          // For force refresh, always scrape 50 reviews to catch new/updated ones
          reviewsNeeded = 50;
          logger.info(`📊 Force refresh mode: Scraping top 50 reviews to catch new/updated reviews`);
        } else if (useAllReviews && googleTotalFromScraper) {
          // For "all" requests, only scrape the gap
          reviewsNeeded = Math.max(googleTotalFromScraper - existingReviewsCount, 1);
          logger.info(`📊 Gap-fill mode: Need ${reviewsNeeded} reviews to reach Google total of ${googleTotalFromScraper}`);
        } else if (userRequestedCount && !useAllReviews) {
          // For specific count requests, scrape exactly that number (fresh data)
          reviewsNeeded = userRequestedCount;
          logger.info(`📊 User requested ${userRequestedCount} specific reviews - will scrape exactly ${reviewsNeeded} fresh reviews`);
        } else {
          // Default: scrape the gap
          reviewsNeeded = targetReviewCount - existingReviewsCount;
        }
        const scrapeLimit = forceRefresh ? 50 : Math.max(reviewsNeeded, 1); // Force 50 for refresh, otherwise scrape what's needed
        logger.info(`🎯 Target review count: ${useAllReviews ? 'ALL' : targetReviewCount}, Existing: ${existingReviewsCount}, Will scrape: ${scrapeLimit} reviews`);
        
        // Scrape reviews
        let rawReviews;
        let scrapeError = null;
        let extractedGoogleUrl = null;
        try {
          const scrapeResult = await getGoogleReviews(company, { 
            maxReviews: scrapeLimit,
            includeMeta: true 
          });
          
          // Handle new format with URL extraction and total review count
          let scrapedTotalReviewsAvailable = null;
        if (scrapeResult && typeof scrapeResult === 'object' && scrapeResult.reviews) {
          rawReviews = scrapeResult.reviews;
          extractedGoogleUrl = scrapeResult.google_url;
          scrapedTotalReviewsAvailable = scrapeResult.total_reviews_available;
          if (scrapedTotalReviewsAvailable) {
            logger.info(`✅ Scraper returned total reviews available on Google: ${scrapedTotalReviewsAvailable}`);
            
            // Smart decision: Check if we have all reviews already
            if (useAllReviews && scrapedTotalReviewsAvailable) {
              const reviewsInDb = existingReviewsCount;
              if (reviewsInDb >= scrapedTotalReviewsAvailable) {
                logger.info(`✅ Database already has all ${reviewsInDb} available reviews (Google total: ${scrapedTotalReviewsAvailable}). No need to process newly scraped reviews.`);
                rawReviews = []; // Clear scraped reviews - we don't need them
              } else {
                const reviewsNeeded = scrapedTotalReviewsAvailable - reviewsInDb;
                logger.info(`📊 Database has ${reviewsInDb}/${scrapedTotalReviewsAvailable} reviews. Need ${reviewsNeeded} more. Processing scraped reviews...`);
              }
            }
          }
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
        // Don't fail the entire request; continue with empty reviews and report the error in metadata
        rawReviews = [];
        scrapeError = error?.message || 'Unknown scraping error';
      }
      
      logger.info(`${rawReviews.length} reviews scraped. Analyzing sentiment...`);
      
      // Process each review
      const reviewsToInsert = [];
      let processedCount = 0;
      
      for (const reviewData of rawReviews) {
        const text = reviewData.text || '';
        const reviewerName = reviewData.reviewer || null;
        const rating = reviewData.rating || null;
        const reviewDate = reviewData.date || null;
        
        if (!text || text.trim() === '') {
          continue; // Skip empty reviews
        }
        
        // Analyze sentiment using LLM (considering text, rating, and business type)
        const sentimentResult = await analyzeSentimentWithLLM(text, rating, businessType, userId, firmId);
        logger.debug(`📝 Review sentiment: ${sentimentResult.sentiment} (polarity=${sentimentResult.polarity}, rating=${rating}, confidence=${sentimentResult.confidence})`);
        
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
          const llmResp = await generateLLMResponseForReview(reviewEntry, companyName, businessType, userId, firmId);
          if (llmResp) {
            reviewEntry.response_suggestion.llm_generated = llmResp;
            reviewEntry.response_suggestion.source = 'LLM';
          } else {
            reviewEntry.response_suggestion.source = 'TEMPLATE';
          }
        }
        reviews.push(reviewEntry);
        sentimentCounts[sentimentResult.sentiment]++;
        
        // Prepare for batch insert
        reviewsToInsert.push({
          COMPANY_ID: company_id,
          USERID: userId,
          FIRMID: firmId,
          REVIEWER_NAME: reviewerName,
          RATING: rating,
          REVIEW_TEXT: text,
          REVIEW_DATE: reviewDate,
          SENTIMENT: sentimentResult.sentiment,
          POLARITY: sentimentResult.polarity,
          SOURCE: 'GOOGLE',
          INSERTED_AT: new Date(),
          PRIORITY_LEVEL: reviewEntry.priority_level,
          IDENTIFIED_ISSUES: JSON.stringify(reviewEntry.identified_issues || []),
          ACTION_RECOMMENDATIONS: JSON.stringify(reviewEntry.action_recommendations || []),
          RESPONSE_SUGGESTION: JSON.stringify(reviewEntry.response_suggestion || {})
        });
        
        processedCount++;
        if (processedCount % 50 === 0) {
          logger.info(`📊 Processing reviews: ${processedCount}/${rawReviews.length}`);
        }
      }
      
      // Batch insert all reviews at once
      if (reviewsToInsert.length > 0) {
        try {
          // Check for duplicates before inserting
          logger.info(`🔍 Checking for duplicate reviews for company ${company_id} from user ${userId}...`);
          
          // Get existing review texts for this company
          const existingTexts = await COMPANY_REVIEWS.findAll({
            where: {
              COMPANY_ID: company_id,
              SOURCE: 'GOOGLE'
            },
            attributes: ['REVIEW_TEXT'],
            raw: true
          });
          
          const existingTextSet = new Set(
            existingTexts.map(r => r.REVIEW_TEXT.trim().toLowerCase())
          );
          
          // Filter out duplicates
          const uniqueReviews = reviewsToInsert.filter(review => {
            const reviewTextLower = review.REVIEW_TEXT.trim().toLowerCase();
            return !existingTextSet.has(reviewTextLower);
          });
          
          const duplicatesFound = reviewsToInsert.length - uniqueReviews.length;
          if (duplicatesFound > 0) {
            logger.info(`⚠️  Found ${duplicatesFound} duplicate reviews. Skipping duplicates.`);
          }
          
          if (uniqueReviews.length === 0) {
            logger.info(`✅ All ${reviewsToInsert.length} reviews are duplicates. No new reviews to insert.`);
          } else {
            logger.info(`💾 Batch inserting ${uniqueReviews.length} unique reviews into database (skipped ${duplicatesFound} duplicates)...`);
            await COMPANY_REVIEWS.bulkCreate(uniqueReviews, { individualHooks: false });
            logger.info(`✅ Batch insert completed for ${uniqueReviews.length} reviews`);
            
            // Update company with metadata about scrape
            const totalReviewsInDb = existingReviewsCount + uniqueReviews.length;
            const scrapeMetadata = {
              total_reviews_available: scrapedTotalReviewsAvailable || rawReviews.length || totalReviewsInDb,
              last_scrape_date: new Date().toISOString(),
              user_id: userId,
              firm_id: firmId,
              duplicates_skipped: duplicatesFound
            };
            
            await KF_VENDOR.update(
              { LAST_SCRAPE_METADATA: JSON.stringify(scrapeMetadata) },
              { where: { VEND_ID: company_id } }
            );
            logger.info(`📝 Stored scrape metadata: total_reviews_available=${scrapeMetadata.total_reviews_available}, duplicates_skipped=${duplicatesFound}`);
            
            // Send summary notification for batch
            await insertNotification(
              company_id,
              `Batch: ${uniqueReviews.length} unique reviews inserted, ${duplicatesFound} duplicates skipped (${sentimentCounts.positive} positive, ${sentimentCounts.neutral} neutral, ${sentimentCounts.negative} negative)`,
              'BATCH_INSERT',
              userId,
              firmId
            );
          }
          
          newReviewsAdded = uniqueReviews.length;
        } catch (dbError) {
          logger.error('Error in batch insert reviews to database:', dbError);
        }
      }
      newReviewsAdded = reviewsToInsert.length;
      logger.info(`✅ Scraped and added ${newReviewsAdded} new reviews to database`);
    } else {
      logger.info(`⏭️  Skipping scraping block (needsScraping=false)`);
      logger.info(`✓ Database has sufficient reviews (${existingReviewsCount} >= ${targetReviewCount || 'all'}). No scraping needed.`);
    }
    
    logger.info(`✅ Scraping phase completed. Moving to database fetch...`);
    
    logger.info(`📥 Starting database fetch phase...`);
    logger.info(`📊 Fetch parameters: useAllReviews=${useAllReviews}, userRequestedCount=${userRequestedCount}, existingReviewsCount=${existingReviewsCount}`);
    
    // Fetch reviews from database - separate logic for ALL vs SPECIFIC count
    let allDbReviews;
    
    if (useAllReviews) {
      // Path 1: User requested ALL reviews - fetch everything
      logger.info(`📥 PATH 1: Fetching ALL reviews from database for company ${company_id}...`);
      try {
        logger.info(`🔍 Executing COMPANY_REVIEWS.findAll query (no limit)...`);
        allDbReviews = await COMPANY_REVIEWS.findAll({
          where: {
            COMPANY_ID: company_id,
            SOURCE: 'GOOGLE'
          },
          order: [['INSERTED_AT', 'DESC']],
          subQuery: false,
          raw: true
          // NO LIMIT - fetch all available reviews
        });
        logger.info(`✅ Fetched ${allDbReviews.length} reviews (requested: ALL)`);
      } catch (error) {
        logger.error(`❌ Error fetching ALL reviews: ${error.message}`);
        throw error;
      }
    } else if (userRequestedCount && userRequestedCount > 0 && userRequestedCount < existingReviewsCount) {
      // Path 2A: User requested SPECIFIC count that is LESS than DB available
      // In this case, return ALL available reviews instead
      logger.info(`📥 PATH 2A: User requested ${userRequestedCount} reviews but DB has ${existingReviewsCount} available`);
      logger.info(`📥 Fetching ALL ${existingReviewsCount} reviews from database for comprehensive analysis...`);
      try {
        logger.info(`🔍 Executing COMPANY_REVIEWS.findAll query (no limit - returning all)...`);
        allDbReviews = await COMPANY_REVIEWS.findAll({
          where: {
            COMPANY_ID: company_id,
            SOURCE: 'GOOGLE'
          },
          order: [['INSERTED_AT', 'DESC']],
          subQuery: false,
          raw: true
          // NO LIMIT - fetch all available since request was less than available
        });
        logger.info(`✅ Fetched all ${allDbReviews.length} available reviews (user requested: ${userRequestedCount}, returning all for better summary)`);
      } catch (error) {
        logger.error(`❌ Error fetching all reviews: ${error.message}`);
        throw error;
      }
    } else if (userRequestedCount && userRequestedCount > 0) {
      // Path 2B: User requested SPECIFIC count that is >= DB available
      // Fetch what was requested (which is all or more than available)
      logger.info(`📥 PATH 2B: Fetching ${userRequestedCount} reviews from database for company ${company_id}...`);
      try {
        logger.info(`🔍 Executing COMPANY_REVIEWS.findAll query (limit: ${userRequestedCount})...`);
        allDbReviews = await COMPANY_REVIEWS.findAll({
          where: {
            COMPANY_ID: company_id,
            SOURCE: 'GOOGLE'
          },
          order: [['INSERTED_AT', 'DESC']],
          limit: userRequestedCount,
          subQuery: false,
          raw: true
        });
        logger.info(`✅ Fetched ${allDbReviews.length} reviews (requested: ${userRequestedCount})`);
      } catch (error) {
        logger.error(`❌ Error fetching ${userRequestedCount} reviews: ${error.message}`);
        throw error;
      }
    } else {
      // Path 3: Default - fetch all available reviews
      logger.info(`📥 PATH 3: Fetching all available reviews from database for company ${company_id} (no specific limit)...`);
      try {
        logger.info(`🔍 Executing COMPANY_REVIEWS.findAll query (default - no limit)...`);
        allDbReviews = await COMPANY_REVIEWS.findAll({
          where: {
            COMPANY_ID: company_id,
            SOURCE: 'GOOGLE'
          },
          order: [['INSERTED_AT', 'DESC']],
          subQuery: false,
          raw: true
        });
        logger.info(`✅ Fetched ${allDbReviews.length} reviews (no limit specified)`);
      } catch (error) {
        logger.error(`❌ Error fetching reviews: ${error.message}`);
        throw error;
      }
    }
    
    logger.info(`✅ Database query completed. Retrieved ${allDbReviews.length} reviews`);
    logger.info(`🔄 Converting DB reviews to response format and enriching with suggestions...`);
    
    // Convert DB reviews to response format and enrich with suggestions
    const allReviews = allDbReviews.map(review => {
      const reviewEntry = {
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
      
      // Enrich each review with response suggestions and action recommendations
      return enrichReviewWithSuggestions(reviewEntry, companyName, companyDescription, businessType);
    });
    
    logger.info(`✅ Final review count for user ${userId}: ${allReviews.length} reviews`);
    logger.info(`🤖 Preparing LLM summary phase...`);
    
    // Prepare reviews for LLM summary - use what was fetched
    const reviewsForSummary = allReviews;
    if (useAllReviews) {
      logger.info(`📊 Using all ${reviewsForSummary.length} reviews for LLM summary (user requested: ALL)`);
    } else if (userRequestedCount && userRequestedCount > 0) {
      logger.info(`📊 Using ${reviewsForSummary.length} reviews for LLM summary (user requested: ${userRequestedCount})`);
    } else {
      logger.info(`📊 Using ${reviewsForSummary.length} reviews for LLM summary (default: all available)`);
    }
    
    const allPositive = reviewsForSummary.filter(r => r.sentiment === 'positive');
    const allNeutral = reviewsForSummary.filter(r => r.sentiment === 'neutral');
    const allNegative = reviewsForSummary.filter(r => r.sentiment === 'negative');
    
    logger.info(`Review sentiment breakdown for user ${userId}: ${allPositive.length} positive, ${allNeutral.length} neutral, ${allNegative.length} negative`);
    logger.info(`🤖 Calling getLLMSummary with ${reviewsForSummary.length} reviews...`);
    if (reviewsForSummary.length > 0) {
      llmSummary = await getLLMSummary(allPositive, allNeutral, allNegative, userId, firmId);
      logger.info(`✅ LLM summary generated (length: ${llmSummary.length} chars)`);
      
      logger.info(`📬 Sending LLM summary notification...`);
      // Send LLM summary as notification to MOB_NOTIFICATIONS
      const summaryPreview = llmSummary.substring(0, 255); // Store first 255 chars as preview
      await insertNotification(
        company_id,
        `LLM Analysis Summary: ${summaryPreview}${llmSummary.length > 255 ? '...' : ''}`,
        'LLM_SUMMARY',
        userId,
        firmId
      );
    } else {
      llmSummary = 'No reviews available in database.';
      logger.info(`⚠️  No reviews available for LLM summary`);
    }
    
    logger.info(`📊 Calculating final statistics and preparing response...`);
    
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
    
    logger.info(`📦 Building final response object...`);
    logger.info(`✅ Analysis complete. Returning results to client.`);
    logger.info(`✅ Report generated for user_id=${userId}, firm_id=${firmId}, company_id=${company_id}`);
    
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
        user_id: userId,
        firm_id: firmId,
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
        using_cached_data: !needsScraping,
        business_insights: {
          high_priority_issues: highPriorityIssues,
          common_issues: commonNegativeIssues,
          negative_review_count: negativeReviews.length,
          needs_immediate_attention: highPriorityIssues.length > 0
        }
      }
    });

  }} catch (error) {
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
      message: 'An unexpected error occurred while processing your request. Please try again. If the issue persists, please contact support.'
    });
  }
});

module.exports = router;