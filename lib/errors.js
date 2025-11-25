// Custom Error Classes and Handlers v1.0
// Unified error handling for the extension

const PriceTrackerErrors = (function () {
  "use strict";

  /**
   * Base error class for Price Tracker
   * @extends Error
   */
  class PriceTrackerError extends Error {
    /**
     * @param {string} message - Error message
     * @param {string} code - Error code for categorization
     * @param {Object} context - Additional context data
     */
    constructor(message, code = "UNKNOWN", context = {}) {
      super(message);
      this.name = "PriceTrackerError";
      this.code = code;
      this.context = context;
      this.timestamp = Date.now();

      // Maintain proper stack trace in V8
      if (Error.captureStackTrace) {
        Error.captureStackTrace(this, this.constructor);
      }
    }

    /**
     * Convert error to JSON for logging/storage
     * @returns {Object} Serialized error object
     */
    toJSON() {
      return {
        name: this.name,
        message: this.message,
        code: this.code,
        context: this.context,
        timestamp: this.timestamp,
        stack: this.stack,
      };
    }
  }

  /**
   * Error for price extraction failures
   * @extends PriceTrackerError
   */
  class ExtractionError extends PriceTrackerError {
    /**
     * @param {string} message - Error message
     * @param {Object} context - Extraction context (url, method, etc.)
     */
    constructor(message, context = {}) {
      super(message, "EXTRACTION_ERROR", context);
      this.name = "ExtractionError";
    }
  }

  /**
   * Error for network failures
   * @extends PriceTrackerError
   */
  class NetworkError extends PriceTrackerError {
    /**
     * @param {string} message - Error message
     * @param {Object} context - Network context (url, status, etc.)
     */
    constructor(message, context = {}) {
      super(message, "NETWORK_ERROR", context);
      this.name = "NetworkError";
    }
  }

  /**
   * Error for validation failures
   * @extends PriceTrackerError
   */
  class ValidationError extends PriceTrackerError {
    /**
     * @param {string} message - Error message
     * @param {Object} context - Validation context (field, value, etc.)
     */
    constructor(message, context = {}) {
      super(message, "VALIDATION_ERROR", context);
      this.name = "ValidationError";
    }
  }

  /**
   * Error for rate limiting
   * @extends PriceTrackerError
   */
  class RateLimitError extends PriceTrackerError {
    /**
     * @param {string} message - Error message
     * @param {number} retryAfter - Suggested wait time in ms
     */
    constructor(message, retryAfter = 0) {
      super(message, "RATE_LIMIT_ERROR", { retryAfter });
      this.name = "RateLimitError";
      this.retryAfter = retryAfter;
    }
  }

  /**
   * Error for storage operations
   * @extends PriceTrackerError
   */
  class StorageError extends PriceTrackerError {
    /**
     * @param {string} message - Error message
     * @param {Object} context - Storage context (key, operation, etc.)
     */
    constructor(message, context = {}) {
      super(message, "STORAGE_ERROR", context);
      this.name = "StorageError";
    }
  }

  /**
   * Error handler for centralized error processing
   */
  const ErrorHandler = {
    /**
     * Handle an error with appropriate logging and recovery
     * @param {Error} error - Error to handle
     * @param {string} context - Context where error occurred
     * @param {Object} options - Handler options
     * @returns {Object} Error summary for response
     */
    handle(error, context = "Unknown", options = {}) {
      const { silent = false, notify = false } = options;

      // Convert to PriceTrackerError if needed
      const ptError =
        error instanceof PriceTrackerError
          ? error
          : new PriceTrackerError(error.message, "UNKNOWN", {
              originalError: error.name,
            });

      // Log the error
      if (!silent) {
        this.log(ptError, context);
      }

      // Send notification if requested
      if (notify && typeof browser !== "undefined") {
        this.notify(ptError);
      }

      return {
        error: true,
        code: ptError.code,
        message: ptError.message,
        context: context,
      };
    },

    /**
     * Log an error with consistent formatting
     * @param {PriceTrackerError} error - Error to log
     * @param {string} context - Context where error occurred
     */
    log(error, context = "") {
      const prefix = context ? `[${context}]` : "";
      const timestamp = new Date().toLocaleTimeString();

      console.error(
        `${prefix} [${timestamp}] ❌ ${error.name}: ${error.message}`,
        {
          code: error.code,
          context: error.context,
        }
      );

      if (error.stack && typeof console.debug === "function") {
        console.debug(error.stack);
      }
    },

    /**
     * Send browser notification for error
     * @param {PriceTrackerError} error - Error to notify about
     */
    async notify(error) {
      if (typeof browser === "undefined" || !browser.notifications) {
        return;
      }

      try {
        await browser.notifications.create({
          type: "basic",
          iconUrl: browser.runtime.getURL("icons/icon48.png"),
          title: "Fiyat Takipçisi - Hata",
          message: error.message,
        });
      } catch (notifyError) {
        console.error("Failed to send error notification:", notifyError);
      }
    },

    /**
     * Determine if error is recoverable
     * @param {Error} error - Error to check
     * @returns {boolean} True if error is recoverable
     */
    isRecoverable(error) {
      if (error instanceof RateLimitError) {
        return true;
      }
      if (error instanceof NetworkError) {
        return true;
      }
      if (error instanceof ExtractionError) {
        return true;
      }
      return false;
    },

    /**
     * Get recovery strategy for an error
     * @param {Error} error - Error to get strategy for
     * @returns {Object} Recovery strategy
     */
    getRecoveryStrategy(error) {
      if (error instanceof RateLimitError) {
        return {
          action: "wait",
          delay: error.retryAfter || 2000,
          maxRetries: 3,
        };
      }

      if (error instanceof NetworkError) {
        return {
          action: "retry",
          delay: 1000,
          maxRetries: 3,
          backoff: true,
        };
      }

      if (error instanceof ExtractionError) {
        return {
          action: "retry",
          delay: 500,
          maxRetries: 2,
          backoff: false,
        };
      }

      return {
        action: "fail",
        delay: 0,
        maxRetries: 0,
      };
    },
  };

  // Public API
  return {
    PriceTrackerError,
    ExtractionError,
    NetworkError,
    ValidationError,
    RateLimitError,
    StorageError,
    ErrorHandler,
  };
})();

// Export for browser extension
if (typeof window !== "undefined") {
  window.PriceTrackerErrors = PriceTrackerErrors;
}
