const axios = require('axios');
const logger = require('../utils/logger');

// Cache for LLM sentiment results to avoid redundant API calls
const sentimentCache = new Map();
const CACHE_MAX_SIZE = 1000;

/**
 * Get active LLM provider configuration
 */
async function getActiveLLMProvider(userId = 1481, firmId = 2) {
  try {
    const { LLM_DETAILS } = require('../models');
    
    const activeProvider = await LLM_DETAILS.findOne({
      where: {
        USERID: userId,
        FIRMID: firmId,
        LLM_PROVIDER_TYPE: 'TEXT-TO-TEXT',
        STATUS: 'ACTIVE'
      }
    });
    
    if (activeProvider) {
      return {
        provider: activeProvider.LLM_PROVIDER,
        apiKey: activeProvider.API_KEY
      };
    }
    return null;
  } catch (error) {
    logger.error('Error getting active LLM provider:', error);
    return null;
  }
}

/**
 * Get provider-specific configuration for sentiment analysis
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
            { role: "system", content: "You are a sentiment analysis expert. Respond ONLY with a JSON object." },
            { role: "user", content: prompt }
          ],
          max_tokens: 100,
          temperature: 0.3
        }
      };
      
    case "OPENROUTER":
      return {
        endpoint: "https://openrouter.ai/api/v1/chat/completions",
        headers: { ...baseHeaders, "Authorization": `Bearer ${apiKey}` },
        data: {
          model: "meta-llama/llama-3.1-8b-instruct:free",
          messages: [
            { role: "system", content: "You are a sentiment analysis expert. Respond ONLY with a JSON object." },
            { role: "user", content: prompt }
          ],
          max_tokens: 100,
          temperature: 0.3
        }
      };
      
    case "DEEPSEEK":
      return {
        endpoint: "https://api.deepseek.com/chat/completions",
        headers: { ...baseHeaders, "Authorization": `Bearer ${apiKey}` },
        data: {
          model: "deepseek-chat",
          messages: [
            { role: "system", content: "You are a sentiment analysis expert. Respond ONLY with a JSON object." },
            { role: "user", content: prompt }
          ],
          max_tokens: 100,
          temperature: 0.3
        }
      };
      
    case "OPENAI_GPT4":
      return {
        endpoint: "https://api.openai.com/v1/chat/completions",
        headers: { ...baseHeaders, "Authorization": `Bearer ${apiKey}` },
        data: {
          model: "gpt-4o-mini",
          messages: [
            { role: "system", content: "You are a sentiment analysis expert. Respond ONLY with a JSON object." },
            { role: "user", content: prompt }
          ],
          max_tokens: 100,
          temperature: 0.3
        }
      };
      
    case "GEMINI":
      return {
        endpoint: "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent",
        headers: { ...baseHeaders, "x-goog-api-key": apiKey },
        data: {
          contents: [{
            parts: [{
              text: `You are a sentiment analysis expert. Respond ONLY with a JSON object.\n\n${prompt}`
            }]
          }],
          generationConfig: {
            maxOutputTokens: 100,
            temperature: 0.3
          }
        }
      };
      
    default:
      return null;
  }
}

/**
 * Extract response from provider-specific format
 */
function extractResponseFromProvider(provider, responseData) {
  switch (provider) {
    case "GEMINI":
      return responseData.candidates?.[0]?.content?.parts?.[0]?.text || '';
      
    case "GROQ":
    case "OPENROUTER":
    case "DEEPSEEK":
    case "OPENAI_GPT4":
      return responseData.choices?.[0]?.message?.content || '';
      
    default:
      return responseData.choices?.[0]?.message?.content || '';
  }
}

/**
 * Analyze sentiment using LLM with context awareness
 * @param {string} text - The text to analyze
 * @param {number} rating - Optional rating (1-5 stars) to consider
 * @param {string} businessType - Optional business type for context-aware analysis
 * @param {number} userId - User ID for LLM provider lookup
 * @param {number} firmId - Firm ID for LLM provider lookup
 * @returns {Promise<Object>} - Object containing sentiment and polarity
 */
async function analyzeSentimentWithLLM(text, rating = null, businessType = null, userId = 1481, firmId = 2) {
  if (!text || typeof text !== 'string') {
    return { sentiment: 'neutral', polarity: 0.0 };
  }
  
  const cleanText = text.trim();
  if (cleanText.length === 0) {
    return { sentiment: 'neutral', polarity: 0.0 };
  }
  
  // Check cache first
  const cacheKey = `${cleanText}_${rating}_${businessType}`;
  if (sentimentCache.has(cacheKey)) {
    return sentimentCache.get(cacheKey);
  }
  
  try {
    const llmConfig = await getActiveLLMProvider(userId, firmId);
    if (!llmConfig) {
      logger.warn('No LLM provider available for sentiment analysis - using fallback');
      return fallbackSentimentAnalysis(text, rating);
    }
    
    const { provider, apiKey } = llmConfig;
    
    // Build context-aware prompt
    const contextInfo = [];
    if (rating) contextInfo.push(`Star Rating: ${rating}/5`);
    if (businessType) contextInfo.push(`Business Type: ${businessType}`);
    
    const prompt = `Analyze the sentiment of this customer review and respond with ONLY a JSON object in this exact format:
{"sentiment": "positive|neutral|negative", "polarity": <number between -1.0 and 1.0>, "confidence": <number between 0 and 1>}

${contextInfo.length > 0 ? 'Context:\n' + contextInfo.join('\n') + '\n\n' : ''}Review Text: "${cleanText}"

Examples of sentiment analysis:
- "I lost 15 kgs! Great trainers and good ambiance." with 5 stars → {"sentiment": "positive", "polarity": 0.85, "confidence": 0.95}
- "Terrible service, waste of money" with 1 star → {"sentiment": "negative", "polarity": -0.9, "confidence": 0.98}
- "It was okay, nothing special" with 3 stars → {"sentiment": "neutral", "polarity": 0.0, "confidence": 0.8}
- "Amazing results! Highly recommend" with 5 stars → {"sentiment": "positive", "polarity": 0.95, "confidence": 0.99}

Important: Consider the star rating as a strong signal. A 5-star review should almost always be positive, and a 1-star review should almost always be negative.

Respond with ONLY the JSON object, no other text.`;

    const config = getProviderConfig(provider, apiKey, prompt);
    if (!config) {
      return fallbackSentimentAnalysis(text, rating);
    }
    
    const response = await axios.post(config.endpoint, config.data, {
      headers: config.headers,
      timeout: 10000
    });
    
    const content = extractResponseFromProvider(provider, response.data);
    
    // Parse JSON response
    const jsonMatch = content.match(/\{[^}]+\}/);
    if (jsonMatch) {
      const result = JSON.parse(jsonMatch[0]);
      
      // Validate and normalize the result
      const normalizedResult = {
        sentiment: ['positive', 'neutral', 'negative'].includes(result.sentiment) 
          ? result.sentiment 
          : 'neutral',
        polarity: Math.max(-1, Math.min(1, parseFloat(result.polarity) || 0)),
        confidence: result.confidence || 0.5
      };
      
      // Cache the result
      if (sentimentCache.size >= CACHE_MAX_SIZE) {
        const firstKey = sentimentCache.keys().next().value;
        sentimentCache.delete(firstKey);
      }
      sentimentCache.set(cacheKey, normalizedResult);
      
      return normalizedResult;
    }
    
    // If JSON parsing fails, use fallback
    logger.warn('Failed to parse LLM sentiment response, using fallback');
    return fallbackSentimentAnalysis(text, rating);
    
  } catch (error) {
    logger.error('Error in LLM sentiment analysis:', error.message);
    return fallbackSentimentAnalysis(text, rating);
  }
}

/**
 * Fallback sentiment analysis using rating-based heuristics
 */
function fallbackSentimentAnalysis(text, rating) {
  // Simple keyword-based analysis as fallback
  const lowerText = text.toLowerCase();
  
  const positiveKeywords = ['great', 'excellent', 'amazing', 'love', 'best', 'wonderful', 'fantastic', 'recommend', 'perfect', 'awesome', 'lost weight', 'transformed', 'achieved'];
  const negativeKeywords = ['terrible', 'worst', 'bad', 'awful', 'horrible', 'waste', 'disappointed', 'rude', 'unprofessional', 'avoid', 'regret'];
  
  let textScore = 0;
  positiveKeywords.forEach(word => {
    if (lowerText.includes(word)) textScore += 0.2;
  });
  negativeKeywords.forEach(word => {
    if (lowerText.includes(word)) textScore -= 0.2;
  });
  
  // Rating-based polarity (70% weight)
  let finalPolarity = 0;
  if (rating && rating >= 1 && rating <= 5) {
    const ratingPolarity = (rating - 3) / 2;
    finalPolarity = (ratingPolarity * 0.7) + (textScore * 0.3);
  } else {
    finalPolarity = textScore;
  }
  
  finalPolarity = Math.max(-1, Math.min(1, finalPolarity));
  
  let sentiment = 'neutral';
  if (finalPolarity > 0.15) sentiment = 'positive';
  else if (finalPolarity < -0.15) sentiment = 'negative';
  
  // Strong rating override
  if (rating >= 4) sentiment = 'positive';
  else if (rating <= 2) sentiment = 'negative';
  
  return {
    sentiment,
    polarity: parseFloat(finalPolarity.toFixed(3)),
    confidence: 0.6
  };
}

/**
 * Synchronous wrapper for backward compatibility
 * Note: This will use fallback analysis since it can't await LLM
 */
function analyzeSentiment(text, rating = null, businessType = null) {
  return fallbackSentimentAnalysis(text, rating);
}

/**
 * Batch analyze sentiment for multiple texts using LLM
 * @param {Array<string|Object>} texts - Array of texts or objects with {text, rating, businessType, userId, firmId}
 * @param {number} userId - User ID for LLM provider lookup
 * @param {number} firmId - Firm ID for LLM provider lookup
 * @returns {Promise<Array<Object>>} - Array of sentiment analysis results
 */
async function batchAnalyzeSentimentWithLLM(texts, userId = 1481, firmId = 2) {
  if (!Array.isArray(texts)) {
    return [];
  }
  
  const results = [];
  for (const item of texts) {
    if (typeof item === 'string') {
      results.push(await analyzeSentimentWithLLM(item, null, null, userId, firmId));
    } else if (typeof item === 'object' && item.text) {
      results.push(await analyzeSentimentWithLLM(
        item.text, 
        item.rating, 
        item.businessType, 
        item.userId || userId, 
        item.firmId || firmId
      ));
    } else {
      results.push({ sentiment: 'neutral', polarity: 0.0, confidence: 0 });
    }
  }
  
  return results;
}

/**
 * Synchronous batch analysis (uses fallback)
 */
function batchAnalyzeSentiment(texts) {
  if (!Array.isArray(texts)) {
    return [];
  }
  
  return texts.map(item => {
    if (typeof item === 'string') {
      return analyzeSentiment(item);
    } else if (typeof item === 'object' && item.text) {
      return analyzeSentiment(item.text, item.rating, item.businessType);
    }
    return { sentiment: 'neutral', polarity: 0.0 };
  });
}

/**
 * Get sentiment statistics for a collection of texts
 * @param {Array<string>} texts - Array of texts to analyze
 * @returns {Object} - Statistics object
 */
function getSentimentStats(texts) {
  const results = batchAnalyzeSentiment(texts);
  
  const stats = {
    total: results.length,
    positive: 0,
    negative: 0,
    neutral: 0,
    averagePolarity: 0,
    polarityDistribution: []
  };
  
  let totalPolarity = 0;
  
  results.forEach(result => {
    stats[result.sentiment]++;
    totalPolarity += result.polarity;
    stats.polarityDistribution.push(result.polarity);
  });
  
  if (results.length > 0) {
    stats.averagePolarity = parseFloat((totalPolarity / results.length).toFixed(3));
  }
  
  return stats;
}

module.exports = {
  analyzeSentiment,
  analyzeSentimentWithLLM,
  batchAnalyzeSentiment,
  batchAnalyzeSentimentWithLLM,
  getSentimentStats
};