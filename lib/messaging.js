// Message Abstraction Layer v1.0
// Unified messaging between extension scripts

const Messenger = (function () {
  "use strict";

  /**
   * Default timeout for message responses in milliseconds
   */
  const DEFAULT_TIMEOUT = 10000;

  /**
   * Send a message to the background script
   * @param {string} action - Message action (from Config.MESSAGE_ACTIONS)
   * @param {Object} data - Additional data to send
   * @param {Object} options - Send options
   * @param {number} options.timeout - Response timeout in ms
   * @returns {Promise<*>} Response from background script
   */
  async function send(action, data = {}, options = {}) {
    const { timeout = DEFAULT_TIMEOUT } = options;

    if (!action || typeof action !== "string") {
      throw new Error("Invalid message action");
    }

    const message = {
      action: action,
      ...data,
      _timestamp: Date.now(),
    };

    try {
      // Create a timeout promise
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => {
          reject(new Error(`Message timeout: ${action}`));
        }, timeout);
      });

      // Race between message and timeout
      const response = await Promise.race([
        browser.runtime.sendMessage(message),
        timeoutPromise,
      ]);

      // Check for error response
      if (response && response.error) {
        throw new Error(response.error);
      }

      return response;
    } catch (error) {
      console.error(`[Messenger] Send failed for ${action}:`, error);
      throw error;
    }
  }

  /**
   * Send a message to a specific tab's content script
   * @param {number} tabId - Target tab ID
   * @param {string} action - Message action
   * @param {Object} data - Additional data to send
   * @param {Object} options - Send options
   * @returns {Promise<*>} Response from content script
   */
  async function sendToTab(tabId, action, data = {}, options = {}) {
    const { timeout = DEFAULT_TIMEOUT } = options;

    if (!tabId || typeof tabId !== "number") {
      throw new Error("Invalid tab ID");
    }

    if (!action || typeof action !== "string") {
      throw new Error("Invalid message action");
    }

    const message = {
      action: action,
      ...data,
      _timestamp: Date.now(),
    };

    try {
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => {
          reject(new Error(`Tab message timeout: ${action}`));
        }, timeout);
      });

      const response = await Promise.race([
        browser.tabs.sendMessage(tabId, message),
        timeoutPromise,
      ]);

      if (response && response.error) {
        throw new Error(response.error);
      }

      return response;
    } catch (error) {
      console.error(`[Messenger] SendToTab failed for ${action}:`, error);
      throw error;
    }
  }

  /**
   * Send a message to all tabs
   * @param {string} action - Message action
   * @param {Object} data - Additional data to send
   * @returns {Promise<Array>} Responses from all tabs
   */
  async function broadcast(action, data = {}) {
    try {
      const tabs = await browser.tabs.query({});
      const promises = tabs.map((tab) =>
        sendToTab(tab.id, action, data).catch((e) => ({
          error: e.message,
          tabId: tab.id,
        }))
      );

      return Promise.all(promises);
    } catch (error) {
      console.error(`[Messenger] Broadcast failed for ${action}:`, error);
      throw error;
    }
  }

  /**
   * Create a message handler wrapper
   * @param {Object} handlers - Map of action to handler function
   * @returns {Function} Browser message listener
   */
  function createHandler(handlers) {
    return function (request, sender, sendResponse) {
      const { action, ...data } = request;

      // Log incoming message
      console.log(`[Messenger] Received: ${action}`, {
        sender: sender.tab?.id || "background",
      });

      // Check if handler exists for this action
      const handler = handlers[action];

      if (!handler) {
        console.warn(`[Messenger] No handler for action: ${action}`);
        sendResponse({ error: `Unknown action: ${action}` });
        return false;
      }

      // Execute handler
      const handleAsync = async () => {
        try {
          const result = await handler(data, sender);
          return result;
        } catch (error) {
          console.error(`[Messenger] Handler error for ${action}:`, error);
          return { error: error.message };
        }
      };

      handleAsync()
        .then((result) => {
          console.log(`[Messenger] Response for ${action}:`, result);
          sendResponse(result);
        })
        .catch((error) => {
          console.error(`[Messenger] Response error for ${action}:`, error);
          sendResponse({ error: error.message });
        });

      // Return true to indicate async response
      return true;
    };
  }

  /**
   * Register a message handler with the browser
   * @param {Object} handlers - Map of action to handler function
   */
  function registerHandlers(handlers) {
    const handler = createHandler(handlers);
    browser.runtime.onMessage.addListener(handler);
    return handler;
  }

  /**
   * Helper functions for common operations
   */
  const Actions = {
    /**
     * Get product info from current tab
     * @param {number} tabId - Tab ID
     * @param {boolean} skipCache - Skip cache flag
     * @returns {Promise<Object>} Product info
     */
    async getProductInfo(tabId, skipCache = false) {
      const action =
        typeof Config !== "undefined"
          ? Config.MESSAGE_ACTIONS.GET_PRODUCT_INFO
          : "getProductInfo";

      return sendToTab(tabId, action, { skipCache });
    },

    /**
     * Check all prices via background script
     * @returns {Promise<Object>} Check result
     */
    async checkAllPrices() {
      const action =
        typeof Config !== "undefined"
          ? Config.MESSAGE_ACTIONS.CHECK_ALL_PRICES
          : "checkAllPrices";

      return send(action);
    },

    /**
     * Check a single product
     * @param {Object} product - Product to check
     * @returns {Promise<Object>} Check result
     */
    async checkSingleProduct(product) {
      const action =
        typeof Config !== "undefined"
          ? Config.MESSAGE_ACTIONS.CHECK_SINGLE_PRODUCT
          : "checkSingleProduct";

      return send(action, { product });
    },

    /**
     * Get settings from background script
     * @returns {Promise<Object>} Settings object
     */
    async getSettings() {
      const action =
        typeof Config !== "undefined"
          ? Config.MESSAGE_ACTIONS.GET_SETTINGS
          : "getSettings";

      return send(action);
    },

    /**
     * Update settings
     * @param {Object} settings - Settings to update
     * @returns {Promise<Object>} Update result
     */
    async updateSettings(settings) {
      const action =
        typeof Config !== "undefined"
          ? Config.MESSAGE_ACTIONS.UPDATE_SETTINGS
          : "updateSettings";

      return send(action, { settings });
    },

    /**
     * Clear cache in background script
     * @returns {Promise<Object>} Clear result
     */
    async clearCache() {
      const action =
        typeof Config !== "undefined"
          ? Config.MESSAGE_ACTIONS.CLEAR_CACHE
          : "clearCache";

      return send(action);
    },

    /**
     * Ping content script to check if loaded
     * @param {number} tabId - Tab ID
     * @returns {Promise<boolean>} True if content script is loaded
     */
    async pingTab(tabId) {
      try {
        const action =
          typeof Config !== "undefined"
            ? Config.MESSAGE_ACTIONS.PING
            : "ping";

        const response = await sendToTab(tabId, action, {}, { timeout: 2000 });
        return response && response.pong;
      } catch {
        return false;
      }
    },
  };

  // Public API
  return {
    send,
    sendToTab,
    broadcast,
    createHandler,
    registerHandlers,
    Actions,
    DEFAULT_TIMEOUT,
  };
})();

// Export for browser extension
if (typeof window !== "undefined") {
  window.Messenger = Messenger;
}
