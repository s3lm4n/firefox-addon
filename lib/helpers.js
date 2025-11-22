// Enhanced Helpers Library v3.0
// Improved utilities, performance optimizations, and better error handling

const PriceTrackerHelpers = (function () {
  "use strict";

  /**
   * Logger with color coding and timestamps
   */
  function createLogger(context) {
    const colors = {
      info: "#3b82f6",
      success: "#22c55e",
      warn: "#f59e0b",
      error: "#ef4444",
    };

    const styles = {
      context: "font-weight: bold; color: #8b5cf6;",
      timestamp: "color: #9ca3af; font-size: 0.9em;",
    };

    return {
      info: (...args) => {
        console.log(
          `%c[${context}]%c [${new Date().toLocaleTimeString()}]`,
          styles.context,
          styles.timestamp,
          ...args
        );
      },
      success: (...args) => {
        console.log(
          `%c[${context}]%c [${new Date().toLocaleTimeString()}] ✅`,
          styles.context,
          styles.timestamp,
          ...args
        );
      },
      warn: (...args) => {
        console.warn(
          `%c[${context}]%c [${new Date().toLocaleTimeString()}] ⚠️`,
          styles.context,
          styles.timestamp,
          ...args
        );
      },
      error: (...args) => {
        console.error(
          `%c[${context}]%c [${new Date().toLocaleTimeString()}] ❌`,
          styles.context,
          styles.timestamp,
          ...args
        );
      },
    };
  }

  /**
   * Enhanced storage with validation and compression
   */
  async function getStorage(key, defaultValue = null) {
    try {
      const result = await browser.storage.local.get(key);

      if (result && result[key] !== undefined) {
        // Decompress if needed
        if (typeof result[key] === "object" && result[key].__compressed) {
          return JSON.parse(decompressString(result[key].data));
        }
        return result[key];
      }

      return defaultValue;
    } catch (error) {
      console.error(`Error getting storage key "${key}":`, error);
      return defaultValue;
    }
  }

  async function setStorage(key, value) {
    try {
      // Validate key
      if (typeof key !== "string" || key.length === 0) {
        throw new Error("Invalid storage key");
      }

      // Compress large data (>50KB)
      const serialized = JSON.stringify(value);
      const dataToStore =
        serialized.length > 50000
          ? { __compressed: true, data: compressString(serialized) }
          : value;

      await browser.storage.local.set({ [key]: dataToStore });
      return true;
    } catch (error) {
      console.error(`Error setting storage key "${key}":`, error);
      throw error;
    }
  }

  async function removeStorage(key) {
    try {
      await browser.storage.local.remove(key);
      return true;
    } catch (error) {
      console.error(`Error removing storage key "${key}":`, error);
      return false;
    }
  }

  /**
   * Simple string compression using RLE for repeated data
   */
  function compressString(str) {
    try {
      // Use LZ-based compression if available
      if (typeof pako !== "undefined") {
        return btoa(pako.deflate(str, { to: "string" }));
      }

      // Fallback: simple RLE
      let compressed = "";
      let count = 1;

      for (let i = 0; i < str.length; i++) {
        if (str[i] === str[i + 1]) {
          count++;
        } else {
          compressed += (count > 1 ? count : "") + str[i];
          count = 1;
        }
      }

      return compressed;
    } catch (error) {
      console.error("Compression error:", error);
      return str;
    }
  }

  function decompressString(str) {
    try {
      // Use LZ-based decompression if available
      if (typeof pako !== "undefined") {
        return pako.inflate(atob(str), { to: "string" });
      }

      // Fallback: simple RLE
      let decompressed = "";
      let numStr = "";

      for (let i = 0; i < str.length; i++) {
        if (/\d/.test(str[i])) {
          numStr += str[i];
        } else {
          const count = numStr ? parseInt(numStr) : 1;
          decompressed += str[i].repeat(count);
          numStr = "";
        }
      }

      return decompressed;
    } catch (error) {
      console.error("Decompression error:", error);
      return str;
    }
  }

  /**
   * Enhanced rate limiter with token bucket algorithm
   */
  function createRateLimiter(maxRequests, timeWindow) {
    let tokens = maxRequests;
    let lastRefill = Date.now();
    const refillRate = maxRequests / timeWindow;

    return {
      async checkLimit() {
        const now = Date.now();
        const timePassed = now - lastRefill;

        // Refill tokens
        tokens = Math.min(maxRequests, tokens + timePassed * refillRate);
        lastRefill = now;

        if (tokens < 1) {
          const waitTime = Math.ceil((1 - tokens) / refillRate);
          throw new Error(`Rate limit exceeded. Wait ${waitTime}ms`);
        }

        tokens -= 1;
        return true;
      },

      getTokens() {
        const now = Date.now();
        const timePassed = now - lastRefill;
        return Math.min(maxRequests, tokens + timePassed * refillRate);
      },

      reset() {
        tokens = maxRequests;
        lastRefill = Date.now();
      },
    };
  }

  /**
   * Enhanced price formatting with locale support
   */
  function formatPrice(price, currency = "TRY") {
    try {
      const num = parseFloat(price);
      if (isNaN(num)) return "0.00";

      const currencySymbols = {
        TRY: "₺",
        USD: "$",
        EUR: "€",
        GBP: "£",
      };

      const symbol = currencySymbols[currency] || currency;

      return `${num.toFixed(2)} ${symbol}`;
    } catch (error) {
      console.error("Price formatting error:", error);
      return `${price} ${currency}`;
    }
  }

  /**
   * Calculate price change with validation
   */
  function calculateChange(oldPrice, newPrice) {
    try {
      const old = parseFloat(oldPrice);
      const current = parseFloat(newPrice);

      if (isNaN(old) || isNaN(current)) {
        throw new Error("Invalid price values");
      }

      const difference = current - old;
      const percent = old !== 0 ? (difference / old) * 100 : 0;

      return {
        difference: difference,
        percent: percent,
        formatted: Math.abs(difference).toFixed(2),
        percentFormatted: `${percent >= 0 ? "+" : ""}${percent.toFixed(2)}%`,
        isIncrease: difference > 0,
        isDecrease: difference < 0,
        noChange: Math.abs(difference) < 0.01,
      };
    } catch (error) {
      console.error("Calculate change error:", error);
      return {
        difference: 0,
        percent: 0,
        formatted: "0.00",
        percentFormatted: "0.00%",
        isIncrease: false,
        isDecrease: false,
        noChange: true,
      };
    }
  }

  /**
   * Enhanced date formatting with relative time
   */
  function formatDate(timestamp) {
    try {
      const date = new Date(timestamp);
      if (isNaN(date.getTime())) {
        throw new Error("Invalid timestamp");
      }

      const now = new Date();
      const diff = now - date;
      const seconds = Math.floor(diff / 1000);
      const minutes = Math.floor(seconds / 60);
      const hours = Math.floor(minutes / 60);
      const days = Math.floor(hours / 24);

      if (seconds < 60) return "Az önce";
      if (minutes < 60) return `${minutes} dk önce`;
      if (hours < 24) return `${hours} saat önce`;
      if (days < 7) return `${days} gün önce`;

      return date.toLocaleDateString("tr-TR", {
        day: "numeric",
        month: "short",
        year: date.getFullYear() !== now.getFullYear() ? "numeric" : undefined,
      });
    } catch (error) {
      console.error("Date formatting error:", error);
      return "Bilinmiyor";
    }
  }

  /**
   * Get relative time string
   */
  function getRelativeTime(timestamp) {
    try {
      const now = Date.now();
      const diff = now - timestamp;
      const seconds = Math.floor(diff / 1000);
      const minutes = Math.floor(seconds / 60);
      const hours = Math.floor(minutes / 60);

      if (seconds < 10) return "Şimdi";
      if (seconds < 60) return `${seconds}s`;
      if (minutes < 60) return `${minutes}m`;
      if (hours < 24) return `${hours}h`;

      const days = Math.floor(hours / 24);
      return `${days}g`;
    } catch (error) {
      return "-";
    }
  }

  /**
   * Throttle function execution
   */
  function throttle(func, limit) {
    let inThrottle;
    let lastResult;

    return function (...args) {
      if (!inThrottle) {
        lastResult = func.apply(this, args);
        inThrottle = true;

        setTimeout(() => {
          inThrottle = false;
        }, limit);
      }

      return lastResult;
    };
  }

  /**
   * Debounce function execution
   */
  function debounce(func, delay) {
    let timeoutId;

    return function (...args) {
      clearTimeout(timeoutId);

      return new Promise((resolve) => {
        timeoutId = setTimeout(() => {
          resolve(func.apply(this, args));
        }, delay);
      });
    };
  }

  /**
   * Wait/sleep utility
   */
  function wait(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Truncate text with ellipsis
   */
  function truncate(text, maxLength = 50) {
    if (!text || typeof text !== "string") return "";
    if (text.length <= maxLength) return text;

    return text.substring(0, maxLength - 3) + "...";
  }

  /**
   * Escape HTML to prevent XSS
   */
  function escapeHtml(text) {
    if (!text) return "";

    const map = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;",
    };

    return String(text).replace(/[&<>"']/g, (m) => map[m]);
  }

  /**
   * Deep clone object
   */
  function deepClone(obj) {
    try {
      return JSON.parse(JSON.stringify(obj));
    } catch (error) {
      console.error("Deep clone error:", error);
      return obj;
    }
  }

  /**
   * Check if object is empty
   */
  function isEmpty(obj) {
    if (obj == null) return true;
    if (Array.isArray(obj) || typeof obj === "string") return obj.length === 0;
    if (typeof obj === "object") return Object.keys(obj).length === 0;
    return false;
  }

  /**
   * Validate URL
   */
  function isValidUrl(string) {
    try {
      const url = new URL(string);
      return url.protocol === "http:" || url.protocol === "https:";
    } catch {
      return false;
    }
  }

  /**
   * Extract domain from URL
   */
  function getDomain(url) {
    try {
      const urlObj = new URL(url);
      return urlObj.hostname.replace("www.", "");
    } catch {
      return "";
    }
  }

  /**
   * Generate unique ID
   */
  function generateId() {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Sanitize filename
   */
  function sanitizeFilename(filename) {
    return filename
      .replace(/[^a-z0-9_\-\.]/gi, "_")
      .replace(/_{2,}/g, "_")
      .toLowerCase();
  }

  /**
   * Format file size
   */
  function formatFileSize(bytes) {
    if (bytes === 0) return "0 Bytes";

    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + " " + sizes[i];
  }

  /**
   * Retry with exponential backoff
   */
  async function retryWithBackoff(fn, maxRetries = 3, baseDelay = 1000) {
    let lastError;

    for (let i = 0; i < maxRetries; i++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error;

        if (i < maxRetries - 1) {
          const delay = baseDelay * Math.pow(2, i);
          console.warn(`Retry ${i + 1}/${maxRetries} after ${delay}ms`);
          await wait(delay);
        }
      }
    }

    throw lastError;
  }

  /**
   * Batch array processing
   */
  async function batchProcess(items, batchSize, processFn) {
    const results = [];

    for (let i = 0; i < items.length; i += batchSize) {
      const batch = items.slice(i, i + batchSize);
      const batchResults = await Promise.all(batch.map(processFn));
      results.push(...batchResults);

      // Small delay between batches
      if (i + batchSize < items.length) {
        await wait(100);
      }
    }

    return results;
  }

  /**
   * Memoize function results
   */
  function memoize(fn, maxCacheSize = 100) {
    const cache = new Map();

    return function (...args) {
      const key = JSON.stringify(args);

      if (cache.has(key)) {
        return cache.get(key);
      }

      const result = fn.apply(this, args);

      cache.set(key, result);

      // Limit cache size
      if (cache.size > maxCacheSize) {
        const firstKey = cache.keys().next().value;
        cache.delete(firstKey);
      }

      return result;
    };
  }

  /**
   * Parse query string
   */
  function parseQueryString(queryString) {
    const params = new URLSearchParams(queryString);
    const result = {};

    for (const [key, value] of params) {
      result[key] = value;
    }

    return result;
  }

  /**
   * Get browser info
   */
  function getBrowserInfo() {
    const ua = navigator.userAgent;

    return {
      isFirefox: ua.indexOf("Firefox") > -1,
      isChrome: ua.indexOf("Chrome") > -1 && ua.indexOf("Edge") === -1,
      isEdge: ua.indexOf("Edge") > -1,
      isMobile: /Mobile|Android/.test(ua),
      version: (ua.match(/Firefox\/(\d+)/) ||
        ua.match(/Chrome\/(\d+)/) ||
        [])[1],
    };
  }

  // Public API
  return {
    createLogger,
    getStorage,
    setStorage,
    removeStorage,
    createRateLimiter,
    formatPrice,
    calculateChange,
    formatDate,
    getRelativeTime,
    throttle,
    debounce,
    wait,
    truncate,
    escapeHtml,
    deepClone,
    isEmpty,
    isValidUrl,
    getDomain,
    generateId,
    sanitizeFilename,
    formatFileSize,
    retryWithBackoff,
    batchProcess,
    memoize,
    parseQueryString,
    getBrowserInfo,
  };
})();
