// Enhanced Content Script v3.1 - FIXED PRICE DETECTION
// Better initialization, error handling, and price extraction

(function () {
  "use strict";

  // Verify this script loads only once
  if (window.__PRICE_TRACKER_LOADED__) {
    console.log("[Content] Already loaded, skipping");
    return;
  }
  window.__PRICE_TRACKER_LOADED__ = true;

  console.log("[Content] ✅ Script loading...", window.location.href);

  // Verify dependencies
  if (typeof PriceTrackerHelpers === "undefined") {
    console.error("[Content] ❌ PriceTrackerHelpers not loaded!");
    return;
  }
  if (typeof PriceParser === "undefined") {
    console.error("[Content] ❌ PriceParser not loaded!");
    return;
  }

  const logger = PriceTrackerHelpers.createLogger("Content");

  // State management
  const state = {
    extractionCache: null,
    cacheTimestamp: 0,
    lastUrl: window.location.href,
    extractionInProgress: false,
    retryCount: 0,
    maxRetries: Config.RETRY.MAX_RETRIES,
    lastMutationTime: 0,
    isReady: false,
  };

  // Configuration from centralized Config module
  const config = {
    cacheDuration: Config.CACHE.DURATION_MS,
    mutationDebounce: Config.MUTATION.DEBOUNCE_MS,
    dynamicCheckDelay: Config.CONTENT_TIMING.DYNAMIC_CHECK_DELAY_MS,
    slowSiteDelay: Config.CONTENT_TIMING.SLOW_SITE_DELAY_MS,
    initialCheckDelay: Config.CONTENT_TIMING.INITIAL_CHECK_DELAY_MS,
  };

  let mutationObserver = null;
  let dynamicCheckTimeout = null;
  let urlCheckInterval = null;
  let readyCheckTimeout = null;

  /**
   * Validate product info structure - uses centralized Validators
   */
  function isValidProductInfo(info) {
    const isValid = Validators.isValidProductInfo(info);
    if (!isValid && info) {
      logger.warn("Invalid product info detected");
    }
    return isValid;
  }

  /**
   * Extract product info with improved error handling
   */
  async function extractProductInfo(skipCache = false) {
    // Cache check
    const now = Date.now();
    if (
      !skipCache &&
      state.extractionCache &&
      now - state.cacheTimestamp < config.cacheDuration
    ) {
      logger.info("💾 Returning cached product info");
      return state.extractionCache;
    }

    // Prevent concurrent extractions
    if (state.extractionInProgress) {
      logger.info("⏳ Extraction already in progress, waiting...");
      await PriceTrackerHelpers.wait(500);
      return state.extractionCache;
    }

    state.extractionInProgress = true;
    logger.info("🔍 Starting product extraction...");

    try {
      // Call PriceParser
      const productInfo = await PriceParser.extractProductInfo();

      logger.info("📦 Parser returned:", productInfo);

      if (productInfo && productInfo.price) {
        // Validate extracted data
        if (!isValidProductInfo(productInfo)) {
          throw new Error("Invalid product info structure");
        }

        // Ensure numeric price
        productInfo.price = parseFloat(productInfo.price);

        // Cache successful result
        state.extractionCache = productInfo;
        state.cacheTimestamp = now;
        state.retryCount = 0;

        logger.success("✅ Product extracted:", {
          name: PriceTrackerHelpers.truncate(productInfo.name, 50),
          price: productInfo.price,
          currency: productInfo.currency,
          confidence: `${Math.round(productInfo.confidence * 100)}%`,
          site: productInfo.site,
        });

        // Notify background script
        notifyBackgroundScript(productInfo);

        return productInfo;
      } else {
        // No product found - maybe retry
        if (state.retryCount < state.maxRetries) {
          state.retryCount++;
          const delay = Config.RETRY.BASE_DELAY_MS * Math.pow(2, state.retryCount - 1);

          logger.warn(
            `⚠️ No product found, retrying in ${delay}ms (${state.retryCount}/${state.maxRetries})`
          );

          await PriceTrackerHelpers.wait(delay);
          state.extractionInProgress = false;
          return await extractProductInfo(true);
        }

        logger.warn("⚠️ No product info found after retries");
        return null;
      }
    } catch (error) {
      // Use centralized error handling
      PriceTrackerErrors.ErrorHandler.log(
        error instanceof PriceTrackerErrors.PriceTrackerError 
          ? error 
          : new PriceTrackerErrors.ExtractionError(error.message),
        "Content"
      );

      // Retry on error
      if (state.retryCount < state.maxRetries) {
        state.retryCount++;
        const delay = Config.RETRY.BASE_DELAY_MS * Math.pow(2, state.retryCount - 1);

        logger.info(
          `🔄 Retrying extraction in ${delay}ms (${state.retryCount}/${state.maxRetries})`
        );

        await PriceTrackerHelpers.wait(delay);
        state.extractionInProgress = false;
        return await extractProductInfo(true);
      }

      return null;
    } finally {
      state.extractionInProgress = false;
    }
  }

  /**
   * Setup enhanced MutationObserver
   */
  function setupMutationObserver() {
    if (mutationObserver) {
      mutationObserver.disconnect();
    }

    const targetNode = document.querySelector("main") || document.body;

    mutationObserver = new MutationObserver((mutations) => {
      const now = Date.now();

      // Debounce mutations
      if (now - state.lastMutationTime < config.mutationDebounce) {
        return;
      }

      // Check if mutations are price-related
      const hasRelevantChange = isRelevantMutation(mutations);

      if (hasRelevantChange) {
        state.lastMutationTime = now;
        logger.info("🔄 Relevant DOM change detected");
        clearCache();
        throttledExtraction();
      }
    });

    mutationObserver.observe(targetNode, {
      childList: true,
      subtree: true,
      characterData: true,
      attributes: true,
      attributeFilter: [
        "class",
        "data-testid",
        "data-price",
        "aria-label",
        "content",
      ],
    });

    logger.success("👀 MutationObserver setup complete");
  }

  /**
   * Throttled extraction for performance
   */
  const throttledExtraction = PriceTrackerHelpers.throttle(async () => {
    if (!state.extractionInProgress) {
      await extractProductInfo(true);
    }
  }, 1000);

  /**
   * Check if mutation is relevant to price tracking
   */
  function isRelevantMutation(mutations) {
    const priceKeywords = /price|fiyat|amount|cost|product|tutar|ucret|bedel/i;
    let relevantCount = 0;

    for (const mutation of mutations) {
      if (relevantCount > 5) return true;

      // Check added nodes
      if (mutation.addedNodes.length > 0) {
        for (const node of mutation.addedNodes) {
          if (node.nodeType !== Node.ELEMENT_NODE) continue;

          const el = node;
          const className = (el.className || "").toString().toLowerCase();
          const id = (el.id || "").toLowerCase();

          if (priceKeywords.test(className + id)) {
            relevantCount++;
            break;
          }

          if (el.querySelector) {
            const hasPriceChild = el.querySelector(
              '[class*="price"], [data-testid*="price"], [itemprop="price"]'
            );
            if (hasPriceChild) {
              relevantCount++;
              break;
            }
          }
        }
      }

      // Check character data changes
      if (mutation.type === "characterData") {
        const parent = mutation.target.parentElement;
        if (parent) {
          const className = (parent.className || "").toString().toLowerCase();
          if (priceKeywords.test(className)) {
            relevantCount++;
          }
        }
      }

      // Check attribute changes
      if (mutation.type === "attributes") {
        const attrName = mutation.attributeName;
        if (attrName && priceKeywords.test(attrName)) {
          relevantCount++;
        }
      }
    }

    return relevantCount > 0;
  }

  /**
   * Setup URL change detection for SPAs
   */
  function setupUrlChangeDetection() {
    const originalPushState = history.pushState;
    const originalReplaceState = history.replaceState;

    history.pushState = function (...args) {
      originalPushState.apply(this, args);
      onUrlChange();
    };

    history.replaceState = function (...args) {
      originalReplaceState.apply(this, args);
      onUrlChange();
    };

    window.addEventListener("popstate", onUrlChange);

    urlCheckInterval = setInterval(() => {
      const currentUrl = window.location.href;
      if (currentUrl !== state.lastUrl) {
        onUrlChange();
      }
    }, 1000);

    logger.success("🔗 URL change detection setup");
  }

  /**
   * Handle URL changes
   */
  function onUrlChange() {
    const currentUrl = window.location.href;

    if (currentUrl !== state.lastUrl) {
      logger.info("🌐 URL changed:", {
        from: PriceTrackerHelpers.truncate(state.lastUrl, 50),
        to: PriceTrackerHelpers.truncate(currentUrl, 50),
      });

      state.lastUrl = currentUrl;
      clearCache();
      state.retryCount = 0;
      scheduleDynamicCheck();
    }
  }

  /**
   * Schedule dynamic content check with smart delays
   */
  function scheduleDynamicCheck() {
    if (dynamicCheckTimeout) {
      clearTimeout(dynamicCheckTimeout);
    }

    const scriptCount = document.scripts.length;
    const domSize = document.querySelectorAll("*").length;
    const isSlow = scriptCount > 50 || domSize > 3000;

    const initialDelay = isSlow
      ? config.slowSiteDelay
      : config.dynamicCheckDelay;

    logger.info(
      `⏱️ Scheduling check in ${initialDelay}ms (${
        isSlow ? "slow" : "fast"
      } site)`
    );

    // Initial check
    dynamicCheckTimeout = setTimeout(async () => {
      logger.info("🔍 Performing dynamic content check...");
      const info = await extractProductInfo(true);

      if (info && info.price) {
        logger.success("✅ Product found on dynamic check");
      }
    }, initialDelay);

    // Additional check for slow sites
    if (isSlow) {
      setTimeout(async () => {
        if (!state.extractionCache || !state.extractionCache.price) {
          logger.info("🔍 Performing delayed check for slow site...");
          await extractProductInfo(true);
        }
      }, config.slowSiteDelay + 2000);
    }
  }

  /**
   * Clear extraction cache
   */
  function clearCache() {
    state.extractionCache = null;
    state.cacheTimestamp = 0;
    logger.info("🧹 Cache cleared");
  }

  /**
   * Notify background script - uses Messenger abstraction
   */
  async function notifyBackgroundScript(info) {
    try {
      await browser.runtime.sendMessage({
        action: Config.MESSAGE_ACTIONS.PRODUCT_DETECTED,
        product: info,
      });
      logger.info("📤 Product info sent to background");
    } catch (error) {
      logger.warn("⚠️ Could not send to background:", error.message);
    }
  }

  /**
   * Message listener with better error handling
   */
  browser.runtime.onMessage.addListener((request, sender, sendResponse) => {
    console.log("[Content] Message received:", request.action);

    const handleAsync = async () => {
      try {
        switch (request.action) {
          case Config.MESSAGE_ACTIONS.PING:
            console.log("[Content] Ping received, responding with pong");
            return { pong: true, loaded: true, ready: state.isReady };

          case Config.MESSAGE_ACTIONS.GET_PRODUCT_INFO:
            logger.info("📥 Product info requested by popup");
            const info = await extractProductInfo(request.skipCache || false);
            console.log("[Content] Returning product info:", info);
            return info;

          case Config.MESSAGE_ACTIONS.CLEAR_CACHE:
            logger.info("🧹 Cache clear requested");
            clearCache();
            return { success: true };

          case Config.MESSAGE_ACTIONS.FORCE_REFRESH:
            logger.info("🔄 Force refresh requested");
            clearCache();
            state.retryCount = 0;
            const refreshedInfo = await extractProductInfo(true);
            return refreshedInfo;

          case Config.MESSAGE_ACTIONS.GET_STATE:
            return {
              hasCache: !!state.extractionCache,
              cacheAge: Date.now() - state.cacheTimestamp,
              url: state.lastUrl,
              retryCount: state.retryCount,
              isReady: state.isReady,
            };

          default:
            throw new PriceTrackerErrors.ValidationError(`Unknown action: ${request.action}`);
        }
      } catch (error) {
        logger.error(`❌ Error handling ${request.action}:`, error);
        console.error("[Content] Handler error:", error);
        return { error: error.message };
      }
    };

    handleAsync()
      .then((result) => {
        console.log("[Content] Sending response:", result);
        sendResponse(result);
      })
      .catch((error) => {
        console.error("[Content] Response error:", error);
        sendResponse({ error: error.message });
      });

    return true; // Keep message channel open
  });

  /**
   * Check if page is valid for extraction - uses centralized Validators
   */
  function isValidPage() {
    return Validators.isValidPageForExtraction(window.location.href);
  }

  /**
   * Wait for page to be ready
   */
  function waitForReady() {
    return new Promise((resolve) => {
      if (document.readyState === "complete") {
        resolve();
        return;
      }

      const checkReady = () => {
        if (document.readyState === "complete") {
          window.removeEventListener("load", checkReady);
          resolve();
        }
      };

      window.addEventListener("load", checkReady);

      // Fallback timeout
      setTimeout(resolve, 5000);
    });
  }

  /**
   * Initialize content script
   */
  async function initialize() {
    logger.info("🚀 Initializing enhanced content script...");

    // Check if page is valid
    if (!isValidPage()) {
      logger.warn("⚠️ Invalid page for price extraction");
      return;
    }

    // Wait for page to be ready
    await waitForReady();

    logger.info("✅ Page ready, setting up...");

    // Setup URL change detection
    setupUrlChangeDetection();

    // Setup mutation observer
    setupMutationObserver();

    // Mark as ready
    state.isReady = true;

    // Schedule initial check with slight delay
    scheduleDynamicCheck();

    logger.success("✅ Enhanced content script initialized");
  }

  /**
   * Performance monitoring
   */
  window.addEventListener("load", () => {
    if (performance && performance.timing) {
      const timing = performance.timing;
      const loadTime = timing.loadEventEnd - timing.navigationStart;

      logger.info(`⚡ Page loaded in ${loadTime}ms`);

      // Additional check after full page load
      setTimeout(() => {
        if (!state.extractionCache || !state.extractionCache.price) {
          logger.info("🔍 Post-load extraction check...");
          extractProductInfo(true);
        }
      }, 500);
    }
  });

  /**
   * Cleanup on unload
   */
  window.addEventListener("beforeunload", () => {
    if (mutationObserver) {
      mutationObserver.disconnect();
    }
    if (dynamicCheckTimeout) {
      clearTimeout(dynamicCheckTimeout);
    }
    if (urlCheckInterval) {
      clearInterval(urlCheckInterval);
    }
    logger.info("🧹 Content script cleanup complete");
  });

  /**
   * Visibility change handling
   */
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") {
      logger.info("👁️ Page became visible");

      const cacheAge = Date.now() - state.cacheTimestamp;
      if (cacheAge > config.cacheDuration * 2) {
        logger.info("🔄 Cache stale, refreshing...");
        clearCache();
        scheduleDynamicCheck();
      }
    }
  });

  // Start initialization
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initialize);
  } else {
    initialize();
  }

  console.log("[Content] ✅ Script setup complete");
})();
