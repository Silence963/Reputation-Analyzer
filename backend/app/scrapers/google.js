const puppeteer = require('puppeteer');
const logger = require('../utils/logger');

/**
 * Scrape Google Maps reviews for a given company
 * @param {Object} company - Company object with VEND_TITL, VEND_CON_ADDR, etc.
 * @param {Object} options - Scraping options
 * @returns {Array} - Array of review objects
 */
async function getGoogleReviews(company, options = {}) {
  const {
    maxReviews = 999999,
    includeMeta = true,
    waitSecs = 2000,
    scrollPause = 2500,
    maxStagnant = 5
  } = options;

  // Get company name - use VEND_TITL as primary field
  let companyName = company.VEND_TITL;
  const companyAddress = company.VEND_CON_ADDR;
  
  // Handle cases where VEND_TITL is null or empty
  if (!companyName || companyName.trim() === '') {
    companyName = company.COMPANY_NAME || 
                  company.NAME || 
                  company.VENDOR_NAME || 
                  company.BUSINESS_NAME || 
                  `Company_${company.VEND_ID || 'Unknown'}`;
    logger.info(`VEND_TITL was null/empty, using alternative: ${companyName}`);
  }
  
  // Combine company name with address for better search accuracy
  let searchTerm = companyName;
  if (companyAddress && companyAddress.trim()) {
    searchTerm = `${companyName}, ${companyAddress.trim()}`;
    logger.info(`Using combined search term: ${searchTerm}`);
  } else {
    logger.info(`No address found (VEND_CON_ADDR), using name only: ${searchTerm}`);
  }
  
  const googleReviewLink = company.GOOGLE_RVW_LINK;
  logger.info(`Attempting to scrape reviews for: ${companyName}`);
  
  // Validate that we have a usable search term
  if (!searchTerm || searchTerm.trim().length < 2) {
    logger.error(`Search term '${searchTerm}' is too short or empty. Cannot search.`);
    return [];
  }

  let browser;
  const results = [];
  
  try {
    // Launch browser
    const headless = String(process.env.PUPPETEER_HEADLESS || 'true').toLowerCase() === 'true';
    const executablePath = process.env.PUPPETEER_EXECUTABLE_PATH || undefined;
    browser = await puppeteer.launch({
      headless,
      executablePath,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--disable-gpu'
      ]
    });
    
    const page = await browser.newPage();
    
    // Set viewport and user agent
    await page.setViewport({ width: 1366, height: 768 });
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');
    
    // Navigate to Google Maps or direct review link
    if (googleReviewLink && googleReviewLink !== 'Not Available') {
      logger.info(`Using provided Google review link: ${googleReviewLink}`);
      await page.goto(googleReviewLink, { waitUntil: 'networkidle2' });
    } else {
      logger.info(`Searching Google Maps for: ${companyName}`);
      // Prefer direct search URL to land on results faster
      const mapsSearchUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(searchTerm)}`;
      await page.goto(mapsSearchUrl, { waitUntil: 'networkidle2' });
      
      // Handle consent popups
      try {
        await page.waitForSelector('button', { timeout: 3000 });
        const consentButtons = await page.$$eval('button', buttons =>
          buttons.filter(btn => 
            btn.textContent.includes('Accept all') ||
            btn.textContent.includes('I agree') ||
            btn.textContent.includes('Accept')
          )
        );
        
        if (consentButtons.length > 0) {
          await page.click('button');
          await page.waitForTimeout(1000);
        }
      } catch (error) {
        // Ignore consent popup errors
      }
      
      // If searchbox is present, use it as a fallback
      try {
        await page.waitForSelector('#searchboxinput', { timeout: 4000 });
        await page.click('#searchboxinput');
        await page.keyboard.down('Control');
        await page.keyboard.press('A');
        await page.keyboard.up('Control');
        await page.type('#searchboxinput', searchTerm);
        await page.keyboard.press('Enter');
        logger.info(`Submitted search for: ${searchTerm}`);
        await page.waitForTimeout(2000);
      } catch (error) {
        // Search box may not be present when using direct search URL; continue
      }
    }
    
    // Helper: click first element whose text includes a phrase
    async function clickElementByText(page, selectors, text, timeout = 5000) {
      for (const selector of selectors) {
        try {
          await page.waitForSelector(selector, { timeout });
          const handles = await page.$$(selector);
          for (const h of handles) {
            const t = await h.evaluate(el => (el.textContent || '').trim());
            if (t && t.toLowerCase().includes(text.toLowerCase())) {
              await h.click();
              return true;
            }
          }
        } catch (_) {
          continue;
        }
      }
      return false;
    }

    // Click on Reviews tab
    let reviewsClicked = false;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        // Try different selectors and pick element containing the text 'Reviews'
        const reviewsSelectors = [
          'button',
          '[role="tab"]',
          'div[role="tab"]',
          'div button',
          'div'
        ];
        reviewsClicked = await clickElementByText(page, reviewsSelectors, 'Reviews', 4000);
        if (reviewsClicked) logger.info('Clicked Reviews tab');
        
        if (reviewsClicked) {
          await page.waitForTimeout(4000);
          break;
        }
      } catch (error) {
        logger.warn(`Attempt ${attempt + 1}: Could not find Reviews tab:`, error.message);
        await page.waitForTimeout(2000);
      }
    }
    
    if (!reviewsClicked) {
      logger.error('Failed to find/click Reviews tab after 3 attempts');
      return [];
    }
    
    // Try to click "More reviews" if present
    try {
      const clicked = await clickElementByText(page, ['button', 'div button', 'div'], 'More reviews', 2000);
      if (clicked) {
        logger.info('Clicked More reviews button');
        await page.waitForTimeout(2000);
      }
    } catch (error) {
      // More reviews button not found, continue
    }
    
    // Find scrollable reviews container
    const scrollableContainer = await findReviewsContainer(page);
    if (!scrollableContainer) {
      logger.error('Could not locate reviews scroll container');
      return [];
    }
    
    // Scrolling and collection loop
    const seenIds = new Set();
    let stagnantScrolls = 0;
    let lastCount = 0;
    
    while (results.length < maxReviews && stagnantScrolls < maxStagnant) {
      // Collect currently visible reviews
      const newReviews = await collectReviewsFromDOM(page, includeMeta, seenIds);
      results.push(...newReviews);
      
      // Check progress
      if (results.length === lastCount) {
        stagnantScrolls++;
      } else {
        stagnantScrolls = 0;
      }
      
      lastCount = results.length;
      logger.info(`Reviews collected so far: ${results.length} (stagnant=${stagnantScrolls}/${maxStagnant})`);
      
      if (stagnantScrolls >= maxStagnant) {
        logger.info('No new reviews after repeated scrolls. Assuming end of list.');
        break;
      }
      
      // Scroll to load more reviews
      try {
        await page.evaluate((container) => {
          container.scrollTo(0, container.scrollHeight);
        }, scrollableContainer);
        await page.waitForTimeout(scrollPause);
      } catch (error) {
        logger.error('Scroll error:', error);
        break;
      }
    }
    
    logger.info(`Finished. Total reviews collected: ${results.length}`);
    
    // Extract the current Google Maps URL (contains place ID) before closing browser
    let currentUrl = null;
    try {
      currentUrl = page.url();
      logger.info(`Extracted Google URL: ${currentUrl}`);
    } catch (error) {
      logger.error('Failed to extract URL:', error);
    }
    
    // Close browser
    if (browser) {
      await browser.close();
    }
    
    // Return results with URL if metadata requested
    if (includeMeta) {
      return {
        reviews: results,
        google_url: currentUrl
      };
    } else {
      return results.map(r => r.text).filter(Boolean);
    }
    
  } catch (error) {
    logger.error('Error during scraping:', error);
    if (browser) {
      await browser.close();
    }
    // Return empty result on error
    return includeMeta ? { reviews: [], google_url: null } : [];
  }
}

/**
 * Find the scrollable reviews container
 */
async function findReviewsContainer(page) {
  const selectors = [
    '[data-reviewid]',
    '.m6QErb.DxyBCb.qjESne',
    '.m6QErb.DxyBCb',
    '[role="region"]',
    '.review-dialog-list'
  ];
  
  for (const selector of selectors) {
    try {
      await page.waitForSelector(selector, { timeout: 5000 });
      return await page.$(selector);
    } catch (error) {
      continue;
    }
  }
  
  return null;
}

/**
 * Collect reviews from the current DOM state
 */
async function collectReviewsFromDOM(page, includeMeta, seenIds) {
  const newRecords = [];
  
  try {
    // Find review cards
    const reviewCards = await page.$$('.jftiEf, .gws-localreviews__google-review');
    
    for (const card of reviewCards) {
      try {
        // Create unique ID for deduplication
        const cardHtml = await card.evaluate(el => el.innerHTML);
        const cardId = hashCode(cardHtml);
        
        if (seenIds.has(cardId)) {
          continue;
        }
        
        // Expand truncated reviews
        await expandCardIfTruncated(page, card);
        
        // Extract review text
        let text = '';
        try {
          const textElement = await card.$('.wiI7pd, .review-full-text');
          if (textElement) {
            text = await textElement.evaluate(el => el.textContent.trim());
            text = text.replace(/\*+/g, ''); // Remove asterisks
          }
        } catch (error) {
          // Continue if text extraction fails
        }
        
        let ratingVal = null;
        let reviewerName = null;
        let reviewDate = null;
        
        if (includeMeta) {
          // Extract rating
          try {
            const starElement = await card.$('.kvMYJc');
            if (starElement) {
              const ariaLabel = await starElement.evaluate(el => el.getAttribute('aria-label'));
              ratingVal = parseRatingFromAria(ariaLabel);
            }
          } catch (error) {
            // Continue if rating extraction fails
          }
          
          // Extract reviewer name
          try {
            const reviewerElement = await card.$('.d4r55');
            if (reviewerElement) {
              reviewerName = await reviewerElement.evaluate(el => el.textContent.trim());
            }
          } catch (error) {
            // Continue if reviewer extraction fails
          }
          
          // Extract date with robust selectors
          const dateSelectors = ['.PuaHbe', '.rsqaWe', '.dehysf', '.gxMdQe', 'span'];
          for (const selector of dateSelectors) {
            try {
              const dateElements = await card.$$(selector);
              for (const dateEl of dateElements) {
                const dateText = await dateEl.evaluate(el => el.textContent.trim());
                if (isDateText(dateText)) {
                  // Convert relative date to actual date
                  reviewDate = parseRelativeDate(dateText);
                  break;
                }
              }
              if (reviewDate) break;
            } catch (error) {
              continue;
            }
          }
        }
        
        // Only add if we have content
        if (text || includeMeta) {
          newRecords.push({
            text,
            rating: ratingVal,
            reviewer: reviewerName,
            date: reviewDate
          });
          seenIds.add(cardId);
        }
        
      } catch (error) {
        logger.warn('Error processing review card:', error);
        continue;
      }
    }
    
  } catch (error) {
    logger.error('Error collecting reviews from DOM:', error);
  }
  
  return newRecords;
}

/**
 * Expand truncated review if "More" button is present
 */
async function expandCardIfTruncated(page, card) {
  try {
    const moreButton = await card.$('button.w8nwRe, button[jsaction*="expandReview"], button:has-text("More")');
    if (moreButton) {
      const isVisible = await moreButton.isVisible();
      if (isVisible) {
        await moreButton.click();
        await page.waitForTimeout(100);
      }
    }
  } catch (error) {
    // Continue if expansion fails
  }
}

/**
 * Parse rating from aria-label
 */
function parseRatingFromAria(ariaLabel) {
  if (!ariaLabel) return null;
  
  const match = ariaLabel.match(/(\d+(?:\.\d+)?)/);
  if (match) {
    try {
      return parseFloat(match[1]);
    } catch (error) {
      return null;
    }
  }
  return null;
}

/**
 * Check if text looks like a date
 */
function isDateText(text) {
  if (!text) return false;
  const lowerText = text.toLowerCase();
  return ['ago', 'year', 'month', 'week', 'day', 'hour', 'minute'].some(word => 
    lowerText.includes(word)
  );
}

/**
 * Convert relative date text (e.g., "2 months ago") to actual date
 */
function parseRelativeDate(dateText) {
  if (!dateText) return null;
  
  const now = new Date();
  const lowerText = dateText.toLowerCase();
  
  // Extract number from text (e.g., "2 months ago" -> 2)
  const numberMatch = lowerText.match(/(\d+)/);
  const number = numberMatch ? parseInt(numberMatch[1]) : 1;
  
  // Determine time unit and calculate date
  if (lowerText.includes('year')) {
    now.setFullYear(now.getFullYear() - number);
  } else if (lowerText.includes('month')) {
    now.setMonth(now.getMonth() - number);
  } else if (lowerText.includes('week')) {
    now.setDate(now.getDate() - (number * 7));
  } else if (lowerText.includes('day')) {
    now.setDate(now.getDate() - number);
  } else if (lowerText.includes('hour')) {
    now.setHours(now.getHours() - number);
  } else if (lowerText.includes('minute')) {
    now.setMinutes(now.getMinutes() - number);
  }
  
  return now.toISOString();
}

/**
 * Simple hash function for string
 */
function hashCode(str) {
  let hash = 0;
  if (str.length === 0) return hash;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return hash;
}

module.exports = {
  getGoogleReviews
};