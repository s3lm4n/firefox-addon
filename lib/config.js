// Centralized Configuration Module v1.0
// Single source of truth for all configuration constants

const Config = (function () {
  "use strict";

  /**
   * Cache settings
   * @constant
   */
  const CACHE = {
    /** Content script cache duration in milliseconds */
    DURATION_MS: 5000,
    /** Background script cache duration in milliseconds */
    BACKGROUND_DURATION_MS: 300000,
  };

  /**
   * Retry settings
   * @constant
   */
  const RETRY = {
    /** Maximum number of retry attempts */
    MAX_RETRIES: 3,
    /** Base delay for exponential backoff in milliseconds */
    BASE_DELAY_MS: 1000,
  };

  /**
   * Extraction confidence thresholds
   * @constant
   */
  const CONFIDENCE = {
    /** High confidence threshold for site-specific selectors */
    HIGH: 0.95,
    /** Schema.org extraction confidence */
    SCHEMA_ORG: 0.85,
    /** Medium confidence threshold for schema.org extraction */
    MEDIUM: 0.7,
    /** Low confidence threshold for heuristic extraction */
    LOW: 0.6,
    /** Minimum acceptable confidence for JSON-LD extraction */
    MINIMUM: 0.5,
  };

  /**
   * Mutation observer settings
   * @constant
   */
  const MUTATION = {
    /** Debounce delay for mutation observer in milliseconds */
    DEBOUNCE_MS: 500,
  };

  /**
   * Network settings
   * @constant
   */
  const NETWORK = {
    /** Request timeout in milliseconds */
    REQUEST_TIMEOUT_MS: 15000,
    /** Rate limit per hour */
    RATE_LIMIT_PER_HOUR: 100,
    /** Default message timeout in milliseconds */
    MESSAGE_TIMEOUT_MS: 10000,
  };

  /**
   * UI settings
   * @constant
   */
  const UI = {
    /** Toast notification duration in milliseconds */
    TOAST_DURATION_MS: 3000,
    /** Search input debounce delay in milliseconds */
    SEARCH_DEBOUNCE_MS: 300,
  };

  /**
   * Default settings for the extension
   * @constant
   */
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

  /**
   * Content script timing settings
   * @constant
   */
  const CONTENT_TIMING = {
    /** Dynamic content check delay in milliseconds */
    DYNAMIC_CHECK_DELAY_MS: 1500,
    /** Delay for slow sites in milliseconds */
    SLOW_SITE_DELAY_MS: 3000,
    /** Initial check delay in milliseconds */
    INITIAL_CHECK_DELAY_MS: 1000,
  };

  /**
   * Product validation constraints
   * @constant
   */
  const VALIDATION = {
    /** Minimum product name length */
    MIN_NAME_LENGTH: 3,
    /** Maximum product name length */
    MAX_NAME_LENGTH: 200,
    /** Maximum price value */
    MAX_PRICE: 1000000,
    /** Minimum price value */
    MIN_PRICE: 0,
    /** Maximum price history entries */
    MAX_PRICE_HISTORY: 30,
  };

  /**
   * Message actions for inter-script communication
   * @constant
   */
  const MESSAGE_ACTIONS = {
    CHECK_ALL_PRICES: "checkAllPrices",
    CHECK_SINGLE_PRODUCT: "checkSingleProduct",
    GET_PRODUCT_INFO: "getProductInfo",
    UPDATE_SETTINGS: "updateSettings",
    GET_SETTINGS: "getSettings",
    GET_DEBUG_STATS: "getDebugStats",
    CLEAR_CACHE: "clearCache",
    PRODUCT_DETECTED: "productDetected",
    PING: "ping",
    FORCE_REFRESH: "forceRefresh",
    GET_STATE: "getState",
  };

  // Public API
  return {
    CACHE,
    RETRY,
    CONFIDENCE,
    MUTATION,
    NETWORK,
    UI,
    DEFAULT_SETTINGS,
    CONTENT_TIMING,
    VALIDATION,
    MESSAGE_ACTIONS,
  };
})();

// Export for browser extension
if (typeof window !== "undefined") {
  window.Config = Config;
}
