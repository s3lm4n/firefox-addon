// Price Alerts System v1.0
// Target price alerts and percentage-based notifications

const PriceAlerts = (function () {
  "use strict";

  /**
   * Supported currencies with symbols and conversion rates (relative to TRY)
   */
  const CURRENCIES = {
    TRY: { symbol: "₺", name: "Türk Lirası", rate: 1 },
    USD: { symbol: "$", name: "US Dollar", rate: 0.029 },
    EUR: { symbol: "€", name: "Euro", rate: 0.027 },
    GBP: { symbol: "£", name: "British Pound", rate: 0.023 },
  };

  /**
   * Alert types
   */
  const ALERT_TYPES = {
    TARGET_PRICE: "target_price",
    PERCENTAGE_DROP: "percentage_drop",
    PERCENTAGE_RISE: "percentage_rise",
    ANY_CHANGE: "any_change",
  };

  /**
   * Create a new price alert
   * @param {Object} options Alert options
   * @returns {Object} Alert object
   */
  function createAlert(options) {
    const {
      productUrl,
      productName,
      type,
      targetPrice = null,
      targetPercent = null,
      currentPrice,
      currency = "TRY",
      enabled = true,
    } = options;

    if (!productUrl || !type) {
      throw new Error("productUrl and type are required");
    }

    // Validate alert type
    if (!Object.values(ALERT_TYPES).includes(type)) {
      throw new Error(`Invalid alert type: ${type}`);
    }

    // Validate target price for target_price type
    if (type === ALERT_TYPES.TARGET_PRICE && (!targetPrice || targetPrice <= 0)) {
      throw new Error("Target price must be a positive number");
    }

    // Validate percentage for percentage types
    if (
      (type === ALERT_TYPES.PERCENTAGE_DROP || type === ALERT_TYPES.PERCENTAGE_RISE) &&
      (!targetPercent || targetPercent <= 0 || targetPercent > 100)
    ) {
      throw new Error("Target percentage must be between 1 and 100");
    }

    return {
      id: generateAlertId(),
      productUrl,
      productName: productName || "Unknown Product",
      type,
      targetPrice: type === ALERT_TYPES.TARGET_PRICE ? parseFloat(targetPrice) : null,
      targetPercent:
        type === ALERT_TYPES.PERCENTAGE_DROP || type === ALERT_TYPES.PERCENTAGE_RISE
          ? parseFloat(targetPercent)
          : null,
      basePrice: parseFloat(currentPrice) || null,
      currency,
      enabled,
      createdAt: Date.now(),
      triggeredAt: null,
      lastChecked: null,
    };
  }

  /**
   * Generate unique alert ID
   */
  function generateAlertId() {
    return `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Check if an alert should be triggered
   * @param {Object} alert Alert object
   * @param {number} currentPrice Current price
   * @returns {Object} { triggered: boolean, message: string }
   */
  function checkAlert(alert, currentPrice) {
    if (!alert.enabled) {
      return { triggered: false, message: null };
    }

    const price = parseFloat(currentPrice);
    if (isNaN(price) || price <= 0) {
      return { triggered: false, message: null };
    }

    switch (alert.type) {
      case ALERT_TYPES.TARGET_PRICE:
        if (price <= alert.targetPrice) {
          return {
            triggered: true,
            message: `🎯 Hedef fiyata ulaşıldı! ${alert.productName} şimdi ${formatPrice(price, alert.currency)} (hedef: ${formatPrice(alert.targetPrice, alert.currency)})`,
            type: "success",
          };
        }
        break;

      case ALERT_TYPES.PERCENTAGE_DROP:
        if (alert.basePrice) {
          const dropPercent = ((alert.basePrice - price) / alert.basePrice) * 100;
          if (dropPercent >= alert.targetPercent) {
            return {
              triggered: true,
              message: `📉 %${dropPercent.toFixed(1)} düşüş! ${alert.productName}: ${formatPrice(alert.basePrice, alert.currency)} → ${formatPrice(price, alert.currency)}`,
              type: "success",
            };
          }
        }
        break;

      case ALERT_TYPES.PERCENTAGE_RISE:
        if (alert.basePrice) {
          const risePercent = ((price - alert.basePrice) / alert.basePrice) * 100;
          if (risePercent >= alert.targetPercent) {
            return {
              triggered: true,
              message: `📈 %${risePercent.toFixed(1)} artış! ${alert.productName}: ${formatPrice(alert.basePrice, alert.currency)} → ${formatPrice(price, alert.currency)}`,
              type: "warning",
            };
          }
        }
        break;

      case ALERT_TYPES.ANY_CHANGE:
        if (alert.basePrice && Math.abs(price - alert.basePrice) > 0.01) {
          const changePercent = ((price - alert.basePrice) / alert.basePrice) * 100;
          const direction = changePercent > 0 ? "arttı" : "düştü";
          return {
            triggered: true,
            message: `🔔 Fiyat ${direction}! ${alert.productName}: ${formatPrice(price, alert.currency)} (%${Math.abs(changePercent).toFixed(1)})`,
            type: changePercent < 0 ? "success" : "info",
          };
        }
        break;
    }

    return { triggered: false, message: null };
  }

  /**
   * Format price with currency symbol
   */
  function formatPrice(price, currency = "TRY") {
    const curr = CURRENCIES[currency] || CURRENCIES.TRY;
    return `${price.toFixed(2)} ${curr.symbol}`;
  }

  /**
   * Get human-readable alert description
   */
  function getAlertDescription(alert) {
    switch (alert.type) {
      case ALERT_TYPES.TARGET_PRICE:
        return `Fiyat ${formatPrice(alert.targetPrice, alert.currency)} veya altına düştüğünde bildir`;
      case ALERT_TYPES.PERCENTAGE_DROP:
        return `Fiyat %${alert.targetPercent} veya daha fazla düştüğünde bildir`;
      case ALERT_TYPES.PERCENTAGE_RISE:
        return `Fiyat %${alert.targetPercent} veya daha fazla arttığında bildir`;
      case ALERT_TYPES.ANY_CHANGE:
        return `Herhangi bir fiyat değişikliğinde bildir`;
      default:
        return "Bilinmeyen alarm türü";
    }
  }

  /**
   * Save alerts to storage
   */
  async function saveAlerts(alerts) {
    try {
      await browser.storage.local.set({ priceAlerts: alerts });
      return true;
    } catch (error) {
      console.error("[Alerts] Save error:", error);
      return false;
    }
  }

  /**
   * Load alerts from storage
   */
  async function loadAlerts() {
    try {
      const result = await browser.storage.local.get("priceAlerts");
      return result.priceAlerts || [];
    } catch (error) {
      console.error("[Alerts] Load error:", error);
      return [];
    }
  }

  /**
   * Add a new alert
   */
  async function addAlert(alertOptions) {
    const alerts = await loadAlerts();
    const newAlert = createAlert(alertOptions);
    alerts.push(newAlert);
    await saveAlerts(alerts);
    return newAlert;
  }

  /**
   * Remove an alert by ID
   */
  async function removeAlert(alertId) {
    const alerts = await loadAlerts();
    const filtered = alerts.filter((a) => a.id !== alertId);
    await saveAlerts(filtered);
    return filtered;
  }

  /**
   * Toggle alert enabled state
   */
  async function toggleAlert(alertId) {
    const alerts = await loadAlerts();
    const alert = alerts.find((a) => a.id === alertId);
    if (alert) {
      alert.enabled = !alert.enabled;
      await saveAlerts(alerts);
    }
    return alerts;
  }

  /**
   * Get alerts for a specific product
   */
  async function getAlertsForProduct(productUrl) {
    const alerts = await loadAlerts();
    return alerts.filter((a) => a.productUrl === productUrl);
  }

  /**
   * Check all alerts against current product prices
   */
  async function checkAllAlerts(products) {
    const alerts = await loadAlerts();
    const triggered = [];

    for (const alert of alerts) {
      if (!alert.enabled) continue;

      const product = products.find((p) => p.url === alert.productUrl);
      if (!product) continue;

      const result = checkAlert(alert, product.price);
      if (result.triggered) {
        triggered.push({
          alert,
          product,
          ...result,
        });

        // Mark alert as triggered
        alert.triggeredAt = Date.now();
      }

      alert.lastChecked = Date.now();
    }

    // Save updated alerts
    await saveAlerts(alerts);

    return triggered;
  }

  /**
   * Convert price between currencies (approximate)
   */
  function convertCurrency(price, fromCurrency, toCurrency) {
    const from = CURRENCIES[fromCurrency] || CURRENCIES.TRY;
    const to = CURRENCIES[toCurrency] || CURRENCIES.TRY;

    // Convert to TRY first, then to target currency
    const tryPrice = price / from.rate;
    return tryPrice * to.rate;
  }

  // Public API
  return {
    ALERT_TYPES,
    CURRENCIES,
    createAlert,
    checkAlert,
    formatPrice,
    getAlertDescription,
    saveAlerts,
    loadAlerts,
    addAlert,
    removeAlert,
    toggleAlert,
    getAlertsForProduct,
    checkAllAlerts,
    convertCurrency,
  };
})();

// Export for browser extension
if (typeof window !== "undefined") {
  window.PriceAlerts = PriceAlerts;
}
