// Content Script v2.0
// Sayfa içerisinde çalışan script - ürün bilgisi toplama

(function() {
  'use strict';
  
  const logger = PriceTrackerHelpers.createLogger('Content');
  let extractionCache = null;
  let cacheTimestamp = 0;
  const CACHE_DURATION = 5000; // 5 saniye
  
  // Ürün bilgisini extract et (cache'li)
  async function extractProductInfo() {
    // Cache kontrolü
    const now = Date.now();
    if (extractionCache && (now - cacheTimestamp) < CACHE_DURATION) {
      logger.info('Returning cached product info');
      return extractionCache;
    }
    
    logger.info('Extracting product info from page...');
    
    try {
      const productInfo = await PriceParser.extractProductInfo();
      
      if (productInfo && productInfo.price) {
        // Cache'e kaydet
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
    }
  }
  
  // Message listener
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
      logger.info('Clearing extraction cache');
      extractionCache = null;
      cacheTimestamp = 0;
      sendResponse({ success: true });
      return true;
    }
  });
  
  // Otomatik kontrol - sayfa yüklendiğinde
  let autoCheckTimeout = null;
  
  function scheduleAutoCheck() {
    // Önceki timeout'u iptal et
    if (autoCheckTimeout) {
      clearTimeout(autoCheckTimeout);
    }
    
    // Yeni check planla
    autoCheckTimeout = setTimeout(async () => {
      const info = await extractProductInfo();
      
      if (info && info.price) {
        // Background'a bilgi gönder
        try {
          await browser.runtime.sendMessage({
            action: 'productDetected',
            product: info
          });
          
          logger.info('Product info sent to background');
        } catch (error) {
          // Background script hazır değil olabilir - sorun değil
          logger.warn('Could not send to background:', error.message);
        }
      }
    }, 2000); // 2 saniye sonra kontrol et
  }
  
  // Sayfa yüklenince otomatik kontrol
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', scheduleAutoCheck);
  } else {
    scheduleAutoCheck();
  }
  
  // SPA detection - URL değişikliklerini izle
  let lastUrl = window.location.href;
  
  const urlObserver = new MutationObserver(() => {
    const currentUrl = window.location.href;
    if (currentUrl !== lastUrl) {
      logger.info('URL changed, clearing cache');
      lastUrl = currentUrl;
      extractionCache = null;
      cacheTimestamp = 0;
      scheduleAutoCheck();
    }
  });
  
  urlObserver.observe(document.body, {
    childList: true,
    subtree: true
  });
  
  // Performans monitoring
  window.addEventListener('load', () => {
    const timing = performance.timing;
    const loadTime = timing.loadEventEnd - timing.navigationStart;
    logger.info(`Page loaded in ${loadTime}ms`);
  });
  
  logger.success('Content script initialized');
})();