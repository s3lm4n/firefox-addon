// Shared Validation Module v1.0
// Unified validation functions for product data

const Validators = (function () {
  "use strict";

  /**
   * Validate a URL string
   * @param {string} url - URL to validate
   * @returns {boolean} True if valid HTTP(S) URL
   */
  function isValidUrl(url) {
    if (!url || typeof url !== "string") {
      return false;
    }
    try {
      const urlObj = new URL(url);
      return urlObj.protocol === "http:" || urlObj.protocol === "https:";
    } catch {
      return false;
    }
  }

  /**
   * Validate a price value
   * @param {number|string} price - Price to validate
   * @returns {boolean} True if valid positive number
   */
  function isValidPrice(price) {
    if (price === null || price === undefined) {
      return false;
    }
    const numPrice = parseFloat(price);
    if (isNaN(numPrice) || numPrice <= 0) {
      return false;
    }
    // Use Config if available, otherwise use sensible default
    const maxPrice =
      typeof Config !== "undefined" ? Config.VALIDATION.MAX_PRICE : 1000000;
    return numPrice <= maxPrice;
  }

  /**
   * Validate a product name
   * @param {string} name - Product name to validate
   * @returns {boolean} True if valid name
   */
  function isValidName(name) {
    if (!name || typeof name !== "string") {
      return false;
    }
    const trimmed = name.trim();
    // Use Config if available, otherwise use sensible defaults
    const minLength =
      typeof Config !== "undefined" ? Config.VALIDATION.MIN_NAME_LENGTH : 3;
    return trimmed.length >= minLength;
  }

  /**
   * Validate product info object structure
   * @param {Object} info - Product info object
   * @returns {boolean} True if valid product info
   */
  function isValidProductInfo(info) {
    if (!info || typeof info !== "object") {
      return false;
    }

    // Check price
    if (!isValidPrice(info.price)) {
      return false;
    }

    // Check name
    if (!isValidName(info.name)) {
      return false;
    }

    // Check URL
    if (!isValidUrl(info.url)) {
      return false;
    }

    // Check currency (optional but should be string if present)
    if (info.currency && typeof info.currency !== "string") {
      return false;
    }

    return true;
  }

  /**
   * Sanitize product data by ensuring all fields are valid
   * @param {Object} product - Raw product data
   * @returns {Object|null} Sanitized product or null if invalid
   */
  function sanitizeProductData(product) {
    if (!product || typeof product !== "object") {
      return null;
    }

    // Parse price to ensure it's a number
    const price = parseFloat(product.price);
    if (!isValidPrice(price)) {
      return null;
    }

    // Sanitize name
    const name = (product.name || "").toString().trim();
    if (!isValidName(name)) {
      return null;
    }

    // Validate URL
    if (!isValidUrl(product.url)) {
      return null;
    }

    // Get max name length from Config if available
    const maxNameLength =
      typeof Config !== "undefined" ? Config.VALIDATION.MAX_NAME_LENGTH : 200;

    return {
      name: name.substring(0, maxNameLength),
      price: price,
      previousPrice: product.previousPrice
        ? parseFloat(product.previousPrice)
        : null,
      initialPrice: product.initialPrice
        ? parseFloat(product.initialPrice)
        : price,
      currency: (product.currency || "TRY").toString().toUpperCase(),
      url: product.url,
      site: product.site || extractDomain(product.url),
      image: product.image || null,
      confidence: parseFloat(product.confidence) || 0.8,
      priceHistory: Array.isArray(product.priceHistory)
        ? product.priceHistory
        : [],
      addedDate: product.addedDate || Date.now(),
      lastCheck: product.lastCheck || null,
      lastCheckStatus: product.lastCheckStatus || null,
    };
  }

  /**
   * Extract domain from URL
   * @param {string} url - URL string
   * @returns {string} Domain name or empty string
   */
  function extractDomain(url) {
    try {
      const urlObj = new URL(url);
      return urlObj.hostname.replace("www.", "");
    } catch {
      return "";
    }
  }

  /**
   * Validate settings object
   * @param {Object} settings - Settings to validate
   * @returns {boolean} True if valid settings
   */
  function isValidSettings(settings) {
    if (!settings || typeof settings !== "object") {
      return false;
    }

    // Check numeric fields
    if (
      settings.checkInterval !== undefined &&
      (typeof settings.checkInterval !== "number" ||
        settings.checkInterval < 1 ||
        settings.checkInterval > 1440)
    ) {
      return false;
    }

    if (
      settings.maxRetries !== undefined &&
      (typeof settings.maxRetries !== "number" ||
        settings.maxRetries < 0 ||
        settings.maxRetries > 10)
    ) {
      return false;
    }

    if (
      settings.rateLimitPerHour !== undefined &&
      (typeof settings.rateLimitPerHour !== "number" ||
        settings.rateLimitPerHour < 1 ||
        settings.rateLimitPerHour > 1000)
    ) {
      return false;
    }

    return true;
  }

  /**
   * Validate page URL for extraction
   * @param {string} url - Page URL to validate
   * @returns {boolean} True if page is valid for extraction
   */
  function isValidPageForExtraction(url) {
    if (!url || typeof url !== "string") {
      return false;
    }

    // Skip internal browser pages
    if (
      url.startsWith("about:") ||
      url.startsWith("moz-") ||
      url.startsWith("chrome:") ||
      url.startsWith("file:")
    ) {
      return false;
    }

    // Only allow HTTP(S) pages
    return url.startsWith("http://") || url.startsWith("https://");
  }

  // Public API
  return {
    isValidUrl,
    isValidPrice,
    isValidName,
    isValidProductInfo,
    sanitizeProductData,
    isValidSettings,
    isValidPageForExtraction,
  };
})();

// Export for browser extension
if (typeof window !== "undefined") {
  window.Validators = Validators;
}
