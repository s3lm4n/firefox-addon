// Background Script v2.0
// Arka plan işlemleri, periyodik kontroller, bildirimler

(function() {
  'use strict';
  
  const logger = PriceTrackerHelpers.createLogger('Background');
  
  // Ayarlar
  const DEFAULT_SETTINGS = {
    checkInterval: 30, // dakika
    notifications: true,
    notifyOnPriceUp: false,
    notifyOnPriceDown: true,
    autoCheck: true,
    maxRetries: 3,
    rateLimitPerHour: 100
  };
  
  let settings = null;
  let rateLimiter = null;
  
  // Request deduplication - prevent multiple fetches to same URL
  const pendingRequests = new Map();
  
  // Initialize
  async function initialize() {
    logger.info('Initializing background script...');
    
    // Ayarları yükle
    settings = await PriceTrackerHelpers.getStorage('settings', DEFAULT_SETTINGS);
    
    // Rate limiter oluştur
    rateLimiter = PriceTrackerHelpers.createRateLimiter(
      settings.rateLimitPerHour,
      60 * 60 * 1000 // 1 saat
    );
    
    // Alarm'ı kur
    if (settings.autoCheck) {
      setupAlarm();
    }
    
    logger.success('Background script initialized');
  }
  
  // Alarm kur - DÜZELTİLDİ
  function setupAlarm() {
    // Önce mevcut alarm'ı temizle
    browser.alarms.clear('checkPrices').then(() => {
      // Yeni alarm kur
      browser.alarms.create('checkPrices', {
        periodInMinutes: settings.checkInterval,
        when: Date.now() + 60000 // 1 dakika sonra ilk çalışma
      });
      
      logger.info(`✅ Alarm kuruldu: Her ${settings.checkInterval} dakikada bir kontrol`);
    });
  }
  
  // Alarm tetiklendiğinde
  browser.alarms.onAlarm.addListener(async (alarm) => {
    if (alarm.name === 'checkPrices') {
      logger.info('⏰ Automatic price check triggered');
      await checkAllPrices();
    }
  });
  
  // Tüm ürünlerin fiyatlarını kontrol et
  async function checkAllPrices() {
    const products = await PriceTrackerHelpers.getStorage('trackedProducts', []);
    
    if (products.length === 0) {
      logger.info('No products to check');
      return { checked: 0, updated: 0, errors: 0 };
    }
    
    logger.info(`Checking ${products.length} products...`);
    
    let checked = 0;
    let updated = 0;
    let errors = 0;
    
    // Her ürünü kontrol et (paralel, ama rate limit'e dikkat)
    const checkPromises = products.map((product, index) => 
      checkProductWithDelay(product, index * 2000) // Her ürün için 2sn delay
    );
    
    const results = await Promise.allSettled(checkPromises);
    
    // Sonuçları işle
    for (let i = 0; i < results.length; i++) {
      const result = results[i];
      
      if (result.status === 'fulfilled' && result.value) {
        const { updated: wasUpdated, product: updatedProduct } = result.value;
        
        if (updatedProduct) {
          products[i] = updatedProduct;
          checked++;
          
          if (wasUpdated) {
            updated++;
          }
        }
      } else {
        errors++;
        logger.error(`Error checking product ${i}:`, result.reason);
      }
    }
    
    // Güncellenen ürünleri kaydet
    if (updated > 0) {
      await PriceTrackerHelpers.setStorage('trackedProducts', products);
    }
    
    logger.success(`Check complete: ${checked} checked, ${updated} updated, ${errors} errors`);
    
    return { checked, updated, errors };
  }
  
  // Ürünü delay ile kontrol et
  async function checkProductWithDelay(product, delay) {
    await PriceTrackerHelpers.wait(delay);
    return await checkSingleProduct(product);
  }
  
  // Tek bir ürünü kontrol et - DÜZELTİLDİ
  async function checkSingleProduct(product) {
    try {
      // Rate limit kontrolü
      try {
        await rateLimiter.checkLimit();
      } catch (rateLimitError) {
        logger.warn('Rate limit reached, waiting...');
        await PriceTrackerHelpers.wait(2000);
      }
      
      logger.info(`Checking: ${PriceTrackerHelpers.truncate(product.name, 40)}`);
      
      // Fiyatı çek
      const newPriceData = await fetchProductPrice(product.url);
      
      if (!newPriceData || !newPriceData.price || isNaN(newPriceData.price)) {
        logger.warn(`Could not fetch price for: ${product.site}`);
        // Yine de ürünü döndür (lastCheck güncellemek için)
        product.lastCheck = Date.now();
        return { updated: false, product: product };
      }
      
      const newPrice = newPriceData.price;
      const oldPrice = product.price;
      const hasChanged = Math.abs(newPrice - oldPrice) > 0.01;
      
      if (hasChanged) {
        logger.info(`Price changed: ${oldPrice} → ${newPrice} ${product.currency}`);
        
        // Fiyat geçmişini güncelle
        if (!product.priceHistory) {
          product.priceHistory = [];
        }
        
        product.priceHistory.push({
          price: oldPrice,
          date: product.lastCheck || Date.now()
        });
        
        // Maksimum 30 geçmiş fiyat tut
        if (product.priceHistory.length > 30) {
          product.priceHistory = product.priceHistory.slice(-30);
        }
        
        // Ürünü güncelle - ESKİ FİYATI previousPrice'a kaydet
        product.previousPrice = oldPrice;  // Eski fiyat
        product.price = newPrice;          // Yeni fiyat (güncel)
        product.lastCheck = Date.now();
        
        // Ürün adını da güncelle (değişmiş olabilir)
        if (newPriceData.name && newPriceData.name.length > 10) {
          product.name = newPriceData.name;
        }
        
        // Bildirim gönder
        if (settings.notifications) {
          await sendPriceNotification(product, oldPrice, newPrice);
        }
        
        return { updated: true, product };
      } else {
        // Fiyat değişmedi, sadece lastCheck'i güncelle
        product.lastCheck = Date.now();
        return { updated: false, product };
      }
      
    } catch (error) {
      logger.error(`Error checking product:`, error);
      throw error;
    }
  }
  
  // Ürün fiyatını fetch et - DÜZELTİLDİ: Daha fazla bilgi döndür + Request deduplication
  async function fetchProductPrice(url) {
    // Check if request is already pending for this URL
    if (pendingRequests.has(url)) {
      logger.info(`Reusing pending request for ${url}`);
      return await pendingRequests.get(url);
    }
    
    // Create new request promise
    const requestPromise = (async () => {
      try {
        const response = await fetch(url, {
          method: 'GET',
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Accept-Language': 'tr-TR,tr;q=0.9,en-US;q=0.8,en;q=0.7',
            'Cache-Control': 'no-cache'
          },
          cache: 'no-store'
        });
        
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
        
        const html = await response.text();
        
        // Basit DOM parser
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');
        
        // PriceParser ile extract et
        const productInfo = await PriceParser.extractProductInfo(doc, url);
        
        return productInfo; // Tüm bilgiyi döndür (price, name, vb.)
        
      } catch (error) {
        logger.error('Fetch error:', error);
        return null;
      } finally {
        // Clean up pending request
        pendingRequests.delete(url);
      }
    })();
    
    // Store pending request
    pendingRequests.set(url, requestPromise);
    
    return await requestPromise;
  }
  
  // Fiyat bildirimi gönder
  async function sendPriceNotification(product, oldPrice, newPrice) {
    const change = PriceTrackerHelpers.calculateChange(oldPrice, newPrice);
    
    // Ayarlara göre bildirim gönder mi?
    if (change.isIncrease && !settings.notifyOnPriceUp) {
      return;
    }
    if (change.isDecrease && !settings.notifyOnPriceDown) {
      return;
    }
    
    const title = change.isDecrease ? '🎉 Fiyat Düştü!' : '📈 Fiyat Arttı';
    const icon = change.isDecrease ? '🔻' : '🔺';
    
    const message = [
      PriceTrackerHelpers.truncate(product.name, 50),
      `${oldPrice.toFixed(2)} → ${newPrice.toFixed(2)} ${product.currency}`,
      `${icon} ${change.percentFormatted}`
    ].join('\n');
    
    await browser.notifications.create({
      type: 'basic',
      iconUrl: browser.runtime.getURL('icons/icon48.png'),
      title: title,
      message: message,
      priority: change.isDecrease ? 2 : 1
    });
    
    logger.info('Notification sent');
  }
  
  // Message handler
  browser.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'checkAllPrices') {
      checkAllPrices()
        .then(result => sendResponse(result))
        .catch(error => sendResponse({ error: error.message }));
      return true;
    }
    
    if (request.action === 'checkSingleProduct') {
      checkSingleProduct(request.product)
        .then(result => sendResponse(result))
        .catch(error => sendResponse({ error: error.message }));
      return true;
    }
    
    if (request.action === 'updateSettings') {
      settings = { ...settings, ...request.settings };
      PriceTrackerHelpers.setStorage('settings', settings)
        .then(() => {
          if (request.settings.checkInterval) {
            setupAlarm();
          }
          sendResponse({ success: true });
        });
      return true;
    }
    
    if (request.action === 'getSettings') {
      sendResponse(settings);
      return true;
    }
    
    if (request.action === 'productDetected') {
      // Content script'ten gelen bilgi - şimdilik logla
      logger.info('Product detected on page:', request.product.name);
      sendResponse({ received: true });
      return true;
    }
  });
  
  // Extension yüklendiğinde
  browser.runtime.onInstalled.addListener((details) => {
    if (details.reason === 'install') {
      logger.success('🎉 Price Tracker Pro installed!');
      
      // Welcome notification
      browser.notifications.create({
        type: 'basic',
        iconUrl: browser.runtime.getURL('icons/icon48.png'),
        title: 'Fiyat Takipçisi Pro',
        message: 'Eklenti başarıyla kuruldu! Bir ürün sayfasına gidip takibe alabilirsiniz.'
      });
      
    } else if (details.reason === 'update') {
      logger.success(`Updated to version ${browser.runtime.getManifest().version}`);
    }
    
    initialize();
  });
  
  // Startup'ta initialize et
  browser.runtime.onStartup.addListener(() => {
    logger.info('Browser started');
    initialize();
  });
  
  // İlk yükleme
  initialize();
  
})();