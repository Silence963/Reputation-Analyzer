const natural = require('natural');
const Sentiment = require('sentiment');

// Initialize sentiment analyzer
const sentiment = new Sentiment();

// Initialize stemmer
const stemmer = natural.PorterStemmer;

// Tokenizer
const tokenizer = new natural.WordTokenizer();

/**
 * Analyze sentiment of a given text with optional rating consideration
 * @param {string} text - The text to analyze
 * @param {number} rating - Optional rating (1-5 stars) to consider
 * @returns {Object} - Object containing sentiment and polarity
 */
function analyzeSentiment(text, rating = null) {
  if (!text || typeof text !== 'string') {
    return { sentiment: 'neutral', polarity: 0.0 };
  }
  
  // Clean the text
  const cleanText = text.trim().toLowerCase();
  
  if (cleanText.length === 0) {
    return { sentiment: 'neutral', polarity: 0.0 };
  }
  
  try {
    // Use sentiment library for basic analysis
    const result = sentiment.analyze(cleanText);
    
    // Normalize the score to [-1, 1] range
    let polarity = result.score;
    
    // Apply some scaling based on text length
    const wordCount = tokenizer.tokenize(cleanText).length;
    if (wordCount > 0) {
      polarity = polarity / Math.sqrt(wordCount);
    }
    
    // Incorporate rating if provided (1-5 scale converted to -1 to 1)
    if (rating && typeof rating === 'number' && rating > 0) {
      const ratingPolarity = (rating - 3) / 2; // Convert 1-5 to -1 to 1 scale (3=neutral)
      polarity = (polarity + ratingPolarity) / 2; // Average text sentiment with rating sentiment
    }
    
    // Clamp to [-1, 1] range
    polarity = Math.max(-1, Math.min(1, polarity));
    
    // Determine sentiment category
    let sentimentCategory;
    if (polarity > 0.1) {
      sentimentCategory = 'positive';
    } else if (polarity < -0.1) {
      sentimentCategory = 'negative';
    } else {
      sentimentCategory = 'neutral';
    }
    
    return {
      sentiment: sentimentCategory,
      polarity: parseFloat(polarity.toFixed(3))
    };
    
  } catch (error) {
    console.error('Error analyzing sentiment:', error);
    return { sentiment: 'neutral', polarity: 0.0 };
  }
}

/**
 * Batch analyze sentiment for multiple texts
 * @param {Array<string>} texts - Array of texts to analyze
 * @returns {Array<Object>} - Array of sentiment analysis results
 */
function batchAnalyzeSentiment(texts) {
  if (!Array.isArray(texts)) {
    return [];
  }
  
  return texts.map(text => analyzeSentiment(text));
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
  batchAnalyzeSentiment,
  getSentimentStats
};