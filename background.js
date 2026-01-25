// Fixed Background Script v3.5 - ALERTS & MULTI-CURRENCY
(function () {
  "use strict";

  const logger = PriceTrackerHelpers.createLogger("Background");

  // Ensure Config is available, provide fallback
  const DEFAULT_SETTINGS =
    typeof Config !== "undefined" && Config.DEFAULT_SETTINGS
      ? Config.DEFAULT_SETTINGS
      : {
          checkInterval: 30,
          notifications: true,
          notifyOnPriceUp: false,
          notifyOnPriceDown: true,
          autoCheck: true,
          maxRetries: 3,
          rateLimitPerHour: 100,
          minChangePercent: 5,
          enablePicker: false,
          verboseLogging: false,
          cacheDuration: 300,
          preferredCurrency: "TRY",
          enablePriceAlerts: true,
          autoBackup: true,
          autoBackupInterval: 24,
          theme: "auto",
        };

  let settings = null;
  let rateLimiter = null;
  let retryQueue = new Map(); // For error recovery

  // Use centralized cache manager if available
  const cache =
    typeof CacheManager !== "undefined"
      ? CacheManager.createCache({
          defaultTTL: 300000,
          maxSize: 100,
          autoCleanup: true,
        })
      : {
          get: () => undefined,
          set: () => {},
          clear: () => {},
          size: () => 0,
        };

  const pendingRequests = new Map();

  /**
   * FIXED: Load settings from storage with proper error handling
   */
  async function loadSettings() {
    try {
      const stored = await browser.storage.local.get("settings");

      if (stored.settings && typeof stored.settings === "object") {
        // Merge with defaults to ensure all keys exist
        settings = { ...DEFAULT_SETTINGS, ...stored.settings };
        logger.info("✅ Settings loaded from storage:", settings);
      } else {
        // No settings found, use defaults
        settings = { ...DEFAULT_SETTINGS };
        await browser.storage.local.set({ settings: settings });
        logger.info("📝 Default settings initialized and saved");
      }
      return settings;
    } catch (error) {
      logger.error("❌ Settings load error:", error);
      settings = { ...DEFAULT_SETTINGS };
      return settings;
    }
  }

  /**
   * FIXED: Save settings to storage with validation
   */
  async function saveSettings(newSettings) {
    try {
      if (!newSettings || typeof newSettings !== "object") {
        throw new Error("Invalid settings object");
      }

      // Merge with existing settings
      settings = { ...settings, ...newSettings };

      logger.info("Saving settings:", settings);

      // Actually save to storage
      await browser.storage.local.set({ settings: settings });

      // Verify save
      const verification = await browser.storage.local.get("settings");
      logger.info("Verification after save:", verification);

      logger.success("💾 Settings saved successfully");
      return true;
    } catch (error) {
      logger.error("❌ Settings save error:", error);
      return false;
    }
  }

  /**
   * Initialize
   */
  async function initialize() {
    logger.info("🚀 Initializing background script...");
    try {
      await loadSettings();

      // Initialize rate limiter
      if (
        typeof PriceTrackerHelpers !== "undefined" &&
        PriceTrackerHelpers.createRateLimiter
      ) {
        rateLimiter = PriceTrackerHelpers.createRateLimiter(
          settings.rateLimitPerHour,
          60 * 60 * 1000
        );
      } else {
        // Fallback rate limiter
        rateLimiter = {
          checkLimit: async () => true,
          getTokens: () => settings.rateLimitPerHour,
          reset: () => {},
        };
      }

      if (settings.autoCheck) {
        await setupAlarm();
      }

      await createContextMenu();

      logger.success("✅ Background initialized with settings:", {
        autoCheck: settings.autoCheck,
        checkInterval: settings.checkInterval,
        notifications: settings.notifications,
      });
    } catch (error) {
      logger.error("❌ Init failed:", error);
    }
  }

  /**
   * Create context menu - IMPROVED
   */
  async function createContextMenu() {
    try {
      await browser.contextMenus.removeAll();

      // Basit menü (ana + alt menü Firefox'ta sorun çıkarabiliyor)
      await browser.contextMenus.create({
        id: "select-price-element",
        title: "🎯 Fiyat Öğesini Seç",
        contexts: ["all"],
        documentUrlPatterns: ["http://*/*", "https://*/*"],
      });

      await browser.contextMenus.create({
        id: "check-current-page",
        title: "🔍 Bu Sayfayı Kontrol Et",
        contexts: ["all"],
        documentUrlPatterns: ["http://*/*", "https://*/*"],
      });

      logger.info("📋 Context menu created");
    } catch (error) {
      logger.error("Context menu creation error:", error);
    }
  }

  /**
   * Handle context menu clicks - IMPROVED
   */
  browser.contextMenus.onClicked.addListener(async (info, tab) => {
    try {
      if (info.menuItemId === "select-price-element") {
        logger.info("🎯 Manual selector activated from context menu");

        // Inject picker script
        await browser.tabs.executeScript(tab.id, {
          file: "picker.js",
        });

        logger.success("✅ Picker injected successfully");
      } else if (info.menuItemId === "check-current-page") {
        logger.info("🔍 Checking current page for products");

        // Send message to content script to extract product
        try {
          const response = await browser.tabs.sendMessage(tab.id, {
            action: "getProductInfo",
            skipCache: true,
          });

          if (response && response.price) {
            await browser.notifications.create({
              type: "basic",
              iconUrl: browser.runtime.getURL("icons/icon48.png"),
              title: "✅ Ürün Bulundu!",
              message: `${response.name}\n${response.price} ${response.currency}`,
            });
          } else {
            await browser.notifications.create({
              type: "basic",
              iconUrl: browser.runtime.getURL("icons/icon48.png"),
              title: "ℹ️ Ürün Bulunamadı",
              message: "Bu sayfada ürün algılanamadı. Manuel seçici kullanın.",
            });
          }
        } catch (e) {
          logger.error("Page check error:", e);
          await browser.notifications.create({
            type: "basic",
            iconUrl: browser.runtime.getURL("icons/icon48.png"),
            title: "❌ Hata",
            message: "Sayfa kontrol edilemedi.",
          });
        }
      }
    } catch (error) {
      logger.error("❌ Context menu handler error:", error);
      await browser.notifications.create({
        type: "basic",
        iconUrl: browser.runtime.getURL("icons/icon48.png"),
        title: "Hata",
        message: "İşlem başarısız oldu.",
      });
    }
  });

  /**
   * Setup alarm
   */
  async function setupAlarm() {
    try {
      await browser.alarms.clear("checkPrices");
      const interval = Math.max(5, Math.min(1440, settings.checkInterval));
      await browser.alarms.create("checkPrices", {
        periodInMinutes: interval,
        when: Date.now() + 60000,
      });
      logger.info(`⏰ Alarm set: Every ${interval} minutes`);
    } catch (error) {
      logger.error("Alarm setup failed:", error);
    }
  }

  /**
   * FIXED: Listen for storage changes with proper handling
   */
  browser.storage.onChanged.addListener(async (changes, areaName) => {
    if (areaName === "local" && changes.settings) {
      logger.info("⚙️ Settings changed, reloading...");
      const newSettings = changes.settings.newValue;

      if (newSettings && typeof newSettings === "object") {
        settings = { ...DEFAULT_SETTINGS, ...newSettings };
        if (
          changes.settings.oldValue?.rateLimitPerHour !==
          newSettings.rateLimitPerHour
        ) {
          if (
            typeof PriceTrackerHelpers !== "undefined" &&
            PriceTrackerHelpers.createRateLimiter
          ) {
            rateLimiter = PriceTrackerHelpers.createRateLimiter(
              settings.rateLimitPerHour,
              60 * 60 * 1000
            );
            logger.info("🔄 Rate limiter updated");
          }
        }
        if (
          changes.settings.oldValue?.autoCheck !== newSettings.autoCheck ||
          changes.settings.oldValue?.checkInterval !== newSettings.checkInterval
        ) {
          if (settings.autoCheck) {
            await setupAlarm();
          } else {
            await browser.alarms.clear("checkPrices");
            logger.info("⏰ Alarm disabled");
          }
        }
        logger.success("✅ Settings synchronized");
      }
    }
  });

  /**
   * Alarm listener
   */
  browser.alarms.onAlarm.addListener(async (alarm) => {
    if (alarm.name === "checkPrices") {
      logger.info("⏰ Automatic check triggered");
      await checkAllPrices();
      
      // Check price alerts after price check
      if (settings.enablePriceAlerts && typeof PriceAlerts !== "undefined") {
        await checkPriceAlerts();
      }
    } else if (alarm.name === "autoBackup") {
      // Auto backup
      if (settings.autoBackup && typeof DataManager !== "undefined") {
        logger.info("💾 Running auto backup...");
        await DataManager.createAutoBackup();
      }
    } else if (alarm.name === "retryFailed") {
      // Retry failed requests
      await processRetryQueue();
    }
  });

  /**
   * Check price alerts
   */
  async function checkPriceAlerts() {
    if (typeof PriceAlerts === "undefined") return;

    try {
      const products = await PriceTrackerHelpers.getStorage("trackedProducts", []);
      const triggered = await PriceAlerts.checkAllAlerts(products);

      for (const alert of triggered) {
        if (settings.notifications) {
          await browser.notifications.create({
            type: "basic",
            iconUrl: browser.runtime.getURL("icons/icon48.png"),
            title: "🔔 Fiyat Alarmı!",
            message: alert.message,
            priority: 2,
          });
        }
        logger.info(`🔔 Alert triggered: ${alert.message}`);
      }

      return triggered;
    } catch (error) {
      logger.error("Alert check error:", error);
      return [];
    }
  }

  /**
   * Process retry queue for failed requests
   */
  async function processRetryQueue() {
    if (retryQueue.size === 0) return;

    logger.info(`🔄 Processing ${retryQueue.size} failed requests...`);

    for (const [url, retryInfo] of retryQueue.entries()) {
      if (retryInfo.attempts >= settings.maxRetries) {
        retryQueue.delete(url);
        continue;
      }

      try {
        const result = await fetchProductPrice(url);
        if (result && result.price) {
          retryQueue.delete(url);
          logger.success(`✅ Retry successful for ${url}`);
        }
      } catch (error) {
        retryInfo.attempts++;
        retryInfo.lastError = error.message;
        logger.warn(`⚠️ Retry ${retryInfo.attempts} failed for ${url}`);
      }
    }
  }

  /**
   * Add to retry queue
   */
  function addToRetryQueue(url, error) {
    if (!retryQueue.has(url)) {
      retryQueue.set(url, {
        attempts: 1,
        firstFailed: Date.now(),
        lastError: error.message,
      });
    }
  }

  /**
   * Check all prices
   */
  async function checkAllPrices() {
    const products = await PriceTrackerHelpers.getStorage(
      "trackedProducts",
      []
    );

    if (products.length === 0) {
      logger.info("No products to check");
      return { checked: 0, updated: 0, errors: 0 };
    }

    logger.info(`🔍 Checking ${products.length} products...`);

    let checked = 0;
    let updated = 0;
    let errors = 0;
    const originalCount = products.length;

    for (let i = 0; i < products.length; i++) {
      try {
        await PriceTrackerHelpers.wait(i * 2000);
        const result = await checkSingleProduct(products[i]);
        if (result && result.product) {
          products[i] = result.product;
          checked++;
          if (result.updated) {
            updated++;
          }
        }
      } catch (error) {
        errors++;
        logger.error(`Error checking product ${i}:`, error);
      }
    }

    // FIXED: Only save if we still have products and didn't lose any
    if (checked > 0 && products.length === originalCount) {
      await PriceTrackerHelpers.setStorage("trackedProducts", products);
      logger.info(`💾 Saved ${products.length} products after check`);
    } else if (products.length !== originalCount) {
      logger.error(`❌ Product count mismatch! Original: ${originalCount}, Current: ${products.length}. NOT saving to prevent data loss.`);
    }

    logger.success(
      `✅ Check complete: ${checked} checked, ${updated} updated, ${errors} errors`
    );

    return { checked, updated, errors };
  }

  /**
   * Check single product - IMPROVED WITH CUSTOM SELECTOR SUPPORT
   */
  async function checkSingleProduct(product) {
    try {
      // Use centralized validation if available
      if (
        typeof Validators !== "undefined" &&
        !Validators.isValidProductInfo(product)
      ) {
        throw new Error("Invalid product data");
      }

      logger.info(
        `🔍 Checking: ${PriceTrackerHelpers.truncate(product.name, 40)}`
      );

      try {
        await rateLimiter.checkLimit();
      } catch (rateLimitError) {
        logger.warn("⚠️ Rate limit, waiting...");
        await PriceTrackerHelpers.wait(2000);
      }

      // IMPROVED: Try custom selector first if available
      let newPriceData = null;

      // Check if custom selector exists for this domain
      const domain = new URL(product.url).hostname.replace(/^www\./, "");
      const customSelectorData = await browser.storage.sync.get(domain);

      if (customSelectorData[domain] && customSelectorData[domain].selector) {
        logger.info(`🎯 Using custom selector for ${domain}`);
        try {
          newPriceData = await fetchProductPriceWithSelector(
            product.url,
            customSelectorData[domain].selector
          );
        } catch (e) {
          logger.warn("Custom selector failed, falling back to parser:", e);
        }
      }

      // Fallback to normal parsing if custom selector failed or not available
      if (!newPriceData || !newPriceData.price) {
        newPriceData = await fetchProductPrice(product.url);
      }

      if (!newPriceData || !newPriceData.price) {
        logger.warn(`⚠️ Could not fetch price for: ${product.name}`);
        product.lastCheck = Date.now();
        product.lastCheckStatus = "failed";
        return { updated: false, product };
      }

      const newPrice = parseFloat(newPriceData.price);
      const oldPrice = parseFloat(product.price);

      if (isNaN(newPrice) || newPrice <= 0) {
        logger.warn(`⚠️ Invalid new price: ${newPriceData.price}`);
        product.lastCheck = Date.now();
        product.lastCheckStatus = "failed";
        return { updated: false, product };
      }

      const hasChanged = Math.abs(newPrice - oldPrice) > 0.01;

      if (hasChanged) {
        logger.info(
          `📊 Price changed: ${oldPrice} → ${newPrice} ${product.currency}`
        );

        if (!Array.isArray(product.priceHistory)) {
          product.priceHistory = [];
        }

        product.priceHistory.push({
          price: oldPrice,
          date: product.lastCheck || Date.now(),
        });

        if (product.priceHistory.length > 30) {
          product.priceHistory = product.priceHistory.slice(-30);
        }

        product.previousPrice = oldPrice;
        product.price = newPrice;
        product.lastCheck = Date.now();
        product.lastCheckStatus = "success";

        if (newPriceData.name && newPriceData.name.length > 10) {
          product.name = newPriceData.name;
        }

        if (settings.notifications) {
          await sendPriceNotification(product, oldPrice, newPrice);
        }

        return { updated: true, product };
      } else {
        product.lastCheck = Date.now();
        product.lastCheckStatus = "success";
        return { updated: false, product };
      }
    } catch (error) {
      logger.error(`❌ Error checking product:`, error);
      product.lastCheck = Date.now();
      product.lastCheckStatus = "error";
      product.lastError = error.message;
      return { updated: false, product };
    }
  }

  /**
   * NEW: Fetch product price using custom selector
   */
  async function fetchProductPriceWithSelector(url, selector) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000);

      const response = await fetch(url, {
        method: "GET",
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
          Accept:
            "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "Accept-Language": "tr-TR,tr;q=0.9,en-US;q=0.8,en;q=0.7",
          "Cache-Control": "no-cache",
        },
        cache: "no-store",
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const html = await response.text();
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, "text/html");

      // Use custom selector
      const element = doc.querySelector(selector);
      if (!element) {
        throw new Error("Selector element not found");
      }

      const text = element.textContent.trim();
      const priceMatch = text.match(/[\d.,]+/);

      if (!priceMatch) {
        throw new Error("Price not found in element");
      }

      const price = SiteConfigs.cleanPrice(priceMatch[0]);

      // Try to get product name from nearby h1 or title
      let name = doc.querySelector("h1")?.textContent.trim() || doc.title;

      return {
        price: price,
        name: name,
        currency: "TRY",
        url: url,
        confidence: 0.9,
        method: "custom-selector",
      };
    } catch (error) {
      logger.error("Custom selector fetch error:", error);
      throw error;
    }
  }

  /**
   * Fetch product price using parser or Go backend
   */
  async function fetchProductPrice(url) {
    const cached = cache.get(url);
    if (cached !== undefined) {
      logger.info("💾 Cache hit");
      return cached;
    }

    if (pendingRequests.has(url)) {
      logger.info("⏳ Reusing pending request");
      return await pendingRequests.get(url);
    }

    const requestPromise = (async () => {
      // IMPROVED: Try Go backend first if available
      if (typeof NativeMessaging !== "undefined") {
        try {
          const goResult = await NativeMessaging.fetchProductPrice(url, true);
          if (goResult && goResult.price) {
            logger.success("✅ Got product from Go backend");
            cache.set(url, goResult);
            return goResult;
          }
        } catch (error) {
          logger.warn(
            "⚠️ Go backend failed, falling back to browser:",
            error.message
          );
        }
      }

      // Fallback to browser-based fetching
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 15000);

        const response = await fetch(url, {
          method: "GET",
          headers: {
            "User-Agent":
              "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            Accept:
              "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            "Accept-Language": "tr-TR,tr;q=0.9,en-US;q=0.8,en;q=0.7",
            "Cache-Control": "no-cache",
          },
          cache: "no-store",
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        const html = await response.text();

        if (!html || html.length < 100) {
          throw new Error("Invalid HTML response");
        }

        const parser = new DOMParser();
        const doc = parser.parseFromString(html, "text/html");

        const productInfo =
          typeof PriceParser !== "undefined"
            ? await PriceParser.extractProductInfo(doc, url)
            : null;

        if (productInfo && productInfo.price) {
          const price = parseFloat(productInfo.price);
          if (isNaN(price) || price <= 0) {
            throw new Error("Invalid price value");
          }
          productInfo.price = price;
        }

        if (productInfo) {
          cache.set(url, productInfo);
        }

        return productInfo;
      } catch (error) {
        if (error.name === "AbortError") {
          logger.error("⏱️ Request timeout");
          throw new Error("Request timeout");
        }
        logger.error("🔴 Fetch error:", error);
        throw error;
      } finally {
        pendingRequests.delete(url);
      }
    })();

    pendingRequests.set(url, requestPromise);
    return await requestPromise;
  }

  /**
   * Send notification
   */
  async function sendPriceNotification(product, oldPrice, newPrice) {
    const change = PriceTrackerHelpers.calculateChange(oldPrice, newPrice);

    if (
      settings.minChangePercent &&
      Math.abs(change.percent) < settings.minChangePercent
    ) {
      logger.info(
        `⭐ Change too small (${change.percentFormatted}), skipping notification`
      );
      return;
    }

    if (change.isIncrease && !settings.notifyOnPriceUp) return;
    if (change.isDecrease && !settings.notifyOnPriceDown) return;

    const title = change.isDecrease ? "🎉 Fiyat Düştü!" : "📈 Fiyat Arttı";
    const icon = change.isDecrease ? "🔻" : "🔺";

    const message = [
      PriceTrackerHelpers.truncate(product.name, 60),
      `${oldPrice.toFixed(2)} → ${newPrice.toFixed(2)} ${product.currency}`,
      `${icon} ${change.percentFormatted}`,
    ].join("\n");

    try {
      await browser.notifications.create({
        type: "basic",
        iconUrl: browser.runtime.getURL("icons/icon48.png"),
        title: title,
        message: message,
        priority: change.isDecrease ? 2 : 1,
      });

      logger.info("🔔 Notification sent");
    } catch (error) {
      logger.error("Notification error:", error);
    }
  }

  /**
   * FIXED: Message handler with proper error handling
   */
  browser.runtime.onMessage.addListener((request, sender, sendResponse) => {
    const handleAsync = async () => {
      try {
        console.log("[Background] Message received:", request.action);

        switch (request.action) {
          case "checkAllPrices":
            const allResult = await checkAllPrices();
            console.log("[Background] Check all result:", allResult);
            return allResult;

          case "checkSingleProduct":
            if (!request.product) {
              throw new Error("Product data missing");
            }
            console.log("[Background] Checking product:", request.product.name);
            const singleResult = await checkSingleProduct(request.product);
            console.log("[Background] Check single result:", singleResult);
            return singleResult;

          case "updateSettings":
            console.log(
              "[Background] Update settings request:",
              request.settings
            );
            const saved = await saveSettings(request.settings);

            if (saved) {
              if (request.settings.rateLimitPerHour) {
                if (
                  typeof PriceTrackerHelpers !== "undefined" &&
                  PriceTrackerHelpers.createRateLimiter
                ) {
                  rateLimiter = PriceTrackerHelpers.createRateLimiter(
                    settings.rateLimitPerHour,
                    60 * 60 * 1000
                  );
                }
              }

              if (
                request.settings.checkInterval !== undefined ||
                request.settings.autoCheck !== undefined
              ) {
                if (settings.autoCheck) {
                  await setupAlarm();
                } else {
                  await browser.alarms.clear("checkPrices");
                }
              }
            }

            return { success: saved, settings: settings };

          case "getSettings":
            console.log(
              "[Background] Get settings request, returning:",
              settings
            );
            return settings || DEFAULT_SETTINGS;

          case "getDebugStats":
            const trackedProducts = await PriceTrackerHelpers.getStorage(
              "trackedProducts",
              []
            );
            return {
              productsCount: trackedProducts.length,
              cacheSize: cache.size(),
              settings: settings,
              rateLimit: rateLimiter ? rateLimiter.getTokens() : 0,
            };

          case "clearCache":
            cache.clear();
            logger.info("🧹 Cache cleared");
            return { success: true };

          case "productDetected":
            logger.info("📦 Product detected:", request.product?.name);
            return { received: true };

          case "manualPriceSelected":
            logger.info("🎯 Manual price selected:", request.data);
            if (request.data) {
              const { text, price, url, selector, name, site, domain: domainFromPicker } = request.data;
              logger.success(
                `Manual selection saved: ${text} (${price}) for ${url}`
              );

              // FIXED: Actually save the price to tracked products
              try {
                const trackedProducts = await PriceTrackerHelpers.getStorage("trackedProducts", []);
                
                // Parse the price - handle Turkish format (1.299,00) properly
                let parsedPrice = null;
                if (price) {
                  // Price should already be in correct format from picker (e.g., "1299.00")
                  parsedPrice = parseFloat(price);
                  if (isNaN(parsedPrice)) {
                    // Fallback: try to parse with cleanup
                    const cleanPrice = price.replace(/[^\d.,]/g, '');
                    // Check if Turkish format
                    if (cleanPrice.includes('.') && cleanPrice.includes(',')) {
                      parsedPrice = parseFloat(cleanPrice.replace(/\./g, '').replace(',', '.'));
                    } else if (cleanPrice.includes(',')) {
                      parsedPrice = parseFloat(cleanPrice.replace(',', '.'));
                    } else {
                      parsedPrice = parseFloat(cleanPrice);
                    }
                  }
                }
                
                if (parsedPrice && parsedPrice > 0) {
                  // Find if product already exists
                  const existingIndex = trackedProducts.findIndex(p => p.url === url);
                  
                  // Get domain from URL if not provided
                  const extractedDomain = domainFromPicker || new URL(url).hostname.replace(/^www\./, '');
                  const siteName = site || SiteConfigs?.getSiteConfig(extractedDomain)?.name || extractedDomain;
                  
                  if (existingIndex >= 0) {
                    // Update existing product
                    const existingProduct = trackedProducts[existingIndex];
                    const oldPrice = existingProduct.price;
                    
                    // Add to price history
                    if (!Array.isArray(existingProduct.priceHistory)) {
                      existingProduct.priceHistory = [];
                    }
                    existingProduct.priceHistory.push({
                      price: oldPrice,
                      date: existingProduct.lastCheck || Date.now(),
                    });
                    
                    if (existingProduct.priceHistory.length > 30) {
                      existingProduct.priceHistory = existingProduct.priceHistory.slice(-30);
                    }
                    
                    existingProduct.previousPrice = oldPrice;
                    existingProduct.price = parsedPrice;
                    existingProduct.lastCheck = Date.now();
                    existingProduct.lastCheckStatus = "success";
                    existingProduct.customSelector = selector;
                    existingProduct.site = siteName;
                    existingProduct.domain = extractedDomain;
                    
                    // Update name if provided and better
                    if (name && name.length > 5 && (!existingProduct.name || existingProduct.name === "Manuel Eklenen Ürün")) {
                      existingProduct.name = name;
                    }
                    
                    trackedProducts[existingIndex] = existingProduct;
                    
                    logger.info(`📊 Updated existing product price: ${oldPrice} → ${parsedPrice}`);
                    
                    // Send notification if price changed significantly
                    if (settings.notifications && Math.abs(parsedPrice - oldPrice) > 0.01) {
                      await sendPriceNotification(existingProduct, oldPrice, parsedPrice);
                    }
                  } else {
                    // Check maximum product limit before adding new product
                    const maxProducts = (typeof Config !== "undefined" && Config.VALIDATION?.MAX_PRODUCTS) || 50;
                    if (trackedProducts.length >= maxProducts) {
                      logger.warn(`⚠️ Maximum product limit reached (${maxProducts})`);
                      // Still continue but don't add the product
                    } else {
                      // Add as new product with proper name and site
                      const productName = name || text.substring(0, 100) || "Manuel Eklenen Ürün";
                      
                      const newProduct = {
                        name: productName,
                        price: parsedPrice,
                        currency: "TRY",
                        url: url,
                        site: siteName,
                        domain: extractedDomain,
                        initialPrice: parsedPrice,
                        previousPrice: null,
                        priceHistory: [],
                        addedDate: Date.now(),
                        lastCheck: Date.now(),
                        lastCheckStatus: "success",
                        confidence: 0.9,
                        customSelector: selector,
                      };
                      
                      trackedProducts.push(newProduct);
                      logger.info(`📦 Added new product: ${newProduct.name} at ${parsedPrice} from ${siteName}`);
                    }
                  }
                  
                  // Save to storage
                  await PriceTrackerHelpers.setStorage("trackedProducts", trackedProducts);
                  logger.success("✅ Products saved to storage");
                } else {
                  logger.warn("⚠️ Invalid price value:", price);
                }
              } catch (e) {
                logger.error("❌ Error saving product:", e);
              }

              // Notify content script about the result
              try {
                const tabs = await browser.tabs.query({
                  active: true,
                  currentWindow: true,
                });
                if (tabs[0]) {
                  browser.tabs
                    .sendMessage(tabs[0].id, {
                      action: "manualPriceResult",
                      data: request.data,
                    })
                    .catch(() => {});
                }
              } catch (e) {
                // Ignore errors when notifying
              }
            }
            return { success: true };

          // Price Alert handlers
          case "addAlert":
            if (typeof PriceAlerts !== "undefined") {
              const newAlert = await PriceAlerts.addAlert(request.alertData);
              logger.info("🔔 Alert added:", newAlert.id);
              return { success: true, alert: newAlert };
            }
            return { success: false, error: "Alerts not available" };

          case "removeAlert":
            if (typeof PriceAlerts !== "undefined") {
              await PriceAlerts.removeAlert(request.alertId);
              logger.info("🗑️ Alert removed:", request.alertId);
              return { success: true };
            }
            return { success: false, error: "Alerts not available" };

          case "getAlerts":
            if (typeof PriceAlerts !== "undefined") {
              const alerts = request.productUrl
                ? await PriceAlerts.getAlertsForProduct(request.productUrl)
                : await PriceAlerts.loadAlerts();
              return { success: true, alerts };
            }
            return { success: true, alerts: [] };

          case "toggleAlert":
            if (typeof PriceAlerts !== "undefined") {
              await PriceAlerts.toggleAlert(request.alertId);
              return { success: true };
            }
            return { success: false, error: "Alerts not available" };

          case "checkAlerts":
            const triggeredAlerts = await checkPriceAlerts();
            return { success: true, triggered: triggeredAlerts };

          // Data management handlers
          case "exportData":
            if (typeof DataManager !== "undefined") {
              const exportData = await DataManager.exportAll();
              return { success: true, data: exportData };
            }
            return { success: false, error: "DataManager not available" };

          case "importData":
            if (typeof DataManager !== "undefined") {
              const importResult = await DataManager.importData(request.data, request.options);
              return { success: true, result: importResult };
            }
            return { success: false, error: "DataManager not available" };

          case "getStorageStats":
            if (typeof DataManager !== "undefined") {
              const stats = await DataManager.getStorageStats();
              return { success: true, stats };
            }
            return { success: false, error: "DataManager not available" };

          case "createBackup":
            if (typeof DataManager !== "undefined") {
              await DataManager.createAutoBackup();
              return { success: true };
            }
            return { success: false, error: "DataManager not available" };

          case "listBackups":
            if (typeof DataManager !== "undefined") {
              const backups = await DataManager.listAutoBackups();
              return { success: true, backups };
            }
            return { success: true, backups: [] };

          case "restoreBackup":
            if (typeof DataManager !== "undefined") {
              await DataManager.restoreFromAutoBackup(request.backupKey);
              return { success: true };
            }
            return { success: false, error: "DataManager not available" };

          default:
            throw new Error(`Unknown action: ${request.action}`);
        }
      } catch (error) {
        console.error("[Background] Handler error:", error);
        return { error: error.message };
      }
    };

    handleAsync()
      .then((result) => {
        console.log("[Background] Sending response:", result);
        sendResponse(result);
      })
      .catch((error) => {
        console.error("[Background] Response error:", error);
        sendResponse({ error: error.message });
      });

    return true;
  });

  /**
   * Installation
   */
  browser.runtime.onInstalled.addListener(async (details) => {
    if (details.reason === "install") {
      logger.success("🎉 Price Tracker Pro installed!");
      await saveSettings(DEFAULT_SETTINGS);
      browser.notifications.create({
        type: "basic",
        iconUrl: browser.runtime.getURL("icons/icon48.png"),
        title: "Fiyat Takipçisi Pro",
        message: "Eklenti kuruldu! Bir ürün sayfasına gidip sağ tıklayın.",
      });
    } else if (details.reason === "update") {
      logger.success(`⬆️ Updated to ${browser.runtime.getManifest().version}`);
      await loadSettings();
    }
    await initialize();
  });

  /**
   * Startup
   */
  browser.runtime.onStartup.addListener(async () => {
    logger.info("🚀 Browser started");
    await initialize();
  });

  // Initial load
  initialize();
})();
