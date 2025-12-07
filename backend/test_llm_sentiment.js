const { analyzeSentimentWithLLM } = require('./app/nlp/sentiment');

async function testSentiment() {
  console.log('Testing LLM-Based Sentiment Analysis');
  console.log('====================================\n');

  const testCases = [
    {
      text: "I have lost a weight of 15 kgs in three months and no muscle loss. Great trainers and good ambiance.",
      rating: 5,
      businessType: 'gym'
    },
    {
      text: "Terrible experience, wasted my money. The staff was rude and unprofessional.",
      rating: 1,
      businessType: 'gym'
    },
    {
      text: "It was okay, nothing special. Average service.",
      rating: 3,
      businessType: 'restaurant'
    },
    {
      text: "Amazing transformation! Lost 20 pounds and gained so much confidence. Highly recommend!",
      rating: 5,
      businessType: 'gym'
    },
    {
      text: "The trainers are knowledgeable but the equipment is outdated.",
      rating: 3,
      businessType: 'gym'
    }
  ];

  for (let i = 0; i < testCases.length; i++) {
    const test = testCases[i];
    console.log(`Test ${i + 1}:`);
    console.log(`Text: "${test.text}"`);
    console.log(`Rating: ${test.rating} stars`);
    console.log(`Business Type: ${test.businessType}`);
    
    try {
      const result = await analyzeSentimentWithLLM(
        test.text,
        test.rating,
        test.businessType,
        1481, // userId
        2     // firmId
      );
      
      console.log(`Result:`);
      console.log(`  Sentiment: ${result.sentiment}`);
      console.log(`  Polarity: ${result.polarity}`);
      console.log(`  Confidence: ${result.confidence || 'N/A'}`);
    } catch (error) {
      console.log(`Error: ${error.message}`);
    }
    
    console.log('');
  }
}

testSentiment().then(() => {
  console.log('Test completed!');
  process.exit(0);
}).catch(error => {
  console.error('Test failed:', error);
  process.exit(1);
});
