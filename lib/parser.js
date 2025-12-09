// Enhanced Price Parser v4.1 - Intelligent Multi-Strategy Detection
// Comprehensive price extraction with confidence scoring

const PriceParser = (() => {
  "use strict";

  // Configuration constants
  const CONFIG = Object.freeze({
    MAX_PRICE: 10000000,        // Maximum allowed price value
    MIN_PRICE: 0.01,            // Minimum allowed price value
    MAX_NAME_LENGTH: 200,       // Maximum product name length
    MIN_NAME_LENGTH: 3,         // Minimum product name length
    MAX_TEXT_LENGTH: 100,       // Maximum text to process for price
    EXTRACTION_TIMEOUT: 5000,   // Maximum extraction time in ms
    MAX_CANDIDATES: 100,        // Maximum price candidates to process
    DEBUG_MODE: false,          // Enable verbose logging
  });

  // Rate-limited logger to prevent console flooding
  const logger = (() => {
    const logCounts = new Map();
    const LOG_LIMIT = 50;
    const RESET_INTERVAL = 10000;

    // Reset counts periodically
    setInterval(() => logCounts.clear(), RESET_INTERVAL);

    const shouldLog = (key) => {
      const count = logCounts.get(key) || 0;
      if (count >= LOG_LIMIT) return false;
      logCounts.set(key, count + 1);
      return true;
    };

    return {
      info: (...args) => CONFIG.DEBUG_MODE && shouldLog('info') && console.log("[PriceParser]", ...args),
      warn: (...args) => shouldLog('warn') && console.warn("[PriceParser]", ...args),
      error: (...args) => shouldLog('error') && console.error("[PriceParser]", ...args),
      success: (...args) => shouldLog('success') && console.log("[PriceParser] ✅", ...args),
    };
  })();

  /**
   * Validates and sanitizes URL
   * @param {string} url - URL to validate
   * @returns {string|null} - Sanitized URL or null if invalid
   */
  function validateUrl(url) {
    if (!url || typeof url !== 'string') return null;
    
    try {
      const parsed = new URL(url);
      // Only allow http and https protocols
      if (!['http:', 'https:'].includes(parsed.protocol)) {
        return null;
      }
      return parsed.href;
    } catch {
      return null;
    }
  }

  /**
   * Creates a timeout promise for extraction operations
   * @param {number} ms - Timeout in milliseconds
   * @returns {Promise} - Rejects after timeout
   */
  function createTimeout(ms) {
    return new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Extraction timeout')), ms)
    );
  }

  /**
   * Main extraction function
   */
  async function extractProductInfo(
    doc = document,
    url = window.location.href
  ) {
    logger.info("🔍 Starting enhanced extraction...");

    const startTime = performance.now();

    // Validate URL
    const validUrl = validateUrl(url);
    if (!validUrl) {
      logger.error("Invalid URL provided");
      return null;
    }

    try {
      // Wrap extraction with timeout
      const extractionPromise = performExtraction(doc, validUrl, startTime);
      
      return await Promise.race([
        extractionPromise,
        createTimeout(CONFIG.EXTRACTION_TIMEOUT)
      ]);
    } catch (error) {
      if (error.message === 'Extraction timeout') {
        logger.warn("⚠️ Extraction timed out");
      } else {
        logger.error("❌ Extraction error:", error.message);
      }
      return null;
    }
  }

  /**
   * Performs the actual extraction logic
   */
  async function performExtraction(doc, url, startTime) {
    // Get site configuration
    const siteConfig = SiteConfigs.getSiteConfig(url);

      if (!siteConfig) {
        throw new Error("Could not determine site configuration");
      }

      logger.info(`📍 Site: ${siteConfig.name} (${siteConfig.domain})`);

      // Strategy 1: Site-specific selectors (highest priority)
      let result = extractWithSiteConfig(doc, siteConfig, url);

      // Strategy 2: Schema.org microdata
      if (!result || result.confidence < 0.7) {
        logger.info("🔄 Trying schema.org extraction...");
        const schemaResult = extractFromSchema(doc, url);
        if (
          schemaResult &&
          (!result || schemaResult.confidence > result.confidence)
        ) {
          result = schemaResult;
        }
      }

      // Strategy 3: Advanced heuristic analysis
      if (!result || result.confidence < 0.6) {
        logger.info("🔄 Trying heuristic extraction...");
        const heuristicResult = extractWithHeuristics(doc, url);
        if (
          heuristicResult &&
          (!result || heuristicResult.confidence > result.confidence)
        ) {
          result = heuristicResult;
        }
      }

      // Strategy 4: JSON-LD structured data
      if (!result || result.confidence < 0.5) {
        logger.info("🔄 Trying JSON-LD extraction...");
        const jsonLdResult = extractFromJsonLd(doc, url);
        if (
          jsonLdResult &&
          (!result || jsonLdResult.confidence > result.confidence)
        ) {
          result = jsonLdResult;
        }
      }

      const elapsed = (performance.now() - startTime).toFixed(2);

      if (result && result.price) {
        logger.success(`Extraction complete in ${elapsed}ms:`, {
          price: result.price,
          name: result.name?.substring(0, 50) + "...",
          confidence: `${(result.confidence * 100).toFixed(0)}%`,
          method: result.method,
        });
        return result;
      }

      logger.warn(`⚠️ No product found after ${elapsed}ms`);
      return null;
  }

  /**
   * Strategy 1: Extract using site-specific configuration
   */
  function extractWithSiteConfig(doc, config, url) {
    logger.info("🎯 Using site-specific selectors...");

    if (!doc || !config || !config.selectors) {
      logger.warn("⚠️ Invalid config or document");
      return null;
    }

    try {
      // Extract price
      const priceStr = SiteConfigs.extractValue(doc, config.selectors.price);
      const price = SiteConfigs.cleanPrice(priceStr);

      if (!isValidPrice(price)) {
        logger.warn("⚠️ No valid price found with site config");
        return null;
      }

      // Extract name
      const name = SiteConfigs.extractValue(doc, config.selectors.name);

      if (!isValidName(name)) {
        logger.warn("⚠️ No valid name found");
        return null;
      }

      // Extract previous price (optional)
      let previousPrice = null;
      if (config.selectors.previousPrice) {
        const prevStr = SiteConfigs.extractValue(
          doc,
          config.selectors.previousPrice
        );
        const prevPriceValue = SiteConfigs.cleanPrice(prevStr);
        if (isValidPrice(prevPriceValue)) {
          previousPrice = prevPriceValue;
        }
      }

      // Extract image (optional)
      let image = null;
      if (config.selectors.image) {
        image = sanitizeImageUrl(
          SiteConfigs.extractValue(doc, config.selectors.image),
          url
        );
      }

      return {
        name: cleanProductName(name),
        price: price,
        previousPrice: previousPrice,
        currency: config.currency || detectCurrency(priceStr) || "TRY",
        url: url,
        site: config.name,
        image: image,
        confidence: 0.95,
        method: "site-config",
      };
    } catch (error) {
      logger.error("Site config extraction error:", error.message);
      return null;
    }
  }

  /**
   * Validates a price value
   */
  function isValidPrice(price) {
    return typeof price === 'number' && 
           !Number.isNaN(price) && 
           Number.isFinite(price) &&
           price >= CONFIG.MIN_PRICE && 
           price <= CONFIG.MAX_PRICE;
  }

  /**
   * Validates a product name
   */
  function isValidName(name) {
    return typeof name === 'string' && 
           name.trim().length >= CONFIG.MIN_NAME_LENGTH;
  }

  /**
   * Sanitizes and validates image URL
   */
  function sanitizeImageUrl(imageUrl, baseUrl) {
    if (!imageUrl || typeof imageUrl !== 'string') return null;
    
    try {
      // Handle relative URLs
      if (!imageUrl.startsWith('http')) {
        imageUrl = new URL(imageUrl, baseUrl).href;
      }
      
      const parsed = new URL(imageUrl);
      // Only allow http/https image URLs
      if (!['http:', 'https:'].includes(parsed.protocol)) {
        return null;
      }
      
      return parsed.href;
    } catch {
      return null;
    }
  }

  /**
   * Strategy 2: Extract from Schema.org microdata
   */
  function extractFromSchema(doc, url) {
    logger.info("📋 Checking schema.org microdata...");

    if (!doc) return null;

    try {
      const priceEl = doc.querySelector('[itemprop="price"]');
      const nameEl = doc.querySelector('[itemprop="name"]');

      if (!priceEl || !nameEl) {
        return null;
      }

      const priceStr = priceEl.getAttribute("content") || priceEl.textContent;
      const price = SiteConfigs.cleanPrice(priceStr);

      if (!isValidPrice(price)) {
        return null;
      }

      const name = nameEl.textContent || nameEl.getAttribute("content");

      if (!isValidName(name)) {
        return null;
      }

      // Try to get currency
      let currency = "TRY";
      const currencyEl = doc.querySelector('[itemprop="priceCurrency"]');
      if (currencyEl) {
        const currencyValue = currencyEl.getAttribute("content") || currencyEl.textContent;
        currency = sanitizeCurrency(currencyValue);
      } else {
        currency = detectCurrency(priceStr);
      }

      return {
        name: cleanProductName(name),
        price: price,
        currency: currency,
        url: url,
        site: getSiteName(url),
        confidence: 0.85,
        method: "schema.org",
      };
    } catch (error) {
      logger.error("Schema extraction error:", error.message);
      return null;
    }
  }

  /**
   * Sanitizes currency code
   */
  function sanitizeCurrency(currency) {
    if (!currency || typeof currency !== 'string') return "TRY";
    
    // Only allow known currency codes
    const validCurrencies = ['TRY', 'USD', 'EUR', 'GBP', 'JPY', 'CNY', 'AED'];
    const normalized = currency.trim().toUpperCase().substring(0, 3);
    
    return validCurrencies.includes(normalized) ? normalized : "TRY";
  }

  /**
   * Strategy 3: Extract using advanced heuristics
   */
  function extractWithHeuristics(doc, url) {
    logger.info("🧠 Using heuristic analysis...");

    if (!doc) return null;

    try {
      // Find price candidates with limit
      const priceCandidates = findPriceCandidates(doc);

      if (priceCandidates.length === 0) {
        logger.warn("No price candidates found");
        return null;
      }

      // Score and rank candidates
      const scoredCandidates = priceCandidates
        .map((candidate) => ({
          ...candidate,
          score: scorePriceCandidate(candidate),
        }))
        .filter((c) => c.score > 0)
        .sort((a, b) => b.score - a.score);

      if (scoredCandidates.length === 0) {
        logger.warn("No valid price candidates after scoring");
        return null;
      }

      const bestCandidate = scoredCandidates[0];

      logger.info(
        `Best candidate: ${
          bestCandidate.price
        } (score: ${bestCandidate.score.toFixed(2)})`
      );

      // Find product name
      const name = findProductName(doc);

      if (!isValidName(name)) {
        logger.warn("Could not find product name");
        return null;
      }

      const confidence = Math.min(0.8, bestCandidate.score / 10);

      return {
        name: cleanProductName(name),
        price: bestCandidate.price,
        currency: bestCandidate.currency || "TRY",
        url: url,
        site: getSiteName(url),
        confidence: confidence,
        method: "heuristic",
      };
    } catch (error) {
      logger.error("Heuristic extraction error:", error.message);
      return null;
    }
  }

  /**
   * Strategy 4: Extract from JSON-LD structured data
   */
  function extractFromJsonLd(doc, url) {
    logger.info("📄 Checking JSON-LD data...");

    if (!doc) return null;

    try {
      const scripts = doc.querySelectorAll(
        'script[type="application/ld+json"]'
      );

      for (const script of scripts) {
        try {
          // Limit script content size to prevent DoS
          const content = script.textContent;
          if (!content || content.length > 100000) {
            continue;
          }

          const data = JSON.parse(content);

          // Validate parsed data structure
          if (!data || typeof data !== 'object') {
            continue;
          }

          // Handle arrays
          const items = Array.isArray(data) ? data.slice(0, 10) : [data];

          for (const item of items) {
            const result = extractProductFromJsonLd(item, url);
            if (result) return result;
          }
        } catch (parseError) {
          // Specific JSON parse errors are expected, don't log each one
          continue;
        }
      }

      return null;
    } catch (error) {
      logger.error("JSON-LD extraction error:", error.message);
      return null;
    }
  }

  /**
   * Extract product info from a JSON-LD item
   */
  function extractProductFromJsonLd(item, url) {
    if (!item || item["@type"] !== "Product" || !item.offers) {
      return null;
    }

    const offer = Array.isArray(item.offers) ? item.offers[0] : item.offers;
    
    if (!offer) return null;

    const priceValue = offer.price ?? offer.lowPrice;
    if (priceValue === undefined || priceValue === null) return null;

    const price = typeof priceValue === "number"
      ? priceValue
      : SiteConfigs.cleanPrice(String(priceValue));

    if (!isValidPrice(price)) return null;

    const name = typeof item.name === 'string' ? item.name : '';
    if (!isValidName(name)) return null;

    return {
      name: cleanProductName(name),
      price: price,
      currency: sanitizeCurrency(offer.priceCurrency),
      url: url,
      site: getSiteName(url),
      image: sanitizeImageUrl(
        Array.isArray(item.image) ? item.image[0] : item.image,
        url
      ),
      confidence: 0.9,
      method: "json-ld",
    };
  }

  /**
   * Find price candidates in the document
   */
  function findPriceCandidates(doc) {
    const candidates = [];
    const processed = new WeakSet(); // Use WeakSet to avoid memory leaks

    // Safer regex pattern with possessive-like behavior to prevent ReDoS
    // Matches prices like 1.234,56 or 1,234.56 or 1234
    const pricePattern = /(\d{1,3}(?:[.,]\d{3})*(?:[.,]\d{1,2})?|\d+(?:[.,]\d{1,2})?)\s*(?:TL|₺|TRY|USD|\$|EUR|€)?/g;

    // Keywords that indicate price
    const priceKeywords = [
      "price",
      "fiyat",
      "tutar",
      "ucret",
      "bedel",
      "cost",
      "amount",
      "sale",
      "indirim",
    ];

    // Find elements with price-related classes/attributes (more targeted)
    const priceElements = new Set();

    // Search by class/id with safe selectors
    for (const keyword of priceKeywords) {
      try {
        // Escape keyword for use in selector
        const safeKeyword = CSS.escape(keyword);
        const elements = doc.querySelectorAll(
          `[class*="${safeKeyword}"], [id*="${safeKeyword}"]`
        );
        for (const el of elements) {
          priceElements.add(el);
        }
      } catch {
        // Invalid selector, skip
      }
    }

    // Add elements with common price-related semantic tags (limited scope)
    const priceContainers = doc.querySelectorAll(
      '[data-price], [data-product-price], .price, .product-price, .current-price'
    );
    for (const el of priceContainers) {
      priceElements.add(el);
    }

    let processedCount = 0;

    for (const el of priceElements) {
      // Limit candidates to prevent performance issues
      if (processedCount >= CONFIG.MAX_CANDIDATES) break;

      // Skip if already processed or hidden
      if (processed.has(el) || !isVisible(el)) {
        continue;
      }

      processed.add(el);
      processedCount++;

      const text = (el.textContent || "").trim();

      // Skip if text is too long or too short
      if (text.length > CONFIG.MAX_TEXT_LENGTH || text.length < 2) {
        continue;
      }

      // Extract price with reset regex state
      pricePattern.lastIndex = 0;
      const matches = [...text.matchAll(pricePattern)];

      for (const match of matches) {
        const priceStr = match[1];
        const price = SiteConfigs.cleanPrice(priceStr);

        if (isValidPrice(price)) {
          candidates.push({
            element: el,
            price: price,
            text: text.substring(0, 50), // Limit stored text
            currency: detectCurrency(text),
            className: (el.className || "").substring(0, 100),
            id: (el.id || "").substring(0, 50),
          });
        }
      }
    }

    return candidates;
  }

  /**
   * Score price candidate
   */
  function scorePriceCandidate(candidate) {
    if (!candidate || !candidate.element) return 0;

    let score = 5; // Base score

    const className = String(candidate.className || "").toLowerCase();
    const id = String(candidate.id || "").toLowerCase();
    const combined = className + " " + id;

    // Positive indicators (increase score)
    if (/price|fiyat|checkout|current|final/i.test(combined)) {
      score += 3;
    }

    if (/sale|discount|indirim|kampanya/i.test(combined)) {
      score += 2;
    }

    if (/product|urun/i.test(combined)) {
      score += 1;
    }

    // Check element prominence (with error handling)
    try {
      const computedStyle = window.getComputedStyle(candidate.element);
      const fontSize = parseFloat(computedStyle.fontSize) || 0;
      const fontWeight = computedStyle.fontWeight || "400";

      if (fontSize > 20) {
        score += 2;
      } else if (fontSize > 16) {
        score += 1;
      }

      if (fontWeight === "bold" || parseInt(fontWeight, 10) >= 600) {
        score += 1;
      }
    } catch {
      // getComputedStyle may fail in some contexts
    }

    // Negative indicators (decrease score)
    if (/old|prev|was|regular|original|market|crossed/i.test(combined)) {
      score -= 3;
    }

    if (/shipping|cargo|kargo|vergi|tax|fee/i.test(combined)) {
      score -= 2;
    }

    if (/total|subtotal|cart/i.test(combined)) {
      score -= 1;
    }

    // Price range check (extreme values are suspicious)
    if (candidate.price < 1) {
      score -= 2;
    } else if (candidate.price > 1000000) {
      score -= 1;
    }

    return Math.max(0, score); // Ensure non-negative score
  }

  /**
   * Find product name
   */
  function findProductName(doc) {
    if (!doc) return null;

    // Try common patterns
    const selectors = [
      'h1[class*="product"]',
      'h1[class*="title"]',
      'h1[class*="name"]',
      '[class*="product"][class*="name"] h1',
      '[class*="product-title"]',
      "h1",
    ];

    for (const selector of selectors) {
      try {
        const el = doc.querySelector(selector);
        if (el) {
          const text = (el.textContent || "").trim();
          if (text.length >= CONFIG.MIN_NAME_LENGTH && text.length <= CONFIG.MAX_NAME_LENGTH) {
            return text;
          }
        }
      } catch {
        // Invalid selector
      }
    }

    // Fallback: use page title (sanitized)
    const pageTitle = doc.title || "";
    if (pageTitle.length >= CONFIG.MIN_NAME_LENGTH) {
      return pageTitle.substring(0, CONFIG.MAX_NAME_LENGTH);
    }

    return null;
  }

  /**
   * Check if element is visible
   * Handles fixed/sticky positioned elements correctly
   */
  function isVisible(el) {
    if (!el) return false;

    try {
      // Check if element is connected to DOM
      if (!el.isConnected) return false;

      const style = window.getComputedStyle(el);

      // Check basic visibility
      if (
        style.display === "none" ||
        style.visibility === "hidden" ||
        parseFloat(style.opacity) === 0
      ) {
        return false;
      }

      // Check if element has dimensions (more reliable than offsetParent)
      const rect = el.getBoundingClientRect();
      if (rect.width === 0 && rect.height === 0) {
        return false;
      }

      return true;
    } catch {
      return false;
    }
  }

  /**
   * Detect currency from text
   * Uses word boundaries to avoid false matches
   */
  function detectCurrency(text) {
    if (!text || typeof text !== 'string') return "TRY";

    // Check for currency symbols first (most reliable)
    if (text.includes("₺")) return "TRY";
    if (text.includes("$")) return "USD";
    if (text.includes("€")) return "EUR";
    if (text.includes("£")) return "GBP";

    // Check for currency codes with word boundaries
    const upperText = text.toUpperCase();
    if (/\bTRY\b/.test(upperText) || /\bTL\b/.test(upperText)) return "TRY";
    if (/\bUSD\b/.test(upperText)) return "USD";
    if (/\bEUR\b/.test(upperText)) return "EUR";
    if (/\bGBP\b/.test(upperText)) return "GBP";

    return "TRY"; // Default
  }

  /**
   * Clean product name
   */
  function cleanProductName(name) {
    if (!name || typeof name !== 'string') return null;

    return name
      .replace(/[\r\n\t]+/g, " ")  // Replace newlines/tabs with space
      .replace(/\s+/g, " ")         // Collapse multiple spaces
      .replace(/[|›»<>]/g, " ")     // Remove special chars
      .trim()
      .substring(0, CONFIG.MAX_NAME_LENGTH) || null;
  }

  /**
   * Get site name from URL
   */
  function getSiteName(url) {
    try {
      const hostname = new URL(url).hostname;
      const parts = hostname
        .replace(/^www\./, "")
        .split(".");
      
      // Get the main domain part
      const mainPart = parts.length > 2 ? parts[parts.length - 2] : parts[0];
      
      // Capitalize first letter
      return mainPart.charAt(0).toUpperCase() + mainPart.slice(1);
    } catch {
      return "Unknown";
    }
  }

  /**
   * Public API
   */
  return {
    extractProductInfo,
            // Expose config for testing
    get config() { return { ...CONFIG }; },
  };
})();

// Export for browser extension
if (typeof window !== "undefined") {
  window.PriceParser = PriceParser;
}


