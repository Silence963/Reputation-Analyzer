/**
 * Response generator and business analysis utilities
 */

const logger = require('./utils/logger');

/**
 * Analyze review for response generation
 * @param {Object} reviewData - Review data object
 * @param {string} companyName - Company name
 * @param {string} companyDescription - Company description
 * @param {string} businessType - Detected business type
 * @returns {Object} - Analysis with response suggestions
 */
function analyzeReviewForResponse(reviewData, companyName, companyDescription, businessType) {
  const analysis = {
    response_priority: 'low',
    suggested_response_tone: 'professional',
    key_issues: [],
    recommended_actions: [],
    response_urgency: 'normal'
  };
  
  try {
    const text = reviewData.text.toLowerCase();
    const sentiment = reviewData.sentiment;
    const rating = reviewData.rating;
    
    // Determine response priority based on sentiment and rating
    if (sentiment === 'negative' || (rating && rating <= 2)) {
      analysis.response_priority = 'high';
      analysis.response_urgency = 'urgent';
      analysis.suggested_response_tone = 'empathetic';
    } else if (sentiment === 'positive' && rating && rating >= 4) {
      analysis.response_priority = 'medium';
      analysis.suggested_response_tone = 'grateful';
    }
    
    // Identify key issues based on common complaint patterns
    const issuePatterns = {
      'service_quality': ['service', 'staff', 'rude', 'slow', 'unhelpful', 'unprofessional'],
      'product_quality': ['quality', 'broken', 'defective', 'poor', 'cheap', 'terrible'],
      'cleanliness': ['dirty', 'clean', 'hygiene', 'mess', 'filthy', 'sanitary'],
      'wait_time': ['wait', 'long', 'delay', 'slow', 'quick', 'fast', 'time'],
      'price_value': ['expensive', 'price', 'cost', 'value', 'money', 'overpriced', 'cheap'],
      'location_access': ['location', 'parking', 'access', 'hard to find', 'convenient']
    };
    
    for (const [issue, keywords] of Object.entries(issuePatterns)) {
      if (keywords.some(keyword => text.includes(keyword))) {
        analysis.key_issues.push(issue);
      }
    }
    
    // Generate business-type specific recommendations
    analysis.recommended_actions = generateBusinessRecommendations(
      sentiment, 
      analysis.key_issues, 
      businessType
    );
    
    // Add response template suggestions
    analysis.response_templates = generateResponseTemplates(
      sentiment,
      analysis.suggested_response_tone,
      companyName,
      businessType,
      analysis.key_issues,
      reviewData.rating,
      reviewData.reviewer_name || reviewData.reviewer || ''
    );
    
  } catch (error) {
    logger.error('Error analyzing review for response:', error);
  }
  
  return analysis;
}

/**
 * Generate business-specific recommendations
 */
function generateBusinessRecommendations(sentiment, issues, businessType) {
  const recommendations = [];
  
  if (sentiment === 'negative') {
    // Generic negative feedback actions
    recommendations.push('Reach out to customer privately to resolve issue');
    recommendations.push('Investigate the specific complaint internally');
    
    // Business-type specific recommendations
    switch (businessType) {
      case 'restaurant':
        if (issues.includes('service_quality')) {
          recommendations.push('Review staff training protocols');
          recommendations.push('Consider mystery shopper program');
        }
        if (issues.includes('product_quality')) {
          recommendations.push('Review food quality standards');
          recommendations.push('Check supplier quality');
        }
        break;
        
      case 'hotel':
        if (issues.includes('cleanliness')) {
          recommendations.push('Audit housekeeping procedures');
          recommendations.push('Increase cleaning frequency');
        }
        if (issues.includes('service_quality')) {
          recommendations.push('Enhance front desk training');
        }
        break;
        
      case 'retail':
        if (issues.includes('service_quality')) {
          recommendations.push('Improve customer service training');
          recommendations.push('Review return/exchange policies');
        }
        break;
    }
  } else if (sentiment === 'positive') {
    recommendations.push('Thank the customer publicly');
    recommendations.push('Share positive feedback with team');
    recommendations.push('Encourage customer to leave reviews on other platforms');
  }
  
  return recommendations;
}

/**
 * Generate response templates
 */
function generateResponseTemplates(sentiment, tone, companyName, businessType = 'general', issues = [], rating = null, reviewerName = '') {
  const templates = [];
  const nameGreeting = reviewerName && reviewerName.trim() ? `Hi ${reviewerName},\n\n` : 'Hello,\n\n';
  
  if (sentiment === 'negative') {
    const issueHint = issues.length ? ` We understand your concern regarding ${issues[0].replace('_', ' ')} and will address this with our team immediately.` : '';
    const baseApology = `Thank you for taking the time to share your feedback. We sincerely apologize that your experience with ${companyName} did not meet your expectations.`;
    const closing = `Please contact us at [contact info] so we can look into this further and make it right.`;
    const sectorTouch = businessType === 'restaurant' ? ` We aim to consistently deliver great service and food quality.`
      : businessType === 'hotel' ? ` Your comfort and experience are very important to us.`
      : businessType === 'retail' ? ` We strive to ensure our customers receive great value and service.`
      : ` We take all feedback seriously and are committed to improving.`;
    templates.push(`${nameGreeting}${baseApology}${issueHint}${sectorTouch} ${closing}`);
  } else if (sentiment === 'positive') {
    const starMention = rating ? ` Your ${rating}-star rating means a lot to us.` : '';
    const sectorTouch = businessType === 'restaurant' ? ` We're glad you enjoyed the experience—our team works hard to deliver great taste and service.`
      : businessType === 'hotel' ? ` We’re delighted you had a comfortable stay—our team truly appreciates it.`
      : businessType === 'retail' ? ` We’re happy you found what you needed—thank you for choosing us.`
      : ` We truly appreciate your support.`;
    templates.push(`${nameGreeting}Thank you so much for your wonderful review!${starMention} ${sectorTouch} We look forward to welcoming you again soon.`);
  } else {
    const sectorTouch = businessType === 'restaurant' ? ` We value your thoughts as we aim for consistent quality and service.`
      : businessType === 'hotel' ? ` Your comfort matters to us—thanks for sharing your thoughts.`
      : businessType === 'retail' ? ` Your input helps us improve our product selection and service.`
      : ` Your input helps us improve.`;
    templates.push(`${nameGreeting}Thank you for your feedback about ${companyName}.${sectorTouch} If you have any additional comments or suggestions, please feel free to reach out to us.`);
  }
  
  return templates;
}

/**
 * Detect business type from company name and description
 * @param {string} companyName - Company name
 * @param {string} companyDescription - Company description
 * @returns {string} - Detected business type
 */
function detectBusinessType(companyName, companyDescription) {
  const text = `${companyName} ${companyDescription}`.toLowerCase();
  
  const businessTypes = {
    'restaurant': ['restaurant', 'cafe', 'diner', 'bistro', 'eatery', 'food', 'cuisine', 'pizza', 'burger', 'sushi'],
    'hotel': ['hotel', 'resort', 'inn', 'lodge', 'accommodation', 'motel', 'bed and breakfast'],
    'retail': ['store', 'shop', 'retail', 'boutique', 'market', 'mall', 'outlet', 'clothing'],
    'healthcare': ['hospital', 'clinic', 'medical', 'doctor', 'dentist', 'health', 'pharmacy'],
    'automotive': ['auto', 'car', 'vehicle', 'garage', 'mechanic', 'dealer', 'repair'],
    'service': ['service', 'repair', 'maintenance', 'consulting', 'salon', 'spa'],
    'entertainment': ['theater', 'cinema', 'club', 'bar', 'entertainment', 'venue'],
    'education': ['school', 'university', 'college', 'academy', 'training', 'education']
  };
  
  for (const [type, keywords] of Object.entries(businessTypes)) {
    if (keywords.some(keyword => text.includes(keyword))) {
      return type;
    }
  }
  
  return 'general';
}

module.exports = {
  analyzeReviewForResponse,
  detectBusinessType,
  generateBusinessRecommendations,
  generateResponseTemplates
};