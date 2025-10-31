// Enhanced Content Script v3.0
// Handles dynamic content (SPA/React), split prices, and modern attributes

(function() {
  'use strict';
  
  const logger = PriceTrackerHelpers.createLogger('Content');
  
  // State management
  let extractionCache = null;
  let cacheTimestamp = 0;
  const CACHE_DURATION = 5000; // 5 seconds
  
  let mutationObserver = null;
  let lastUrl = window.location.href;
  let lastMutationTime = 0;
  let extractionInProgress = false;
  let dynamicCheckTimeout = null;
  
  // Throttled extraction for dynamic content
  const throttledExtraction = PriceTrackerHelpers.throttle(async () => {
    if (!extractionInProgress) {
      await extractProductInfo(true);
    }
  }, 1000);
  
  /**
   * Extract product info with caching
   */
  async function extractProductInfo(skipCache = false) {
    // Cache check
    const now = Date.now();
    if (!skipCache && extractionCache && (now - cacheTimestamp) < CACHE_DURATION) {
      logger.info('Returning cached product info');
      return extractionCache;
    }
    
    extractionInProgress = true;
    logger.info('Extracting product info from page...');
    
    try {
      const productInfo = await PriceParser.extractProductInfo();
      
      if (productInfo && productInfo.price) {
        // Cache result
        extractionCache = productInfo;
        cacheTimestamp = now;
        
        logger.success('Product extracted:', {
          name: PriceTrackerHelpers.truncate(productInfo.name, 50),
          price: productInfo.price,
          currency: productInfo.currency,
          confidence: productInfo.confidence
        });
        
        return productInfo;
      } else {
        logger.warn('No product info found on this page');
        return null;
      }
    } catch (error) {
      logger.error('Extraction error:', error);
      return null;
    } finally {
      extractionInProgress = false;
    }
  }
  
  /**
   * Setup MutationObserver for dynamic content (SPA/React)
   */
  function setupMutationObserver() {
    if (mutationObserver) {
      mutationObserver.disconnect();
    }
    
    mutationObserver = new MutationObserver((mutations) => {
      const now = Date.now();
      
      // Debounce mutations
      if (now - lastMutationTime < 500) {
        return;
      }
      
      // Check if mutations are relevant (price-related changes)
      const hasRelevantChange = mutations.some(mutation => {
        // Check added nodes
        if (mutation.addedNodes.length > 0) {
          for (const node of mutation.addedNodes) {
            if (node.nodeType === Node.ELEMENT_NODE) {
              const el = node;
              const className = (el.className || '').toString().toLowerCase();
              const id = (el.id || '').toLowerCase();
              
              // Check if added node is price-related
              if (/price|fiyat|amount|product/.test(className + id)) {
                return true;
              }
              
              // Check if added node contains price elements
              if (el.querySelector && el.querySelector('[class*="price"], [data-testid*="price"]')) {
                return true;
              }
            }
          }
        }
        
        // Check character data changes (text content)
        if (mutation.type === 'characterData') {
          const parent = mutation.target.parentElement;
          if (parent) {
            const className = (parent.className || '').toString().toLowerCase();
            if (/price|fiyat/.test(className)) {
              return true;
            }
          }
        }
        
        return false;
      });
      
      if (hasRelevantChange) {
        lastMutationTime = now;
        logger.info('Relevant DOM change detected, clearing cache');
        clearCache();
        throttledExtraction();
      }
    });
    
    // Observe with optimized config
    mutationObserver.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true,
      characterDataOldValue: false,
      attributes: true,
      attributeFilter: ['class', 'data-testid', 'data-price', 'aria-label'],
      attributeOldValue: false
    });
    
    logger.info('MutationObserver setup complete');
  }
  
  /**
   * Setup URL change detection for SPAs
   */
  function setupUrlChangeDetection() {
    // History API monitoring (for SPAs like React Router)
    const originalPushState = history.pushState;
    const originalReplaceState = history.replaceState;
    
    history.pushState = function() {
      originalPushState.apply(this, arguments);
      onUrlChange();
    };
    
    history.replaceState = function() {
      originalReplaceState.apply(this, arguments);
      onUrlChange();
    };
    
    // Popstate event (back/forward buttons)
    window.addEventListener('popstate', onUrlChange);
    
    // Interval check as fallback (for hash changes or other mechanisms)
    setInterval(() => {
      const currentUrl = window.location.href;
      if (currentUrl !== lastUrl) {
        onUrlChange();
      }
    }, 1000);
  }
  
  /**
   * Handle URL changes
   */
  function onUrlChange() {
    const currentUrl = window.location.href;
    if (currentUrl !== lastUrl) {
      logger.info('URL changed, clearing cache');
      lastUrl = currentUrl;
      clearCache();
      scheduleDynamicCheck();
    }
  }
  
  /**
   * Schedule dynamic content check
   * Wait for content to load after navigation
   */
  function scheduleDynamicCheck() {
    if (dynamicCheckTimeout) {
      clearTimeout(dynamicCheckTimeout);
    }
    
    // Check after 1 second (give React/Vue time to render)
    dynamicCheckTimeout = setTimeout(async () => {
      logger.info('Performing dynamic content check...');
      const info = await extractProductInfo(true);
      
      if (info && info.price) {
        notifyBackgroundScript(info);
      }
    }, 1000);
    
    // Additional check after 3 seconds for slower sites
    setTimeout(async () => {
      if (!extractionCache || !extractionCache.price) {
        logger.info('Performing delayed dynamic content check...');
        const info = await extractProductInfo(true);
        if (info && info.price) {
          notifyBackgroundScript(info);
        }
      }
    }, 3000);
  }
  
  /**
   * Clear extraction cache
   */
  function clearCache() {
    extractionCache = null;
    cacheTimestamp = 0;
  }
  
  /**
   * Notify background script about detected product
   */
  async function notifyBackgroundScript(info) {
    try {
      await browser.runtime.sendMessage({
        action: 'productDetected',
        product: info
      });
      logger.info('Product info sent to background');
    } catch (error) {
      // Background script might not be ready - not critical
      logger.warn('Could not send to background:', error.message);
    }
  }
  
  /**
   * Message listener
   */
  browser.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'getProductInfo') {
      logger.info('Product info requested by popup');
      
      extractProductInfo()
        .then(info => {
          sendResponse(info);
        })
        .catch(error => {
          logger.error('Error responding to getProductInfo:', error);
          sendResponse(null);
        });
      
      return true; // Async response
    }
    
    if (request.action === 'clearCache') {
      logger.info('Cache clear requested');
      clearCache();
      sendResponse({ success: true });
      return true;
    }
    
    if (request.action === 'forceRefresh') {
      logger.info('Force refresh requested');
      clearCache();
      extractProductInfo(true)
        .then(info => {
          sendResponse(info);
        })
        .catch(error => {
          logger.error('Error in force refresh:', error);
          sendResponse(null);
        });
      return true;
    }
  });
  
  /**
   * Initialize content script
   */
  function initialize() {
    logger.info('Initializing enhanced content script...');
    
    // Setup URL change detection
    setupUrlChangeDetection();
    
    // Setup mutation observer for dynamic content
    setupMutationObserver();
    
    // Initial extraction (after page is ready)
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => {
        scheduleDynamicCheck();
      });
    } else {
      scheduleDynamicCheck();
    }
    
    logger.success('Enhanced content script initialized');
  }
  
  // Start initialization
  initialize();
  
  // Performance monitoring
  window.addEventListener('load', () => {
    const timing = performance.timing;
    const loadTime = timing.loadEventEnd - timing.navigationStart;
    logger.info(`Page loaded in ${loadTime}ms`);
    
    // Additional check after full page load
    setTimeout(() => {
      if (!extractionCache || !extractionCache.price) {
        logger.info('Post-load extraction check...');
        extractProductInfo(true).then(info => {
          if (info && info.price) {
            notifyBackgroundScript(info);
          }
        });
      }
    }, 500);
  });
  
  // Cleanup on unload
  window.addEventListener('beforeunload', () => {
    if (mutationObserver) {
      mutationObserver.disconnect();
    }
    if (dynamicCheckTimeout) {
      clearTimeout(dynamicCheckTimeout);
    }
  });
  
})();