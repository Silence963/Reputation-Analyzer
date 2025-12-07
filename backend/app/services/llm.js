const axios = require('axios');
const { LLM_DETAILS } = require('../models');
const logger = require('../utils/logger');

/**
 * Get active LLM provider configuration
 */
async function getActiveLLMProvider(userId = 1481, firmId = 2) {
  try {
    logger.debug(`Looking for active LLM provider for user_id=${userId}, firm_id=${firmId}`);
    
    // First, let's check all providers for this user/firm
    const allProviders = await LLM_DETAILS.findAll({
      where: {
        USERID: userId,
        FIRMID: firmId
      }
    });
    
    logger.debug(`Found ${allProviders.length} total providers for user ${userId}, firm ${firmId}`);
    allProviders.forEach(provider => {
      logger.debug(`Provider: ${provider.LLM_PROVIDER}, Type: ${provider.LLM_PROVIDER_TYPE}, Status: ${provider.STATUS}`);
    });
    
    // Look for active TEXT-TO-TEXT provider
    const activeProvider = await LLM_DETAILS.findOne({
      where: {
        USERID: userId,
        FIRMID: firmId,
        LLM_PROVIDER_TYPE: 'TEXT-TO-TEXT',
        STATUS: 'ACTIVE'
      }
    });
    
    if (activeProvider) {
      logger.debug(`Found active TEXT-TO-TEXT provider: ${activeProvider.LLM_PROVIDER}`);
      return {
        provider: activeProvider.LLM_PROVIDER,
        apiKey: activeProvider.API_KEY
      };
    } else {
      logger.debug('No active TEXT-TO-TEXT provider found');
      return null;
    }
    
  } catch (error) {
    logger.error('Error getting active LLM provider:', error);
    return null;
  }
}

/**
 * Generate LLM summary using the active provider
 */
async function getLLMSummary(positive, neutral, negative, userId = 1481, firmId = 2) {
  try {
    logger.info(`🔐 Validating API key ownership for user_id=${userId}, firm_id=${firmId}`);
    const llmConfig = await getActiveLLMProvider(userId, firmId);
    if (!llmConfig) {
      logger.warn(`🤖 ❌ No active LLM provider found for user_id=${userId}, firm_id=${firmId}`);
      return 'AI summary unavailable: No LLM provider configured. Please set up an API key in the API manager.';
    }
    
    const { provider, apiKey } = llmConfig;
    logger.info(`🤖 ✅ Using LLM provider: ${provider} (owned by user_id=${userId}, firm_id=${firmId})`);
    logger.info(`Processing ${positive.length} positive, ${neutral.length} neutral, ${negative.length} negative reviews with ${provider}`);
    logger.debug(`API key (masked): ${apiKey.substring(0, 5)}...${apiKey.substring(apiKey.length - 5)}`);

    
    // Format reviews with dates
    function reviewLines(reviews) {
      return reviews.slice(0, 10).map(r => {
        const date = r.review_date || r.date || 'Unknown date';
        const text = r.text || '';
        return `[${date}] ${text}`;
      });
    }
    
    const prompt = [
      "You are a world-class reputation strategist and business analyst with years of experience in brand management and crisis response.",
      "Given the following customer reviews (with their posting dates), analyze the company's reputation trends over time.",
      "Identify periods of improvement or decline, and provide actionable, time-aware recommendations.\n",
      "\nYour response must include these EXACT sections with clear formatting:\n",
      "## EXECUTIVE SUMMARY",
      "- Overall sentiment score (1-10)",
      "- Key finding about business reputation",
      "- One sentence describing the most urgent issue\n",
      "## REPUTATION TIMELINE",
      "- When reputation was best/worst with specific dates",
      "- Trends observed (improving, declining, stable)",
      "- Possible causes based on review dates\n",
      "## POSITIVE THEMES",
      "- List top 3-5 positive themes with specific examples and dates",
      "- What customers love about the business\n",
      "## NEGATIVE THEMES",
      "- List top 3-5 negative themes with specific examples and dates",
      "- What causes customer dissatisfaction\n",
      "## NEUTRAL THEMES",
      "- Feedback that was neither clearly positive nor negative\n",
      "## ACTION PLAN: OVERCOME NEGATIVE REVIEWS",
      "For each major negative theme, provide:",
      "1. Root cause analysis",
      "2. Specific actionable steps (1-3 months implementation)",
      "3. Expected impact",
      "4. Who should own this (staff, management, operations)\n",
      "## PERFORMANCE IMPROVEMENT STRATEGY",
      "- 30-day quick wins to boost reputation",
      "- 90-day strategic improvements",
      "- Long-term initiatives (6+ months)",
      "- Key metrics to track success\n",
      "## RECOMMENDATIONS FOR STAFF & MANAGEMENT",
      "- Training focus areas",
      "- Process improvements needed",
      "- Communication improvements\n\n",
      "POSITIVE REVIEWS (with dates):\n" + reviewLines(positive).join('\n') + "\n\n",
      "NEUTRAL REVIEWS (with dates):\n" + reviewLines(neutral).join('\n') + "\n\n",
      "NEGATIVE REVIEWS (with dates):\n" + reviewLines(negative).join('\n')
    ].join('');
    
    
    // Provider-specific configurations
    const config = getProviderConfig(provider, apiKey, prompt);
    
    if (!config) {
      return `AI summary failed: Unsupported provider '${provider}'. Please configure a supported provider in the API manager.`;
    }
    
    logger.info(`Making API request to ${config.endpoint} using ${provider}`);
    const response = await axios.post(config.endpoint, config.data, {
      headers: config.headers,
      timeout: 60000
    });
    
    const summary = extractSummaryFromResponse(provider, response.data);
    logger.info(`✅ LLM summary generated successfully using ${provider}. Length: ${summary.length} characters`);
    
    return summary;
    
  } catch (error) {
    logger.error('Error generating LLM summary:', error);
    
    // Parse error type for user-friendly messaging
    let userMessage = '';
    
    if (error.response?.status === 429) {
      userMessage = 'The AI service is currently experiencing high demand (rate limit exceeded). Please try again in a few moments, or upgrade your AI provider plan for higher limits.';
    } else if (error.response?.status === 401 || error.response?.status === 403) {
      userMessage = 'Your AI provider authentication failed. Please verify your API key in the AI Settings and try again.';
    } else if (error.response?.status >= 500) {
      userMessage = 'The AI service is temporarily unavailable. Please try again in a few moments.';
    } else if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT') {
      userMessage = 'The AI service request timed out. The service may be slow or unavailable. Please try again.';
    } else if (error.message?.includes('ERR_INVALID_ARG_TYPE')) {
      userMessage = 'Configuration error with the AI provider. Please check your API key and provider settings.';
    } else {
      userMessage = 'We encountered an issue while generating the summary. Please try again, and if the problem persists, verify your AI Settings.';
    }
    
    return userMessage;
  }
}

/**
 * Get provider-specific configuration
 */
function getProviderConfig(provider, apiKey, prompt) {
  const baseHeaders = { "Content-Type": "application/json" };
  
  switch (provider) {
    case "GROQ":
      return {
        endpoint: "https://api.groq.com/openai/v1/chat/completions",
        headers: { ...baseHeaders, "Authorization": `Bearer ${apiKey}` },
        data: {
          model: "llama-3.1-8b-instant",
          messages: [
            { role: "system", content: "You are a helpful assistant that summarizes customer reviews for business reputation analysis." },
            { role: "user", content: prompt }
          ],
          max_tokens: 512,
          temperature: 0.7
        }
      };
      
    case "OPENROUTER":
      return {
        endpoint: "https://openrouter.ai/api/v1/chat/completions",
        headers: { ...baseHeaders, "Authorization": `Bearer ${apiKey}` },
        data: {
          model: "meta-llama/llama-3.1-8b-instruct:free",
          messages: [
            { role: "system", content: "You are a helpful assistant that summarizes customer reviews for business reputation analysis." },
            { role: "user", content: prompt }
          ],
          max_tokens: 512,
          temperature: 0.7
        }
      };
      
    case "DEEPSEEK":
      return {
        endpoint: "https://api.deepseek.com/chat/completions",
        headers: { ...baseHeaders, "Authorization": `Bearer ${apiKey}` },
        data: {
          model: "deepseek-chat",
          messages: [
            { role: "system", content: "You are a helpful assistant that summarizes customer reviews for business reputation analysis." },
            { role: "user", content: prompt }
          ],
          max_tokens: 512,
          temperature: 0.7
        }
      };
      
    case "OPENAI_GPT4":
      return {
        endpoint: "https://api.openai.com/v1/chat/completions",
        headers: { ...baseHeaders, "Authorization": `Bearer ${apiKey}` },
        data: {
          model: "gpt-4o-mini",
          messages: [
            { role: "system", content: "You are a helpful assistant that summarizes customer reviews for business reputation analysis." },
            { role: "user", content: prompt }
          ],
          max_tokens: 512,
          temperature: 0.7
        }
      };
      
    case "GEMINI":
      return {
        endpoint: "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent",
        headers: { ...baseHeaders, "x-goog-api-key": apiKey },
        data: {
          contents: [{
            parts: [{
              text: `You are a helpful assistant that summarizes customer reviews for business reputation analysis.\n\n${prompt}`
            }]
          }],
          generationConfig: {
            maxOutputTokens: 512,
            temperature: 0.7
          }
        }
      };
      
    // Add more providers as needed
    default:
      return null;
  }
}

/**
 * Extract summary from provider-specific response format
 */
function extractSummaryFromResponse(provider, responseData) {
  switch (provider) {
    case "GEMINI":
      return responseData.candidates?.[0]?.content?.parts?.[0]?.text || 'No summary generated';
      
    case "GROQ":
    case "OPENROUTER":
    case "DEEPSEEK":
    case "OPENAI_GPT4":
      return responseData.choices?.[0]?.message?.content || 'No summary generated';
      
    default:
      return responseData.choices?.[0]?.message?.content || 'No summary generated';
  }
}

module.exports = {
  getActiveLLMProvider,
  getLLMSummary
};

/**
 * Generate a tailored response for a single review using the active LLM provider.
 * Falls back to null if no provider configured or on error.
 */
async function generateLLMResponseForReview(review, companyName, businessType = 'general', userId = 1481, firmId = 2) {
  try {
    logger.debug(`🔐 Validating API key ownership for per-review LLM (user_id=${userId}, firm_id=${firmId})`);
    const llmConfig = await getActiveLLMProvider(userId, firmId);
    if (!llmConfig) {
      logger.debug(`No API key allocated for user_id=${userId}, firm_id=${firmId} - skipping per-review generation`);
      return null;
    }
    const { provider, apiKey } = llmConfig;
    logger.debug(`Using allocated ${provider} API key for user_id=${userId}, firm_id=${firmId}`);

    const tone = review.sentiment === 'negative' ? 'empathetic and solution-oriented'
      : review.sentiment === 'positive' ? 'warm and grateful'
      : 'professional and constructive';

    const prompt = [
      `You are a customer relations expert for a ${businessType} business named "${companyName}".`,
      `Write a concise, ${tone} public reply to the review below.`,
      `Guidelines:`,
      `- Acknowledge specifics from the review.`,
      `- If negative, apologize briefly without admitting legal liability; invite the reviewer to continue via private contact.`,
      `- If positive, thank the reviewer and reinforce what went well.`,
      `- Keep it within 80-120 words.`,
      `- Do NOT include placeholders like [contact info]; use "our team" generically.`,
      `- Avoid promises of compensation.`,
      `Review context:`,
      `- Sentiment: ${review.sentiment}`,
      review.rating ? `- Rating: ${review.rating}` : '',
      review.review_date ? `- Posted: ${review.review_date}` : '',
      review.platform ? `- Platform: ${review.platform}` : '',
      `- Text: ${review.text}`
    ].filter(Boolean).join('\n');

    const config = getProviderConfig(provider, apiKey, prompt);
    if (!config) return null;

    const response = await axios.post(config.endpoint, config.data, {
      headers: config.headers,
      timeout: 45000
    });
    const content = extractSummaryFromResponse(provider, response.data);
    return (content || '').trim();
  } catch (e) {
    logger.warn('LLM per-review response generation failed:', e.message);
    return null;
  }
}

/**
 * Detect business type using LLM by analyzing company details and reviews
 */
async function detectBusinessTypeWithLLM(companyName, companyDescription, sampleReviews = [], userId = 1481, firmId = 2) {
  try {
    logger.info(`🔍 Using LLM to detect business type for: ${companyName}`);
    
    const llmConfig = await getActiveLLMProvider(userId, firmId);
    if (!llmConfig) {
      logger.warn(`LLM business type detection unavailable - no LLM provider found`);
      return null;
    }

    const { provider, apiKey } = llmConfig;
    
    // Build prompt with company info and sample reviews
    const reviewSamples = sampleReviews
      .slice(0, 5)
      .map(r => r.text || r.REVIEW_TEXT || '')
      .join('\n- ');
    
    const prompt = `Analyze the following business information and determine the EXACT business type. Respond with ONLY the category name, nothing else.

Company Name: ${companyName}
Description: ${companyDescription || 'Not provided'}

Sample Customer Reviews:
- ${reviewSamples || 'No reviews available'}

Business Categories: restaurant, cafe, bar, hotel, motel, retail, clothing_store, grocery, gym, fitness, healthcare, hospital, clinic, dental, automotive, mechanic, repair_shop, salon, spa, entertainment, theater, cinema, education, school, service, delivery, transportation, cafe_restaurant, sports_facility, beauty, or other

Respond with ONLY the category name.`;

    const config = getProviderConfig(provider, apiKey, prompt);
    if (!config) return null;

    const response = await axios.post(config.endpoint, config.data, {
      headers: config.headers,
      timeout: 30000
    });
    
    const businessType = extractSummaryFromResponse(provider, response.data)
      .trim()
      .toLowerCase()
      .replace(/[^a-z_]/g, '');
    
    logger.info(`✅ LLM detected business type: ${businessType}`);
    return businessType || null;
    
  } catch (error) {
    logger.warn('LLM business type detection failed:', error.message);
    return null;
  }
}

module.exports.generateLLMResponseForReview = generateLLMResponseForReview;
module.exports.detectBusinessTypeWithLLM = detectBusinessTypeWithLLM;