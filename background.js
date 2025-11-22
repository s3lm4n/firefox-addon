// Fixed Background Script v3.1 - Settings synchronization fixed

(function () {
  "use strict";

  const logger = PriceTrackerHelpers.createLogger("Background");

  const DEFAULT_SETTINGS = {
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
  };

  let settings = null;
  let rateLimiter = null;

  const cache = new Map();
  const pendingRequests = new Map();

  /**
   * Load settings from storage
   */
  async function loadSettings() {
    try {
      // Try to load from storage
      const stored = await browser.storage.local.get("settings");

      if (stored.settings && typeof stored.settings === "object") {
        // Merge with defaults to ensure all keys exist
        settings = { ...DEFAULT_SETTINGS, ...stored.settings };
        logger.info("✅ Settings loaded from storage");
      } else {
        // Use defaults and save them
        settings = { ...DEFAULT_SETTINGS };
        await browser.storage.local.set({ settings: settings });
        logger.info("📝 Default settings initialized");
      }

      return settings;
    } catch (error) {
      logger.error("❌ Settings load error:", error);
      settings = { ...DEFAULT_SETTINGS };
      return settings;
    }
  }

  /**
   * Save settings to storage
   */
  async function saveSettings(newSettings) {
    try {
      settings = { ...settings, ...newSettings };
      await browser.storage.local.set({ settings: settings });
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
      // Load settings first
      await loadSettings();

      // Initialize rate limiter with loaded settings
      rateLimiter = PriceTrackerHelpers.createRateLimiter(
        settings.rateLimitPerHour,
        60 * 60 * 1000
      );

      // Setup alarm if auto-check is enabled
      if (settings.autoCheck) {
        await setupAlarm();
      }

      // Create context menu
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
   * Create context menu for manual price selection
   */
  async function createContextMenu() {
    try {
      // Remove existing menu items
      await browser.contextMenus.removeAll();

      // Create menu item
      await browser.contextMenus.create({
        id: "select-price-element",
        title: "🎯 Bu Öğeyi Fiyat Olarak Seç",
        contexts: ["all"],
        documentUrlPatterns: ["http://*/*", "https://*/*"],
      });

      logger.info("📋 Context menu created");
    } catch (error) {
      logger.error("Context menu creation error:", error);
    }
  }

  /**
   * Handle context menu clicks
   */
  browser.contextMenus.onClicked.addListener(async (info, tab) => {
    if (info.menuItemId === "select-price-element") {
      try {
        logger.info("🎯 Manual selector activated from context menu");

        // Inject picker script into the tab
        await browser.tabs.executeScript(tab.id, { file: "picker.js" });

        logger.success("✅ Picker injected successfully");
      } catch (error) {
        logger.error("❌ Picker injection failed:", error);

        // Show error notification
        browser.notifications.create({
          type: "basic",
          iconUrl: browser.runtime.getURL("icons/icon48.png"),
          title: "Hata",
          message: "Manuel seçici başlatılamadı. Lütfen sayfayı yenileyin.",
        });
      }
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
   * Listen for storage changes from settings page
   */
  browser.storage.onChanged.addListener(async (changes, areaName) => {
    if (areaName === "local" && changes.settings) {
      logger.info("⚙️ Settings changed, reloading...");

      const newSettings = changes.settings.newValue;

      if (newSettings) {
        settings = { ...DEFAULT_SETTINGS, ...newSettings };

        // Update rate limiter if needed
        if (
          changes.settings.oldValue?.rateLimitPerHour !==
          newSettings.rateLimitPerHour
        ) {
          rateLimiter = PriceTrackerHelpers.createRateLimiter(
            settings.rateLimitPerHour,
            60 * 60 * 1000
          );
          logger.info("🔄 Rate limiter updated");
        }

        // Update alarm if needed
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
    }
  });

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

    for (let i = 0; i < products.length; i++) {
      try {
        await PriceTrackerHelpers.wait(i * 2000); // 2s delay between products

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

    // Save all updates
    if (checked > 0) {
      await PriceTrackerHelpers.setStorage("trackedProducts", products);
    }

    logger.success(
      `✅ Check complete: ${checked} checked, ${updated} updated, ${errors} errors`
    );

    return { checked, updated, errors };
  }

  /**
   * Check single product
   */
  async function checkSingleProduct(product) {
    try {
      // Validate product
      if (!product || !product.url || !product.price) {
        throw new Error("Invalid product data");
      }

      logger.info(
        `🔍 Checking: ${PriceTrackerHelpers.truncate(product.name, 40)}`
      );

      // Rate limit
      try {
        await rateLimiter.checkLimit();
      } catch (rateLimitError) {
        logger.warn("⚠️ Rate limit, waiting...");
        await PriceTrackerHelpers.wait(2000);
      }

      // Fetch price
      const newPriceData = await fetchProductPrice(product.url);

      if (!newPriceData || !newPriceData.price) {
        logger.warn(`⚠️ Could not fetch price for: ${product.name}`);
        product.lastCheck = Date.now();
        product.lastCheckStatus = "failed";
        return { updated: false, product };
      }

      const newPrice = parseFloat(newPriceData.price);
      const oldPrice = parseFloat(product.price);

      // Validate new price
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

        // Initialize price history
        if (!Array.isArray(product.priceHistory)) {
          product.priceHistory = [];
        }

        // Add to history
        product.priceHistory.push({
          price: oldPrice,
          date: product.lastCheck || Date.now(),
        });

        // Keep max 30 entries
        if (product.priceHistory.length > 30) {
          product.priceHistory = product.priceHistory.slice(-30);
        }

        // Update product
        product.previousPrice = oldPrice;
        product.price = newPrice;
        product.lastCheck = Date.now();
        product.lastCheckStatus = "success";

        // Update name if changed
        if (newPriceData.name && newPriceData.name.length > 10) {
          product.name = newPriceData.name;
        }

        // Send notification
        if (settings.notifications) {
          await sendPriceNotification(product, oldPrice, newPrice);
        }

        return { updated: true, product };
      } else {
        // No change
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
   * Fetch product price
   */
  async function fetchProductPrice(url) {
    // Check cache
    if (cache.has(url)) {
      const cached = cache.get(url);
      if (Date.now() - cached.timestamp < 300000) {
        // 5 min cache
        logger.info("💾 Cache hit");
        return cached.data;
      }
      cache.delete(url);
    }

    // Check pending requests
    if (pendingRequests.has(url)) {
      logger.info("⏳ Reusing pending request");
      return await pendingRequests.get(url);
    }

    const requestPromise = (async () => {
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

        const productInfo = await PriceParser.extractProductInfo(doc, url);

        // Validate
        if (productInfo && productInfo.price) {
          const price = parseFloat(productInfo.price);
          if (isNaN(price) || price <= 0) {
            throw new Error("Invalid price value");
          }
          productInfo.price = price;
        }

        // Cache result
        if (productInfo) {
          cache.set(url, { data: productInfo, timestamp: Date.now() });
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

    // Check minimum change percentage
    if (
      settings.minChangePercent &&
      Math.abs(change.percent) < settings.minChangePercent
    ) {
      logger.info(
        `⏭️ Change too small (${change.percentFormatted}), skipping notification`
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
   * Message handler
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
            const saved = await saveSettings(request.settings);

            if (saved) {
              // Update rate limiter if needed
              if (request.settings.rateLimitPerHour) {
                rateLimiter = PriceTrackerHelpers.createRateLimiter(
                  settings.rateLimitPerHour,
                  60 * 60 * 1000
                );
              }

              // Update alarm if needed
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
            // Always return current settings from memory
            return settings || DEFAULT_SETTINGS;

          case "clearCache":
            cache.clear();
            logger.info("🧹 Cache cleared");
            return { success: true };

          case "productDetected":
            logger.info("📦 Product detected:", request.product?.name);
            return { received: true };

          default:
            throw new Error(`Unknown action: ${request.action}`);
        }
      } catch (error) {
        logger.error(`❌ Error handling ${request.action}:`, error);
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

    return true; // Keep channel open
  });

  /**
   * Installation
   */
  browser.runtime.onInstalled.addListener(async (details) => {
    if (details.reason === "install") {
      logger.success("🎉 Price Tracker Pro installed!");

      // Initialize default settings
      await saveSettings(DEFAULT_SETTINGS);

      browser.notifications.create({
        type: "basic",
        iconUrl: browser.runtime.getURL("icons/icon48.png"),
        title: "Fiyat Takipçisi Pro",
        message: "Eklenti kuruldu! Bir ürün sayfasına gidip takibe alın.",
      });
    } else if (details.reason === "update") {
      logger.success(`⬆️ Updated to ${browser.runtime.getManifest().version}`);

      // Reload settings after update
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
// Listen for storage changes to log updates
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "sync") {
    console.log("Selector güncellendi:", changes);
  }
});