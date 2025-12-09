// Native Messaging with Go Backend v1.0
const NativeMessaging = (function () {
  "use strict";

  const logger = PriceTrackerHelpers?.createLogger("NativeMsg") || console;
  
  let port = null;
  let isConnected = false;
  let messageQueue = [];
  let pendingRequests = new Map();
  let requestId = 0;

  const APP_NAME = "com.pricetracker.native";

  /**
   * Connect to native Go backend
   */
  function connect() {
    if (port && isConnected) {
      logger.info("Already connected to Go backend");
      return Promise.resolve(true);
    }

    return new Promise((resolve, reject) => {
      try {
        logger.info("🔌 Connecting to Go backend...");

        port = browser.runtime.connectNative(APP_NAME);

        port.onMessage.addListener((response) => {
          handleResponse(response);
        });

        port.onDisconnect.addListener(() => {
          isConnected = false;
          const error = browser.runtime.lastError;
          logger.error("❌ Go backend disconnected:", error?.message);
          
          // Reject all pending requests
          for (const [id, { reject }] of pendingRequests) {
            reject(new Error("Backend disconnected"));
          }
          pendingRequests.clear();
        });

        // Test connection with ping
        sendRequest({ action: "ping" })
          .then((response) => {
            isConnected = true;
            logger.success("✅ Connected to Go backend:", response);
            
            // Process queued messages
            processQueue();
            
            resolve(true);
          })
          .catch((error) => {
            logger.error("❌ Connection test failed:", error);
            reject(error);
          });

      } catch (error) {
        logger.error("❌ Connection error:", error);
        reject(error);
      }
    });
  }

  /**
   * Disconnect from native backend
   */
  function disconnect() {
    if (port) {
      port.disconnect();
      port = null;
      isConnected = false;
      logger.info("👋 Disconnected from Go backend");
    }
  }

  /**
   * Send request to Go backend
   */
  function sendRequest(request, timeout = 30000) {
    return new Promise((resolve, reject) => {
      if (!port || !isConnected) {
        // Queue message if not connected
        messageQueue.push({ request, resolve, reject });
        
        // Try to connect
        connect().catch((error) => {
          reject(new Error(`Not connected to Go backend: ${error.message}`));
        });
        return;
      }

      const id = ++requestId;
      const message = { ...request, _id: id };

      // Store pending request
      pendingRequests.set(id, { resolve, reject });

      // Set timeout
      const timeoutId = setTimeout(() => {
        pendingRequests.delete(id);
        reject(new Error(`Request timeout after ${timeout}ms`));
      }, timeout);

      // Store timeout for cleanup
      pendingRequests.get(id).timeoutId = timeoutId;

      // Send message
      try {
        port.postMessage(message);
        logger.info("📤 Sent request:", message.action);
      } catch (error) {
        clearTimeout(timeoutId);
        pendingRequests.delete(id);
        reject(error);
      }
    });
  }

  /**
   * Handle response from Go backend
   */
  function handleResponse(response) {
    logger.info("📥 Received response:", response);

    const id = response._id;
    if (!id) {
      logger.warn("Response without ID:", response);
      return;
    }

    const pending = pendingRequests.get(id);
    if (!pending) {
      logger.warn("No pending request for ID:", id);
      return;
    }

    // Clear timeout
    clearTimeout(pending.timeoutId);
    pendingRequests.delete(id);

    // Resolve or reject
    if (response.success) {
      pending.resolve(response.data);
    } else {
      pending.reject(new Error(response.error || "Unknown error"));
    }
  }

  /**
   * Process queued messages
   */
  function processQueue() {
    if (messageQueue.length === 0) return;

    logger.info(`📦 Processing ${messageQueue.length} queued messages`);

    while (messageQueue.length > 0) {
      const { request, resolve, reject } = messageQueue.shift();
      sendRequest(request).then(resolve).catch(reject);
    }
  }

  /**
   * Check if connected
   */
  function isBackendConnected() {
    return isConnected;
  }

  /**
   * API Methods
   */

  /**
   * Ping Go backend
   */
  async function ping() {
    return sendRequest({ action: "ping" });
  }

  /**
   * Fetch price using Go backend
   */
  async function fetchPrice(url) {
    return sendRequest({
      action: "fetchPrice",
      url: url,
    });
  }

  /**
   * Parse HTML using Go backend
   */
  async function parseHTML(url) {
    return sendRequest({
      action: "parseHTML",
      url: url,
    });
  }

  /**
   * Extract with custom selector using Go backend
   */
  async function extractWithSelector(url, selector) {
    return sendRequest({
      action: "extractWithSelector",
      url: url,
      data: { selector },
    });
  }

  /**
   * Check multiple products concurrently using Go backend
   */
  async function checkMultipleProducts(products) {
    return sendRequest({
      action: "checkMultipleProducts",
      data: { products },
    }, 60000); // 60 second timeout for multiple products
  }

  /**
   * Fetch product price (with fallback to browser fetch)
   */
  async function fetchProductPrice(url, useNative = true) {
    if (!useNative || !isConnected) {
      // Fallback to browser-based fetching
      logger.info("Using browser-based fetching");
      return null; // Let existing code handle it
    }

    try {
      const result = await fetchPrice(url);
      if (result && result.product) {
        logger.success("✅ Got product from Go backend:", result.product);
        return result.product;
      }
      return null;
    } catch (error) {
      logger.error("❌ Go backend fetch failed:", error);
      return null; // Fallback to browser-based
    }
  }

  /**
   * Auto-connect on load
   */
  function autoConnect() {
    // Try to connect in background
    connect().catch((error) => {
      logger.warn("Auto-connect failed, will connect on first use:", error.message);
    });
  }

  // Public API
  return {
    connect,
    disconnect,
    isConnected: isBackendConnected,
    ping,
    fetchPrice,
    parseHTML,
    extractWithSelector,
    checkMultipleProducts,
    fetchProductPrice,
    autoConnect,
  };
})();

// Export for browser extension
if (typeof window !== "undefined") {
  window.NativeMessaging = NativeMessaging;
}