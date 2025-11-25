// Enhanced Price Parser v4.0 - Intelligent Multi-Strategy Detection
// Comprehensive price extraction with confidence scoring

const PriceParser = (() => {
  "use strict";

  const logger = {
    info: (...args) => console.log("[PriceParser]", ...args),
    warn: (...args) => console.warn("[PriceParser]", ...args),
    error: (...args) => console.error("[PriceParser]", ...args),
    success: (...args) => console.log("[PriceParser] ✅", ...args),
  };

  /**
   * Main extraction function
   */
  async function extractProductInfo(
    doc = document,
    url = window.location.href
  ) {
    logger.info("🔍 Starting enhanced extraction...");

    const startTime = performance.now();

    try {
      // Get site configuration
      const siteConfig = SiteConfigs.getSiteConfig(url);

      if (!siteConfig) {
        throw new Error("Could not determine site configuration");
      }

      logger.info(`📍 Site: ${siteConfig.name} (${siteConfig.domain})`);

      // Strategy 1: Site-specific selectors (highest priority)
      let result = extractWithSiteConfig(doc, siteConfig, url);

      // Strategy 2: Schema.org microdata
      if (!result || result.confidence < Config.CONFIDENCE.MEDIUM) {
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
      if (!result || result.confidence < Config.CONFIDENCE.LOW) {
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
      if (!result || result.confidence < Config.CONFIDENCE.MINIMUM) {
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
    } catch (error) {
      logger.error("❌ Extraction error:", error);
      return null;
    }
  }

  /**
   * Strategy 1: Extract using site-specific configuration
   */
  function extractWithSiteConfig(doc, config, url) {
    logger.info("🎯 Using site-specific selectors...");

    try {
      // Extract price
      const priceStr = SiteConfigs.extractValue(doc, config.selectors.price);
      const price = SiteConfigs.cleanPrice(priceStr);

      if (!price || price <= 0) {
        logger.warn("⚠️ No valid price found with site config");
        return null;
      }

      // Extract name
      const name = SiteConfigs.extractValue(doc, config.selectors.name);

      if (!name || name.length < 3) {
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
        previousPrice = SiteConfigs.cleanPrice(prevStr);
      }

      // Extract image (optional)
      let image = null;
      if (config.selectors.image) {
        image = SiteConfigs.extractValue(doc, config.selectors.image);
        if (image && !image.startsWith("http")) {
          image = new URL(image, url).href;
        }
      }

      return {
        name: cleanProductName(name),
        price: price,
        previousPrice: previousPrice,
        currency: config.currency || detectCurrency(priceStr) || "TRY",
        url: url,
        site: config.name,
        image: image,
        confidence: Config.CONFIDENCE.HIGH,
        method: "site-config",
      };
    } catch (error) {
      logger.error("Site config extraction error:", error);
      return null;
    }
  }

  /**
   * Strategy 2: Extract from Schema.org microdata
   */
  function extractFromSchema(doc, url) {
    logger.info("📋 Checking schema.org microdata...");

    try {
      const priceEl = doc.querySelector('[itemprop="price"]');
      const nameEl = doc.querySelector('[itemprop="name"]');

      if (!priceEl || !nameEl) {
        return null;
      }

      const priceStr = priceEl.getAttribute("content") || priceEl.textContent;
      const price = SiteConfigs.cleanPrice(priceStr);

      if (!price || price <= 0) {
        return null;
      }

      const name = nameEl.textContent || nameEl.getAttribute("content");

      // Try to get currency
      let currency = "TRY";
      const currencyEl = doc.querySelector('[itemprop="priceCurrency"]');
      if (currencyEl) {
        currency =
          currencyEl.getAttribute("content") || currencyEl.textContent || "TRY";
      } else {
        currency = detectCurrency(priceStr);
      }

      return {
        name: cleanProductName(name),
        price: price,
        currency: currency,
        url: url,
        site: getSiteName(url),
        confidence: 0.85, // Between HIGH and MEDIUM
        method: "schema.org",
      };
    } catch (error) {
      logger.error("Schema extraction error:", error);
      return null;
    }
  }

  /**
   * Strategy 3: Extract using advanced heuristics
   */
  function extractWithHeuristics(doc, url) {
    logger.info("🧠 Using heuristic analysis...");

    try {
      // Find price candidates
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

      if (!name || name.length < 3) {
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
      logger.error("Heuristic extraction error:", error);
      return null;
    }
  }

  /**
   * Strategy 4: Extract from JSON-LD structured data
   */
  function extractFromJsonLd(doc, url) {
    logger.info("📄 Checking JSON-LD data...");

    try {
      const scripts = doc.querySelectorAll(
        'script[type="application/ld+json"]'
      );

      for (const script of scripts) {
        try {
          const data = JSON.parse(script.textContent);

          // Handle arrays
          const items = Array.isArray(data) ? data : [data];

          for (const item of items) {
            if (item["@type"] === "Product" && item.offers) {
              const offer = Array.isArray(item.offers)
                ? item.offers[0]
                : item.offers;

              if (offer.price || offer.lowPrice) {
                const priceValue = offer.price || offer.lowPrice;
                const price =
                  typeof priceValue === "number"
                    ? priceValue
                    : SiteConfigs.cleanPrice(String(priceValue));

                if (price && price > 0) {
                  return {
                    name: cleanProductName(item.name || ""),
                    price: price,
                    currency: offer.priceCurrency || "TRY",
                    url: url,
                    site: getSiteName(url),
                    image: item.image || null,
                    confidence: 0.9,
                    method: "json-ld",
                  };
                }
              }
            }
          }
        } catch (parseError) {
          logger.warn("Failed to parse JSON-LD script:", parseError);
        }
      }

      return null;
    } catch (error) {
      logger.error("JSON-LD extraction error:", error);
      return null;
    }
  }

  /**
   * Find price candidates in the document
   */
  function findPriceCandidates(doc) {
    const candidates = [];
    const processed = new Set();

    // Patterns to match prices
    const pricePattern =
      /(?:^|\s)([\d.,]{1,10})(?:\s*(?:TL|₺|TRY|USD|\$|EUR|€))?(?:\s|$)/gi;

    // Keywords that indicate price
    const priceKeywords = [
      "price",
      "fiyat",
      "tutar",
      "ucret",
      "bedel",
      "cost",
      "amount",
      "checkout",
      "sale",
      "discount",
      "indirim",
    ];

    // Find all elements with price-related classes or attributes
    const priceElements = [];

    // Search by class/id
    for (const keyword of priceKeywords) {
      const selector = `[class*="${keyword}"], [id*="${keyword}"], [data-*="${keyword}"]`;
      try {
        priceElements.push(...doc.querySelectorAll(selector));
      } catch (e) {
        // Invalid selector, skip
      }
    }

    // Also check common price containers
    priceElements.push(...doc.querySelectorAll("span, div, p"));

    for (const el of priceElements) {
      // Skip if already processed or hidden
      if (processed.has(el) || !isVisible(el)) {
        continue;
      }

      processed.add(el);

      const text = el.textContent?.trim() || "";

      if (text.length > 50 || text.length < 2) {
        continue;
      }

      // Extract price
      const matches = [...text.matchAll(pricePattern)];

      for (const match of matches) {
        const priceStr = match[1];
        const price = SiteConfigs.cleanPrice(priceStr);

        if (price && price > 0 && price < 1000000) {
          candidates.push({
            element: el,
            price: price,
            text: text,
            currency: detectCurrency(text),
            className: el.className || "",
            id: el.id || "",
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
    let score = 5; // Base score

    const className = (candidate.className || "").toLowerCase();
    const id = (candidate.id || "").toLowerCase();
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

    // Check element prominence
    const computedStyle = window.getComputedStyle(candidate.element);
    const fontSize = parseFloat(computedStyle.fontSize);
    const fontWeight = computedStyle.fontWeight;

    if (fontSize > 20) {
      score += 2;
    } else if (fontSize > 16) {
      score += 1;
    }

    if (fontWeight === "bold" || parseInt(fontWeight) >= 600) {
      score += 1;
    }

    // Negative indicators (decrease score)
    if (/old|prev|was|regular|original|market/i.test(combined)) {
      score -= 3;
    }

    if (/shipping|cargo|kargo|vergi|tax/i.test(combined)) {
      score -= 2;
    }

    // Price range check (too low or too high is suspicious)
    if (candidate.price < 1) {
      score -= 2;
    } else if (candidate.price > 100000) {
      score -= 1;
    }

    return score;
  }

  /**
   * Find product name
   */
  function findProductName(doc) {
    // Try common patterns
    const selectors = [
      'h1[class*="product"]',
      'h1[class*="title"]',
      'h1[class*="name"]',
      '[class*="product"][class*="name"]',
      '[class*="product"][class*="title"]',
      "h1",
    ];

    for (const selector of selectors) {
      try {
        const el = doc.querySelector(selector);
        if (el && el.textContent && el.textContent.trim().length > 3) {
          return el.textContent.trim();
        }
      } catch (e) {
        // Invalid selector
      }
    }

    // Fallback: use page title
    return doc.title || "Unknown Product";
  }

  /**
   * Check if element is visible
   */
  function isVisible(el) {
    if (!el || !el.offsetParent) {
      return false;
    }

    const style = window.getComputedStyle(el);
    return (
      style.display !== "none" &&
      style.visibility !== "hidden" &&
      style.opacity !== "0"
    );
  }

  /**
   * Detect currency from text
   */
  function detectCurrency(text) {
    if (!text) return "TRY";

    text = text.toLowerCase();

    if (text.includes("₺") || text.includes("tl") || text.includes("try")) {
      return "TRY";
    }
    if (text.includes("$") || text.includes("usd")) {
      return "USD";
    }
    if (text.includes("€") || text.includes("eur")) {
      return "EUR";
    }
    if (text.includes("£") || text.includes("gbp")) {
      return "GBP";
    }

    return "TRY"; // Default
  }

  /**
   * Clean product name
   */
  function cleanProductName(name) {
    if (!name) return "Unknown Product";

    return name
      .replace(/\s+/g, " ")
      .replace(/[|›»]/g, " ")
      .trim()
      .substring(0, 200);
  }

  /**
   * Get site name from URL
   */
  function getSiteName(url) {
    try {
      const hostname = new URL(url).hostname;
      return hostname
        .replace(/^www\./, "")
        .replace(/\.com.*$/, "")
        .replace(/\.tr$/, "")
        .split(".")[0]
        .replace(/^./, (c) => c.toUpperCase());
    } catch (e) {
      return "Unknown Site";
    }
  }

  /**
   * Public API
   */
  return {
    extractProductInfo,
  };
})();

// Export for browser extension
if (typeof window !== "undefined") {
  window.PriceParser = PriceParser;
}
