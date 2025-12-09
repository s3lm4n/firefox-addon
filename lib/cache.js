// Unified Cache Management Module v1.0
// Centralized caching with TTL and cleanup

const CacheManager = (function () {
  "use strict";

  /**
   * Create a new cache instance
   * @param {Object} options - Cache options
   * @param {number} options.defaultTTL - Default time-to-live in milliseconds
   * @param {number} options.maxSize - Maximum number of entries
   * @param {boolean} options.autoCleanup - Enable automatic cleanup
   * @param {number} options.cleanupInterval - Cleanup interval in milliseconds
   * @returns {Object} Cache instance
   */
  function createCache(options = {}) {
    const {
      defaultTTL = 300000, // 5 minutes default
      maxSize = 100,
      autoCleanup = true,
      cleanupInterval = 60000, // 1 minute
    } = options;

    const cache = new Map();
    const pendingRequests = new Map();
    let cleanupTimer = null;

    /**
     * Get a value from cache
     * @param {string} key - Cache key
     * @returns {*} Cached value or undefined
     */
    function get(key) {
      if (!cache.has(key)) {
        return undefined;
      }

      const entry = cache.get(key);
      const now = Date.now();

      // Check if entry has expired
      if (entry.expiresAt && now > entry.expiresAt) {
        cache.delete(key);
        return undefined;
      }

      // Update access time for LRU
      entry.lastAccess = now;
      return entry.value;
    }

    /**
     * Set a value in cache
     * @param {string} key - Cache key
     * @param {*} value - Value to cache
     * @param {number} ttl - Time-to-live in milliseconds (optional)
     */
    function set(key, value, ttl = defaultTTL) {
      const now = Date.now();

      // Enforce max size by removing oldest entries
      if (cache.size >= maxSize && !cache.has(key)) {
        removeOldestEntry();
      }

      cache.set(key, {
        value: value,
        createdAt: now,
        lastAccess: now,
        expiresAt: ttl > 0 ? now + ttl : null,
      });
    }

    /**
     * Check if cache has a valid entry for key
     * @param {string} key - Cache key
     * @returns {boolean} True if valid entry exists
     */
    function has(key) {
      if (!cache.has(key)) {
        return false;
      }

      const entry = cache.get(key);
      const now = Date.now();

      if (entry.expiresAt && now > entry.expiresAt) {
        cache.delete(key);
        return false;
      }

      return true;
    }

    /**
     * Delete an entry from cache
     * @param {string} key - Cache key
     * @returns {boolean} True if entry was deleted
     */
    function remove(key) {
      return cache.delete(key);
    }

    /**
     * Clear all cache entries
     */
    function clear() {
      cache.clear();
      pendingRequests.clear();
    }

    /**
     * Get cache size
     * @returns {number} Number of entries
     */
    function size() {
      return cache.size;
    }

    /**
     * Clean up expired entries
     * @returns {number} Number of entries removed
     */
    function cleanup() {
      const now = Date.now();
      let removed = 0;

      for (const [key, entry] of cache.entries()) {
        if (entry.expiresAt && now > entry.expiresAt) {
          cache.delete(key);
          removed++;
        }
      }

      return removed;
    }

    /**
     * Remove the oldest entry (LRU)
     */
    function removeOldestEntry() {
      let oldestKey = null;
      let oldestTime = Infinity;

      for (const [key, entry] of cache.entries()) {
        if (entry.lastAccess < oldestTime) {
          oldestTime = entry.lastAccess;
          oldestKey = key;
        }
      }

      if (oldestKey !== null) {
        cache.delete(oldestKey);
      }
    }

    /**
     * Get or set with async function (cache-through pattern)
     * @param {string} key - Cache key
     * @param {Function} fetchFn - Async function to fetch value if not cached
     * @param {number} ttl - Time-to-live in milliseconds (optional)
     * @returns {Promise<*>} Cached or fetched value
     */
    async function getOrSet(key, fetchFn, ttl = defaultTTL) {
      // Check cache first
      const cached = get(key);
      if (cached !== undefined) {
        return cached;
      }

      // Check if there's already a pending request for this key
      if (pendingRequests.has(key)) {
        return pendingRequests.get(key);
      }

      // Create promise for this request
      const promise = (async () => {
        try {
          const value = await fetchFn();
          set(key, value, ttl);
          return value;
        } finally {
          pendingRequests.delete(key);
        }
      })();

      pendingRequests.set(key, promise);
      return promise;
    }

    /**
     * Get cache statistics
     * @returns {Object} Cache statistics
     */
    function getStats() {
      const now = Date.now();
      let validCount = 0;
      let expiredCount = 0;

      for (const entry of cache.values()) {
        if (entry.expiresAt && now > entry.expiresAt) {
          expiredCount++;
        } else {
          validCount++;
        }
      }

      return {
        size: cache.size,
        validEntries: validCount,
        expiredEntries: expiredCount,
        pendingRequests: pendingRequests.size,
        maxSize: maxSize,
        defaultTTL: defaultTTL,
      };
    }

    /**
     * Start automatic cleanup
     */
    function startAutoCleanup() {
      if (cleanupTimer) {
        return;
      }

      cleanupTimer = setInterval(() => {
        const removed = cleanup();
        if (removed > 0) {
          console.log(`[CacheManager] Cleaned up ${removed} expired entries`);
        }
      }, cleanupInterval);
    }

    /**
     * Stop automatic cleanup
     */
    function stopAutoCleanup() {
      if (cleanupTimer) {
        clearInterval(cleanupTimer);
        cleanupTimer = null;
      }
    }

    /**
     * Destroy cache instance
     */
    function destroy() {
      stopAutoCleanup();
      clear();
    }

    // Start auto cleanup if enabled
    if (autoCleanup) {
      startAutoCleanup();
    }

    // Return public API
    return {
      get,
      set,
      has,
      delete: remove,
      clear,
      size,
      cleanup,
      getOrSet,
      getStats,
      startAutoCleanup,
      stopAutoCleanup,
      destroy,
    };
  }

  // Create a default global cache instance
  let defaultCache = null;

  /**
   * Get or create the default cache instance
   * @param {Object} options - Cache options (only used on first call)
   * @returns {Object} Default cache instance
   */
  function getDefaultCache(options = {}) {
    if (!defaultCache) {
      // Use Config values if available
      const ttl =
        typeof Config !== "undefined"
          ? Config.CACHE.BACKGROUND_DURATION_MS
          : 300000;

      defaultCache = createCache({
        defaultTTL: ttl,
        maxSize: 100,
        autoCleanup: true,
        ...options,
      });
    }
    return defaultCache;
  }

  // Public API
  return {
    createCache,
    getDefaultCache,
  };
})();

// Export for browser extension
if (typeof window !== "undefined") {
  window.CacheManager = CacheManager;
}
