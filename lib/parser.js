// Enhanced Price Parser v3.0
// Handles split prices, dynamic content, modern attributes, and all currency formats

const PriceParser = {
  // Memoization cache
  _parseCache: new Map(),
  _CACHE_MAX_SIZE: 100,
  
  // Performance tuning
  _MAX_CONTAINER_CHILDREN: 30,
  _MAX_PRICE_CANDIDATES: 75,
  _MUTATION_DEBOUNCE: 300,
  
  // Currency symbols and patterns
  _CURRENCIES: {
    TL: ['TL', '₺', 'TRY', 'tl', 'try'],
    USD: ['$', 'USD', 'usd'],
    EUR: ['€', 'EUR', 'eur'],
    GBP: ['£', 'GBP', 'gbp', '£']
  },
  
  /**
   * Main extraction function - tries multiple strategies
   */
  async extractProductInfo(doc = document, url = window.location.href) {
    const perf = PriceTrackerHelpers.performanceMonitor;
    perf.start('extractProductInfo');
    
    // Check cache
    const cacheKey = url + '_' + (doc.title || '');
    if (this._parseCache.has(cacheKey)) {
      const cached = this._parseCache.get(cacheKey);
      if (Date.now() - cached.timestamp < 10000) {
        perf.end('extractProductInfo');
        return cached.result;
      }
    }
    
    const result = {
      name: null,
      price: null,
      currency: null,
      image: null,
      url: url,
      site: PriceTrackerHelpers.getHostname(url),
      timestamp: Date.now(),
      confidence: 0
    };
    
    // Strategy 1: Site-specific extraction (highest accuracy)
    const siteModule = SiteHelper.getModule(url);
    if (siteModule) {
      const siteData = this.extractFromSiteModule(doc, siteModule);
      if (siteData.price) {
        Object.assign(result, siteData);
        result.confidence = 0.95;
        this._cacheResult(cacheKey, result);
        perf.log('extractProductInfo (site-specific)');
        return result;
      }
    }
    
    // Strategy 2: JSON-LD structured data
    const jsonLdData = this.extractFromJsonLd(doc);
    if (jsonLdData.price) {
      Object.assign(result, jsonLdData);
      result.confidence = 0.85;
      this._cacheResult(cacheKey, result);
      perf.log('extractProductInfo (JSON-LD)');
      return result;
    }
    
    // Strategy 3: Meta tags (Open Graph, Twitter Cards)
    const metaData = this.extractFromMeta(doc);
    if (metaData.price) {
      Object.assign(result, metaData);
      result.confidence = 0.75;
      this._cacheResult(cacheKey, result);
      perf.log('extractProductInfo (meta)');
      return result;
    }
    
    // Strategy 4: Modern attributes (data-testid, aria-label, etc.)
    const modernData = this.extractFromModernAttributes(doc, url);
    if (modernData.price) {
      Object.assign(result, modernData);
      result.confidence = 0.80;
      this._cacheResult(cacheKey, result);
      perf.log('extractProductInfo (modern-attrs)');
      return result;
    }
    
    // Strategy 5: Smart DOM scanning (fallback)
    const domData = this.extractFromDOM(doc, url);
    if (domData.price) {
      Object.assign(result, domData);
      result.confidence = 0.60;
      this._cacheResult(cacheKey, result);
      perf.log('extractProductInfo (DOM)');
      return result;
    }
    
    perf.end('extractProductInfo');
    return result.price ? result : null;
  },
  
  /**
   * Cache result with size management
   */
  _cacheResult(key, result) {
    if (this._parseCache.size >= this._CACHE_MAX_SIZE) {
      const firstKey = this._parseCache.keys().next().value;
      this._parseCache.delete(firstKey);
    }
    this._parseCache.set(key, {
      result: result,
      timestamp: Date.now()
    });
  },
  
  /**
   * Extract from site-specific module
   */
  extractFromSiteModule(doc, module) {
    const result = {
      name: null,
      price: null,
      currency: module.currency || null,
      image: null
    };
    
    // Custom extractor
    if (module.extractPrice) {
      try {
        result.price = module.extractPrice(doc);
      } catch (e) {
        console.warn('Custom extractor error:', e);
      }
    }
    
    // Selector-based extraction
    if (!result.price && module.selectors && module.selectors.price) {
      for (const selector of module.selectors.price) {
        try {
          const element = doc.querySelector(selector);
          if (element) {
            const extracted = this.parsePrice(this._getFullText(element));
            if (extracted && extracted.price) {
              result.price = extracted.price;
              result.currency = extracted.currency || result.currency;
              break;
            }
          }
        } catch (e) {
          continue;
        }
      }
    }
    
    // Product name
    if (module.selectors && module.selectors.productName) {
      for (const selector of module.selectors.productName) {
        try {
          const element = doc.querySelector(selector);
          if (element && element.textContent.trim().length > 10) {
            result.name = this._cleanText(element.textContent);
            break;
          }
        } catch (e) {
          continue;
        }
      }
    }
    
    // Image
    if (module.selectors && module.selectors.image) {
      for (const selector of module.selectors.image) {
        try {
          const element = doc.querySelector(selector);
          if (element && element.src) {
            result.image = element.src;
            break;
          }
        } catch (e) {
          continue;
        }
      }
    }
    
    return result;
  },
  
  /**
   * Extract from JSON-LD structured data
   */
  extractFromJsonLd(doc) {
    const result = { name: null, price: null, currency: null, image: null };
    
    try {
      const scripts = doc.querySelectorAll('script[type="application/ld+json"]');
      
      for (const script of scripts) {
        try {
          const data = JSON.parse(script.textContent);
          
          // Handle arrays of objects
          const items = Array.isArray(data) ? data : [data];
          
          for (const item of items) {
            if (item['@type'] === 'Product' || item.productID) {
              if (item.name) result.name = item.name;
              if (item.image) {
                result.image = Array.isArray(item.image) ? item.image[0] : item.image;
              }
              
              if (item.offers) {
                const offer = Array.isArray(item.offers) ? item.offers[0] : item.offers;
                if (offer.price) {
                  const priceValue = parseFloat(offer.price);
                  if (!isNaN(priceValue)) {
                    result.price = priceValue;
                    result.currency = offer.priceCurrency || null;
                  }
                }
              }
              
              if (result.price) break;
            }
          }
          
          if (result.price) break;
        } catch (e) {
          continue;
        }
      }
    } catch (e) {
      console.warn('JSON-LD extraction error:', e);
    }
    
    return result;
  },
  
  /**
   * Extract from meta tags
   */
  extractFromMeta(doc) {
    const result = { name: null, price: null, currency: null, image: null };
    
    try {
      // Open Graph
      const ogTitle = doc.querySelector('meta[property="og:title"]');
      const ogPrice = doc.querySelector('meta[property="og:price:amount"]');
      const ogCurrency = doc.querySelector('meta[property="og:price:currency"]');
      const ogImage = doc.querySelector('meta[property="og:image"]');
      
      if (ogTitle) result.name = ogTitle.content;
      if (ogPrice) result.price = parseFloat(ogPrice.content);
      if (ogCurrency) result.currency = ogCurrency.content;
      if (ogImage) result.image = ogImage.content;
      
      // Twitter Cards
      if (!result.name) {
        const twitterTitle = doc.querySelector('meta[name="twitter:title"]');
        if (twitterTitle) result.name = twitterTitle.content;
      }
      
      if (!result.image) {
        const twitterImage = doc.querySelector('meta[name="twitter:image"]');
        if (twitterImage) result.image = twitterImage.content;
      }
      
      // Product-specific meta
      if (!result.price) {
        const productPrice = doc.querySelector('meta[property="product:price:amount"]');
        if (productPrice) result.price = parseFloat(productPrice.content);
      }
    } catch (e) {
      console.warn('Meta extraction error:', e);
    }
    
    return result;
  },
  
  /**
   * Extract from modern attributes (data-testid, aria-label, etc.)
   */
  extractFromModernAttributes(doc, url) {
    const result = { name: null, price: null, currency: null, image: null };
    
    // Default currency based on URL
    let defaultCurrency = this._guessCurrency(url);
    
    try {
      // Modern price selectors
      const priceSelectors = [
        '[data-testid*="price"]',
        '[data-test*="price"]',
        '[data-cy*="price"]',
        '[aria-label*="price" i]',
        '[aria-label*="fiyat" i]',
        '[data-price]',
        '[itemprop="price"]',
        '[class*="price"][data-testid]',
        'span[data-testid][class*="price"]'
      ];
      
      for (const selector of priceSelectors) {
        try {
          const elements = doc.querySelectorAll(selector);
          for (const el of elements) {
            // Check aria-label first
            if (el.hasAttribute('aria-label')) {
              const parsed = this.parsePrice(el.getAttribute('aria-label'));
              if (parsed && parsed.price) {
                result.price = parsed.price;
                result.currency = parsed.currency || defaultCurrency;
                break;
              }
            }
            
            // Check data-price attribute
            if (el.hasAttribute('data-price')) {
              const parsed = this.parsePrice(el.getAttribute('data-price'));
              if (parsed && parsed.price) {
                result.price = parsed.price;
                result.currency = parsed.currency || defaultCurrency;
                break;
              }
            }
            
            // Check text content (including split elements)
            const fullText = this._getFullText(el);
            const parsed = this.parsePrice(fullText);
            if (parsed && parsed.price) {
              result.price = parsed.price;
              result.currency = parsed.currency || defaultCurrency;
              break;
            }
          }
          if (result.price) break;
        } catch (e) {
          continue;
        }
      }
      
      // Modern name selectors
      if (!result.name) {
        const nameSelectors = [
          '[data-testid*="product-name"]',
          '[data-testid*="title"]',
          '[aria-label*="product" i]',
          '[itemprop="name"]',
          'h1[data-testid]'
        ];
        
        for (const selector of nameSelectors) {
          try {
            const el = doc.querySelector(selector);
            if (el) {
              const text = this._cleanText(el.textContent);
              if (text.length >= 15 && text.length <= 300) {
                result.name = text;
                break;
              }
            }
          } catch (e) {
            continue;
          }
        }
      }
      
      // Modern image selectors
      if (!result.image) {
        const imageSelectors = [
          '[data-testid*="product-image"] img',
          '[data-testid*="image"] img',
          'img[itemprop="image"]'
        ];
        
        for (const selector of imageSelectors) {
          try {
            const el = doc.querySelector(selector);
            if (el && el.src) {
              result.image = el.src;
              break;
            }
          } catch (e) {
            continue;
          }
        }
      }
      
    } catch (e) {
      console.warn('Modern attributes extraction error:', e);
    }
    
    return result;
  },
  
  /**
   * Smart DOM scanning with split price handling
   */
  extractFromDOM(doc, url) {
    const perf = PriceTrackerHelpers.performanceMonitor;
    perf.start('extractFromDOM');
    
    const result = { name: null, price: null, currency: null, image: null };
    const defaultCurrency = this._guessCurrency(url);
    
    // Product name
    try {
      const h1Elements = doc.querySelectorAll('h1');
      for (const h1 of h1Elements) {
        const text = this._cleanText(h1.textContent);
        if (text.length >= 15 && text.length <= 300) {
          result.name = text;
          break;
        }
      }
      
      if (!result.name) {
        const title = doc.title;
        if (title && title.length > 10) {
          result.name = this._cleanText(title.split('|')[0].split(' - ')[0]);
        }
      }
    } catch (e) {
      console.warn('Name extraction error:', e);
    }
    
    // Price - find candidates and score
    try {
      const candidates = this.findPriceCandidates(doc);
      
      if (candidates.length > 0) {
        const scored = this.scorePriceCandidates(candidates);
        const best = scored[0];
        
        result.price = best.price;
        result.currency = best.currency || defaultCurrency;
      }
    } catch (e) {
      console.warn('Price extraction error:', e);
    }
    
    // Image
    try {
      const imageSelectors = [
        'img[src*="product"]',
        'img[alt*="product" i]',
        'img.product-image',
        'img#product-image',
        '[class*="product"] img',
        '[id*="product"] img'
      ];
      
      for (const selector of imageSelectors) {
        const images = doc.querySelectorAll(selector);
        const validImage = Array.from(images).find(img => {
          const rect = img.getBoundingClientRect();
          return rect.width > 200 && rect.height > 200 && img.src;
        });
        if (validImage) {
          result.image = validImage.src;
          break;
        }
      }
    } catch (e) {
      console.warn('Image extraction error:', e);
    }
    
    perf.log('extractFromDOM');
    return result;
  },
  
  /**
   * Find price candidates in DOM (with modern selectors)
   */
  findPriceCandidates(doc) {
    const candidates = [];
    const perf = PriceTrackerHelpers.performanceMonitor;
    perf.start('findPriceCandidates');
    
    try {
      // Extended selectors including modern attributes
      const priceContainers = doc.querySelectorAll([
        '[class*="price"]',
        '[id*="price"]',
        '[data-price]',
        '[data-testid*="price"]',
        '[data-test*="price"]',
        '[data-cy*="price"]',
        '[class*="amount"]',
        '[class*="cost"]',
        '[class*="fiyat"]',
        '[class*="tutar"]',
        '[itemprop="price"]',
        '[aria-label*="price" i]',
        '[aria-label*="fiyat" i]'
      ].join(','));
      
      const excludePattern = /sepet|basket|cart|shipping|kargo|toplam|total/i;
      
      for (const container of priceContainers) {
        try {
          // Early filtering
          const className = (container.className || '').toString();
          const idName = (container.id || '');
          
          if (excludePattern.test(className) || excludePattern.test(idName)) {
            continue;
          }
          
          const containerText = container.textContent;
          if (containerText.length > 100 || excludePattern.test(containerText)) {
            continue;
          }
          
          // Check element and its children
          this.checkElementForPrice(container, candidates);
          
          const children = container.children;
          if (children.length > 0 && children.length <= this._MAX_CONTAINER_CHILDREN) {
            // Check direct children
            for (const child of children) {
              this.checkElementForPrice(child, candidates);
            }
          }
          
          // Check parent (for split prices like <div><span>1</span><span>299</span></div>)
          if (container.children.length > 1 && container.children.length <= 5) {
            const combinedText = this._getFullText(container);
            const parsed = this.parsePrice(combinedText);
            if (parsed && parsed.price) {
              const rect = container.getBoundingClientRect();
              const computed = window.getComputedStyle(container);
              const fontSize = parseFloat(computed.fontSize) || 12;
              const fontWeight = parseInt(computed.fontWeight) || 400;
              
              candidates.push({
                price: parsed.price,
                currency: parsed.currency,
                element: container,
                fontSize: fontSize,
                fontWeight: fontWeight,
                area: rect.width * rect.height,
                yPosition: rect.top,
                hasCurrencySymbol: parsed.hasCurrency,
                hasPriceKeyword: true,
                text: combinedText,
                isCombined: true
              });
            }
          }
          
          if (candidates.length >= this._MAX_PRICE_CANDIDATES) break;
        } catch (e) {
          continue;
        }
      }
    } catch (e) {
      console.warn('findPriceCandidates error:', e);
    }
    
    perf.log('findPriceCandidates');
    return candidates;
  },
  
  /**
   * Check if element contains price
   */
  checkElementForPrice(element, candidates) {
    try {
      if (!PriceTrackerHelpers.isElementVisible(element)) return;
      
      // Get full text (handles split prices)
      const text = this._getFullText(element);
      if (text.length < 2 || text.length > 50) return;
      
      const parsed = this.parsePrice(text);
      if (!parsed || !parsed.price) return;
      if (parsed.price < 0.01 || parsed.price > 999999) return;
      
      const rect = element.getBoundingClientRect();
      const computed = window.getComputedStyle(element);
      const fontSize = parseFloat(computed.fontSize) || 12;
      const fontWeight = parseInt(computed.fontWeight) || 400;
      
      const className = (element.className || '').toString().toLowerCase();
      const idName = (element.id || '').toLowerCase();
      const testId = (element.getAttribute('data-testid') || '').toLowerCase();
      const hasPriceKeyword = /price|fiyat|amount|cost|tutar|ucret/.test(className + idName + testId);
      
      candidates.push({
        price: parsed.price,
        currency: parsed.currency,
        element: element,
        fontSize: fontSize,
        fontWeight: fontWeight,
        area: rect.width * rect.height,
        yPosition: rect.top,
        hasCurrencySymbol: parsed.hasCurrency,
        hasPriceKeyword: hasPriceKeyword,
        text: text
      });
    } catch (e) {
      // Silent fail
    }
  },
  
  /**
   * Score and rank price candidates
   */
  scorePriceCandidates(candidates) {
    candidates.forEach(c => {
      let score = 0;
      
      // Font size (larger = more likely to be main price)
      score += Math.min((c.fontSize - 12) * 3, 30);
      
      // Font weight
      if (c.fontWeight >= 600) score += 20;
      else if (c.fontWeight >= 500) score += 10;
      
      // Area (not too small, not too large)
      const idealArea = 10000;
      const areaDiff = Math.abs(c.area - idealArea);
      score += Math.max(0, 20 - (areaDiff / 1000));
      
      // Has currency symbol
      if (c.hasCurrencySymbol) score += 30;
      
      // Has price keyword in class/id
      if (c.hasPriceKeyword) score += 25;
      
      // Position (higher on page = more likely)
      if (c.yPosition < 800) score += 15;
      else if (c.yPosition < 1200) score += 5;
      
      // Horizontal position (centered is good)
      const xPos = c.element.getBoundingClientRect().left;
      if (xPos > 50 && xPos < window.innerWidth - 200) score += 10;
      
      // Combined price (from multiple spans) gets bonus
      if (c.isCombined) score += 15;
      
      c.score = score;
    });
    
    return candidates.sort((a, b) => b.score - a.score);
  },
  
  /**
   * Parse price from text - ENHANCED with split price support
   */
  parsePrice(text) {
    if (!text) return null;
    
    try {
      // Normalize text: clean whitespace, non-breaking spaces, etc.
      text = this._cleanText(text);
      
      // Enhanced patterns for all currencies and formats
      const patterns = [
        // Turkish Lira - various formats
        { regex: /(\d{1,3}(?:[.\s]\d{3})+[,]\d{1,2})\s*(?:TL|₺|tl|TRY)/i, type: 'tr', currency: 'TL', hasCurrency: true },
        { regex: /(\d+[,]\d{1,2})\s*(?:TL|₺|tl|TRY)/i, type: 'tr', currency: 'TL', hasCurrency: true },
        { regex: /(?:TL|₺|tl|TRY)\s*(\d{1,3}(?:[.\s]\d{3})+[,]\d{1,2})/i, type: 'tr', currency: 'TL', hasCurrency: true },
        { regex: /(?:TL|₺|tl|TRY)\s*(\d+[,]\d{1,2})/i, type: 'tr', currency: 'TL', hasCurrency: true },
        
        // USD - symbol before/after
        { regex: /\$\s*(\d{1,3}(?:,\d{3})*(?:\.\d{1,2})?)/i, type: 'us', currency: '$', hasCurrency: true },
        { regex: /(\d{1,3}(?:,\d{3})*[.]\d{1,2})\s*(?:USD|\$)/i, type: 'us', currency: '$', hasCurrency: true },
        { regex: /(\d+[.]\d{1,2})\s*(?:USD|\$)/i, type: 'us', currency: '$', hasCurrency: true },
        
        // EUR
        { regex: /€\s*(\d{1,3}(?:[,.\s]\d{3})*[,\.]\d{1,2})/i, type: 'eu', currency: '€', hasCurrency: true },
        { regex: /(\d{1,3}(?:[,.\s]\d{3})*[,\.]\d{1,2})\s*(?:EUR|€)/i, type: 'eu', currency: '€', hasCurrency: true },
        
        // GBP
        { regex: /£\s*(\d{1,3}(?:,\d{3})*[.]\d{1,2})/i, type: 'gb', currency: '£', hasCurrency: true },
        { regex: /(\d{1,3}(?:,\d{3})*[.]\d{1,2})\s*(?:GBP|£)/i, type: 'gb', currency: '£', hasCurrency: true },
        
        // Generic patterns (no currency symbol)
        { regex: /(\d{1,3}(?:[.\s]\d{3})+[,]\d{1,2})(?!\d)/i, type: 'tr', currency: null, hasCurrency: false },
        { regex: /(\d{1,3}(?:,\d{3})+[.]\d{1,2})(?!\d)/i, type: 'us', currency: null, hasCurrency: false },
        { regex: /(\d+[,]\d{1,2})(?!\d)/i, type: 'tr', currency: null, hasCurrency: false },
        { regex: /(\d+[.]\d{1,2})(?!\d)/i, type: 'us', currency: null, hasCurrency: false }
      ];
      
      for (const pattern of patterns) {
        const match = text.match(pattern.regex);
        if (match) {
          let priceStr = match[1];
          
          // Normalize based on format type
          if (pattern.type === 'tr') {
            // Turkish: 1.299,99 -> 1299.99
            priceStr = priceStr.replace(/\s/g, '').replace(/\./g, '').replace(',', '.');
          } else if (pattern.type === 'us' || pattern.type === 'gb') {
            // US/UK: 1,299.99 -> 1299.99
            priceStr = priceStr.replace(/,/g, '');
          } else if (pattern.type === 'eu') {
            // EU: handle both , and . as decimal/thousand sep
            if (priceStr.includes(',') && priceStr.includes('.')) {
              const lastComma = priceStr.lastIndexOf(',');
              const lastDot = priceStr.lastIndexOf('.');
              if (lastComma > lastDot) {
                // 1.999,99 format
                priceStr = priceStr.replace(/\./g, '').replace(',', '.');
              } else {
                // 1,999.99 format
                priceStr = priceStr.replace(/,/g, '');
              }
            } else if (priceStr.includes(',')) {
              priceStr = priceStr.replace(',', '.');
            }
          }
          
          const price = parseFloat(priceStr);
          
          if (!isNaN(price) && price > 0) {
            return {
              price: price,
              currency: pattern.currency,
              hasCurrency: pattern.hasCurrency,
              originalText: text
            };
          }
        }
      }
    } catch (e) {
      console.warn('Parse price error:', e);
    }
    
    return null;
  },
  
  /**
   * Get full text from element, combining split children
   * Handles cases like: <div><span>1</span><span>299</span><span>,99</span></div>
   */
  _getFullText(element) {
    if (!element) return '';
    
    // If element has no children or very few, use textContent
    if (element.children.length === 0) {
      return this._cleanText(element.textContent);
    }
    
    // For elements with children, combine intelligently
    let fullText = '';
    const walker = document.createTreeWalker(
      element,
      NodeFilter.SHOW_TEXT,
      null,
      false
    );
    
    let node;
    while (node = walker.nextNode()) {
      const text = node.textContent.trim();
      if (text) {
        fullText += text;
      }
    }
    
    return this._cleanText(fullText);
  },
  
  /**
   * Clean and normalize text
   */
  _cleanText(text) {
    if (!text) return '';
    
    return text
      // Replace non-breaking spaces with regular spaces
      .replace(/\u00A0/g, ' ')
      // Replace zero-width spaces
      .replace(/\u200B/g, '')
      // Normalize multiple spaces
      .replace(/\s+/g, ' ')
      // Trim
      .trim();
  },
  
  /**
   * Guess currency from URL
   */
  _guessCurrency(url) {
    if (!url) return 'TL';
    
    if (url.includes('.tr') || url.includes('trendyol') || url.includes('hepsiburada')) {
      return 'TL';
    }
    if (url.includes('.com.tr')) return 'TL';
    if (url.includes('.de') || url.includes('.fr') || url.includes('.it') || url.includes('.es')) return '€';
    if (url.includes('.co.uk')) return '£';
    if (url.includes('.com')) return '$';
    
    return 'TL';
  }
};

// Export globally
if (typeof window !== 'undefined') {
  window.PriceParser = PriceParser;
}