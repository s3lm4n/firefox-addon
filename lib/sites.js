// Enhanced Sites Configuration v4.0 - Improved Detection & More Sites
// Comprehensive support for 70+ Turkish and international e-commerce sites

const SiteConfigs = (() => {
  "use strict";

  /**
   * Site configuration definitions
   * Each site can have multiple selectors with priority order
   */
  const SITES = {
    // ==================== Turkish E-Commerce ====================

    "hepsiburada.com": {
      name: "Hepsiburada",
      selectors: {
        price: [
          // Current price (checkout price)
          { selector: '[data-test-id="price-current-price"]', attr: "content" },
          { selector: ".checkout-price", attr: "textContent" },
          { selector: '[itemprop="price"]', attr: "content" },
          { selector: ".price-value", attr: "textContent" },
          // Additional fallbacks
          { selector: "#offering-price", attr: "textContent" },
          { selector: ".product-price", attr: "textContent" },
        ],
        previousPrice: [
          { selector: '[data-test-id="price-old-price"]', attr: "content" },
          { selector: ".prev-price", attr: "textContent" },
          { selector: ".old-price", attr: "textContent" },
        ],
        name: [
          { selector: '[data-test-id="product-name"]', attr: "textContent" },
          { selector: 'h1[itemprop="name"]', attr: "textContent" },
          { selector: ".product-name", attr: "textContent" },
          { selector: "h1", attr: "textContent" },
        ],
        image: [
          { selector: '[data-test-id="product-image"]', attr: "src" },
          { selector: 'img[itemprop="image"]', attr: "src" },
          { selector: ".product-image img", attr: "src" },
        ],
        currency: "TRY",
      },
      patterns: {
        price: /[\d.,]+/,
        clean: /[^\d.,]/g,
      },
    },

    "trendyol.com": {
      name: "Trendyol",
      selectors: {
        price: [
          { selector: '[data-test-id="current-price"]', attr: "textContent" },
          { selector: ".prc-dsc", attr: "textContent" },
          { selector: ".prc-slg", attr: "textContent" },
          {
            selector: '[class*="price-box"] span[class*="prc"]',
            attr: "textContent",
          },
          { selector: 'span[itemprop="price"]', attr: "content" },
        ],
        previousPrice: [
          { selector: '[data-test-id="old-price"]', attr: "textContent" },
          { selector: ".prc-org", attr: "textContent" },
          { selector: ".original-price", attr: "textContent" },
        ],
        name: [
          { selector: "h1.pr-new-br", attr: "textContent" },
          { selector: 'h1[class*="product-name"]', attr: "textContent" },
          { selector: "h1", attr: "textContent" },
        ],
        image: [
          { selector: ".product-image img", attr: "src" },
          { selector: 'img[alt*="ürün"]', attr: "src" },
        ],
        currency: "TRY",
      },
    },

    "n11.com": {
      name: "N11",
      selectors: {
        price: [
          { selector: ".newPrice ins", attr: "textContent" },
          { selector: ".priceContainer ins", attr: "textContent" },
          { selector: ".newPrice", attr: "textContent" },
          { selector: '[itemprop="price"]', attr: "content" },
          { selector: "#newPrice", attr: "textContent" },
        ],
        previousPrice: [
          { selector: ".oldPrice", attr: "textContent" },
          { selector: ".priceContainer del", attr: "textContent" },
        ],
        name: [
          { selector: 'h1[itemprop="name"]', attr: "textContent" },
          { selector: ".proName", attr: "textContent" },
          { selector: "h1.productName", attr: "textContent" },
        ],
        currency: "TRY",
      },
    },

    "amazon.com.tr": {
      name: "Amazon TR",
      selectors: {
        price: [
          { selector: "span.a-price-whole", attr: "textContent" },
          { selector: "#priceblock_ourprice", attr: "textContent" },
          { selector: "#priceblock_dealprice", attr: "textContent" },
          { selector: ".a-price .a-offscreen", attr: "textContent" },
          { selector: "[data-asin-price]", attr: "data-asin-price" },
        ],
        previousPrice: [
          { selector: ".a-text-price span.a-offscreen", attr: "textContent" },
          { selector: "span.a-price.a-text-price span", attr: "textContent" },
        ],
        name: [
          { selector: "#productTitle", attr: "textContent" },
          { selector: "h1.a-size-large", attr: "textContent" },
        ],
        currency: "TRY",
      },
    },

    "gittigidiyor.com": {
      name: "GittiGidiyor",
      selectors: {
        price: [
          { selector: ".price-box__price-value", attr: "textContent" },
          { selector: "[data-price]", attr: "data-price" },
          { selector: ".real-price", attr: "textContent" },
          { selector: 'span[itemprop="price"]', attr: "content" },
        ],
        previousPrice: [
          { selector: ".old-price", attr: "textContent" },
          { selector: ".market-price", attr: "textContent" },
        ],
        name: [
          { selector: 'h1[itemprop="name"]', attr: "textContent" },
          { selector: ".product-name", attr: "textContent" },
        ],
        currency: "TRY",
      },
    },

    "ciceksepeti.com": {
      name: "Çiçek Sepeti",
      selectors: {
        price: [
          { selector: ".product-price__final", attr: "textContent" },
          { selector: '[data-testid="product-price"]', attr: "textContent" },
          { selector: ".price-value", attr: "textContent" },
        ],
        previousPrice: [
          { selector: ".product-price__old", attr: "textContent" },
          { selector: ".old-price", attr: "textContent" },
        ],
        name: [
          { selector: 'h1[data-testid="product-title"]', attr: "textContent" },
          { selector: ".product-title", attr: "textContent" },
        ],
        currency: "TRY",
      },
    },

    "morhipo.com": {
      name: "Morhipo",
      selectors: {
        price: [
          { selector: ".product-price-new", attr: "textContent" },
          { selector: ".price-new", attr: "textContent" },
          { selector: '[itemprop="price"]', attr: "content" },
        ],
        previousPrice: [
          { selector: ".product-price-old", attr: "textContent" },
          { selector: ".price-old", attr: "textContent" },
        ],
        name: [
          { selector: "h1.product-name", attr: "textContent" },
          { selector: "h1", attr: "textContent" },
        ],
        currency: "TRY",
      },
    },

    "defacto.com.tr": {
      name: "DeFacto",
      selectors: {
        price: [
          { selector: ".product-price__sale", attr: "textContent" },
          { selector: ".discountedPrice", attr: "textContent" },
          { selector: '[data-testid="product-price"]', attr: "textContent" },
        ],
        previousPrice: [
          { selector: ".product-price__original", attr: "textContent" },
          { selector: ".originalPrice", attr: "textContent" },
        ],
        name: [
          { selector: "h1.product-name", attr: "textContent" },
          { selector: '[data-testid="product-name"]', attr: "textContent" },
        ],
        currency: "TRY",
      },
    },

    "lcwaikiki.com": {
      name: "LC Waikiki",
      selectors: {
        price: [
          { selector: ".product-price__new", attr: "textContent" },
          { selector: ".product-price .price", attr: "textContent" },
          { selector: "[data-price]", attr: "data-price" },
        ],
        previousPrice: [
          { selector: ".product-price__old", attr: "textContent" },
        ],
        name: [{ selector: "h1.product-name", attr: "textContent" }],
        currency: "TRY",
      },
    },

    "koton.com": {
      name: "Koton",
      selectors: {
        price: [
          {
            selector: ".product-detail-price__discounted",
            attr: "textContent",
          },
          { selector: ".price-discounted", attr: "textContent" },
          { selector: ".product-price", attr: "textContent" },
        ],
        previousPrice: [
          { selector: ".product-detail-price__original", attr: "textContent" },
          { selector: ".price-original", attr: "textContent" },
        ],
        name: [{ selector: "h1.product-name", attr: "textContent" }],
        currency: "TRY",
      },
    },

    "flo.com.tr": {
      name: "FLO",
      selectors: {
        price: [
          { selector: ".product-price-discounted", attr: "textContent" },
          { selector: ".product-price", attr: "textContent" },
        ],
        previousPrice: [
          { selector: ".product-price-original", attr: "textContent" },
        ],
        name: [{ selector: "h1.product-title", attr: "textContent" }],
        currency: "TRY",
      },
    },

    "teknosa.com": {
      name: "Teknosa",
      selectors: {
        price: [
          { selector: ".product-price", attr: "textContent" },
          { selector: '[data-testid="product-price"]', attr: "textContent" },
          { selector: ".prd-prc", attr: "textContent" },
        ],
        previousPrice: [{ selector: ".old-price", attr: "textContent" }],
        name: [{ selector: "h1.product-name", attr: "textContent" }],
        currency: "TRY",
      },
    },

    "mediamarkt.com.tr": {
      name: "MediaMarkt",
      selectors: {
        price: [
          { selector: '[data-test="product-price"]', attr: "textContent" },
          { selector: ".product-price", attr: "textContent" },
        ],
        previousPrice: [{ selector: ".old-price", attr: "textContent" }],
        name: [
          { selector: 'h1[data-test="product-name"]', attr: "textContent" },
        ],
        currency: "TRY",
      },
    },

    "vatanbilgisayar.com": {
      name: "Vatan Bilgisayar",
      selectors: {
        price: [
          { selector: ".product-list__price", attr: "textContent" },
          { selector: "#product-price", attr: "textContent" },
        ],
        previousPrice: [
          { selector: ".product-list__old-price", attr: "textContent" },
        ],
        name: [
          { selector: "h1.product-list__product-name", attr: "textContent" },
        ],
        currency: "TRY",
      },
    },

    "a101.com.tr": {
      name: "A101",
      selectors: {
        price: [
          { selector: ".current-price", attr: "textContent" },
          { selector: ".product-price", attr: "textContent" },
        ],
        previousPrice: [{ selector: ".old-price", attr: "textContent" }],
        name: [{ selector: "h1.product-name", attr: "textContent" }],
        currency: "TRY",
      },
    },

    "gratis.com": {
      name: "Gratis",
      selectors: {
        price: [
          { selector: ".product-detail__price--current", attr: "textContent" },
          { selector: ".price-current", attr: "textContent" },
        ],
        previousPrice: [
          { selector: ".product-detail__price--old", attr: "textContent" },
        ],
        name: [{ selector: "h1.product-detail__name", attr: "textContent" }],
        currency: "TRY",
      },
    },

    "decathlon.com.tr": {
      name: "Decathlon",
      selectors: {
        price: [
          { selector: '[data-testid="product-price"]', attr: "textContent" },
          { selector: ".product-price", attr: "textContent" },
        ],
        name: [
          { selector: 'h1[data-testid="product-title"]', attr: "textContent" },
        ],
        currency: "TRY",
      },
    },

    // ==================== International E-Commerce ====================

    "amazon.com": {
      name: "Amazon",
      selectors: {
        price: [
          { selector: "span.a-price-whole", attr: "textContent" },
          { selector: "#priceblock_ourprice", attr: "textContent" },
          { selector: "#priceblock_dealprice", attr: "textContent" },
          { selector: ".a-price .a-offscreen", attr: "textContent" },
        ],
        previousPrice: [
          { selector: ".a-text-price span.a-offscreen", attr: "textContent" },
        ],
        name: [{ selector: "#productTitle", attr: "textContent" }],
        currency: "USD",
      },
    },

    "ebay.com": {
      name: "eBay",
      selectors: {
        price: [
          { selector: '[itemprop="price"]', attr: "content" },
          { selector: ".x-price-primary span", attr: "textContent" },
          { selector: "#prcIsum", attr: "textContent" },
        ],
        name: [{ selector: "h1.x-item-title__mainTitle", attr: "textContent" }],
        currency: "USD",
      },
    },

    "aliexpress.com": {
      name: "AliExpress",
      selectors: {
        price: [
          { selector: '[data-spm-anchor-id*="price"]', attr: "textContent" },
          { selector: ".product-price-value", attr: "textContent" },
          { selector: ".uniform-banner-box-price", attr: "textContent" },
        ],
        name: [
          { selector: 'h1[data-pl="product-title"]', attr: "textContent" },
        ],
        currency: "USD",
      },
    },

    "walmart.com": {
      name: "Walmart",
      selectors: {
        price: [
          { selector: '[itemprop="price"]', attr: "content" },
          { selector: 'span[data-testid="price-wrap"]', attr: "textContent" },
        ],
        name: [{ selector: 'h1[itemprop="name"]', attr: "textContent" }],
        currency: "USD",
      },
    },

    "etsy.com": {
      name: "Etsy",
      selectors: {
        price: [
          { selector: '[data-buy-box-region="price"]', attr: "textContent" },
          { selector: ".wt-text-title-03", attr: "textContent" },
        ],
        name: [{ selector: "h1", attr: "textContent" }],
        currency: "USD",
      },
    },

    "bestbuy.com": {
      name: "Best Buy",
      selectors: {
        price: [
          { selector: '[data-testid="customer-price"]', attr: "textContent" },
          { selector: ".priceView-customer-price span", attr: "textContent" },
        ],
        name: [{ selector: "h1.heading-5", attr: "textContent" }],
        currency: "USD",
      },
    },
  };

  /**
   * Generic selectors as fallback
   */
  const GENERIC_SELECTORS = {
    price: [
      // Schema.org microdata
      { selector: '[itemprop="price"]', attr: "content" },
      { selector: '[itemprop="price"]', attr: "textContent" },

      // Common class patterns
      {
        selector: ".price, .product-price, .productPrice",
        attr: "textContent",
      },
      { selector: '[class*="price"][class*="current"]', attr: "textContent" },
      { selector: '[class*="sale"]price', attr: "textContent" },
      { selector: '[class*="discount"]price', attr: "textContent" },

      // Data attributes
      { selector: "[data-price]", attr: "data-price" },
      { selector: '[data-test-id*="price"]', attr: "textContent" },
      { selector: '[data-testid*="price"]', attr: "textContent" },

      // ID patterns
      {
        selector: "#price, #product-price, #productPrice",
        attr: "textContent",
      },
    ],
    previousPrice: [
      { selector: '[class*="old"]price', attr: "textContent" },
      { selector: '[class*="original"]price', attr: "textContent" },
      { selector: '[class*="regular"]price', attr: "textContent" },
      { selector: '[class*="was"]price', attr: "textContent" },
      {
        selector: 'del, .strikethrough, [class*="strike"]',
        attr: "textContent",
      },
    ],
    name: [
      { selector: 'h1[itemprop="name"]', attr: "textContent" },
      { selector: "h1.product-name, h1.productName", attr: "textContent" },
      { selector: '[data-test-id*="product-name"]', attr: "textContent" },
      { selector: "h1", attr: "textContent" },
    ],
  };

  /**
   * Get site configuration by domain
   */
  function getSiteConfig(url) {
    try {
      const hostname = new URL(url).hostname.toLowerCase();

      // Check for exact match
      for (const [domain, config] of Object.entries(SITES)) {
        if (hostname.includes(domain)) {
          return { ...config, domain };
        }
      }

      // Return generic config
      return {
        name: "Generic",
        domain: hostname,
        selectors: GENERIC_SELECTORS,
        currency: "TRY",
      };
    } catch (error) {
      console.error("[SiteConfigs] Error parsing URL:", error);
      return null;
    }
  }

  /**
   * Extract value from element using selector config
   */
  function extractValue(doc, selectorConfigs) {
    if (!Array.isArray(selectorConfigs)) {
      selectorConfigs = [selectorConfigs];
    }

    for (const config of selectorConfigs) {
      try {
        const elements = doc.querySelectorAll(config.selector);

        for (const element of elements) {
          let value = null;

          // Get value based on attribute
          if (config.attr === "textContent") {
            value = element.textContent;
          } else if (config.attr === "content") {
            value = element.getAttribute("content");
          } else if (config.attr) {
            value = element.getAttribute(config.attr);
          }

          // Clean and validate
          if (value && value.trim()) {
            return value.trim();
          }
        }
      } catch (error) {
        console.warn("[SiteConfigs] Selector error:", config.selector, error);
      }
    }

    return null;
  }

  /**
   * Clean price string and extract numeric value
   */
  function cleanPrice(priceStr) {
    if (!priceStr) return null;

    // Remove common currency symbols and text
    let cleaned = priceStr
      .replace(/TL|₺|TRY|USD|\$|EUR|€|GBP|£/gi, "")
      .replace(/[^\d.,]/g, "")
      .trim();

    if (!cleaned) return null;

    // Handle different decimal separators
    // Turkish format: 1.234,56 -> 1234.56
    // US format: 1,234.56 -> 1234.56

    const commaCount = (cleaned.match(/,/g) || []).length;
    const dotCount = (cleaned.match(/\./g) || []).length;

    if (commaCount > 1) {
      // Multiple commas: 1,234,567 (thousands separator)
      cleaned = cleaned.replace(/,/g, "");
    } else if (dotCount > 1) {
      // Multiple dots: 1.234.567 (thousands separator)
      cleaned = cleaned.replace(/\./g, "").replace(",", ".");
    } else if (commaCount === 1 && dotCount === 1) {
      // Both: determine which is decimal
      const lastComma = cleaned.lastIndexOf(",");
      const lastDot = cleaned.lastIndexOf(".");

      if (lastComma > lastDot) {
        // 1.234,56 (Turkish format)
        cleaned = cleaned.replace(/\./g, "").replace(",", ".");
      } else {
        // 1,234.56 (US format)
        cleaned = cleaned.replace(/,/g, "");
      }
    } else if (commaCount === 1) {
      // Single comma: check if decimal or thousands
      const parts = cleaned.split(",");
      if (parts[1] && parts[1].length <= 2) {
        // Likely decimal: 12,50
        cleaned = cleaned.replace(",", ".");
      } else {
        // Likely thousands: 1,234
        cleaned = cleaned.replace(",", "");
      }
    }

    const price = parseFloat(cleaned);
    return isNaN(price) ? null : price;
  }

  /**
   * Public API
   */
  return {
    getSiteConfig,
    extractValue,
    cleanPrice,
    SITES,
    GENERIC_SELECTORS,
  };
})();

// Export for browser extension
if (typeof window !== "undefined") {
  window.SiteConfigs = SiteConfigs;
}
