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
async function getLLMSummary(positive, neutral, negative) {
  try {
    const llmConfig = await getActiveLLMProvider();
    if (!llmConfig) {
      logger.warn('No active LLM provider configured');
      return 'AI summary unavailable: No LLM provider configured. Please set up an API key in the API manager.';
    }
    
    const { provider, apiKey } = llmConfig;
    logger.info(`Using configured provider: ${provider}`);
    logger.info(`Processing ${positive.length} positive, ${neutral.length} neutral, ${negative.length} negative reviews`);
    
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
      "\nYour summary must include:",
      "- An executive summary of overall customer sentiment and how it has changed over time.",
      "- Key positive, negative, and neutral themes, with examples and their posting dates.",
      "- A timeline or commentary on when reputation was best or worst, and possible reasons.",
      "- Actionable, time-sensitive recommendations for the business.\n",
      "\nFormat your response with clear section headers: EXECUTIVE SUMMARY, REPUTATION TIMELINE, POSITIVE THEMES, NEGATIVE THEMES, NEUTRAL THEMES, RECOMMENDATIONS.\n\n",
      "POSITIVE REVIEWS (with dates):\n" + reviewLines(positive).join('\n') + "\n\n",
      "NEUTRAL REVIEWS (with dates):\n" + reviewLines(neutral).join('\n') + "\n\n",
      "NEGATIVE REVIEWS (with dates):\n" + reviewLines(negative).join('\n')
    ].join('');
    
    // Provider-specific configurations
    const config = getProviderConfig(provider, apiKey, prompt);
    
    if (!config) {
      return `AI summary failed: Unsupported provider '${provider}'. Please configure a supported provider in the API manager.`;
    }
    
    logger.info(`Making API request to ${config.endpoint}`);
    const response = await axios.post(config.endpoint, config.data, {
      headers: config.headers,
      timeout: 60000
    });
    
    const summary = extractSummaryFromResponse(provider, response.data);
    logger.info(`Summary generated successfully using ${provider}. Length: ${summary.length} characters`);
    
    return summary;
    
  } catch (error) {
    logger.error('Error generating LLM summary:', error);
    
    let errorDetail = '';
    if (error.response?.data) {
      errorDetail = ` - ${JSON.stringify(error.response.data)}`;
    }
    
    return `AI summary failed: ${error.message}${errorDetail}. Please check your API key configuration in the API manager.`;
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
async function generateLLMResponseForReview(review, companyName, businessType = 'general') {
  try {
    const llmConfig = await getActiveLLMProvider();
    if (!llmConfig) return null;
    const { provider, apiKey } = llmConfig;

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

module.exports.generateLLMResponseForReview = generateLLMResponseForReview;