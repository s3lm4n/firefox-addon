// Gelişmiş fiyat algılama ve parsing sistemi
// v2.0 - YENİDEN YAZILDI - Hatasız versiyon

const PriceParser = {
  // Ana extract fonksiyonu
  async extractProductInfo(doc = document, url = window.location.href) {
    const perf = PriceTrackerHelpers.performanceMonitor;
    perf.start('extractProductInfo');
    
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
    
    // 1. Site-specific extraction (en hızlı ve en doğru)
    const siteModule = SiteHelper.getModule(url);
    if (siteModule) {
      const siteData = this.extractFromSiteModule(doc, siteModule);
      if (siteData.price) {
        Object.assign(result, siteData);
        result.confidence = 0.95;
        perf.log('extractProductInfo (site-specific)');
        return result;
      }
    }
    
    // 2. JSON-LD extraction (standart ve güvenilir)
    const jsonLdData = this.extractFromJsonLd(doc);
    if (jsonLdData.price) {
      Object.assign(result, jsonLdData);
      result.confidence = 0.85;
      perf.log('extractProductInfo (JSON-LD)');
      return result;
    }
    
    // 3. Meta tags extraction
    const metaData = this.extractFromMeta(doc);
    if (metaData.price) {
      Object.assign(result, metaData);
      result.confidence = 0.75;
      perf.log('extractProductInfo (meta)');
      return result;
    }
    
    // 4. Smart DOM scanning (son çare)
    const domData = this.extractFromDOM(doc, url);
    if (domData.price) {
      Object.assign(result, domData);
      result.confidence = 0.60;
      perf.log('extractProductInfo (DOM)');
      return result;
    }
    
    perf.end('extractProductInfo');
    return result.price ? result : null;
  },
  
  // 1. Site module'den extract
  extractFromSiteModule(doc, module) {
    const result = {
      name: null,
      price: null,
      currency: module.currency || null,
      image: null
    };
    
    // Custom extractor varsa kullan
    if (module.extractPrice) {
      try {
        result.price = module.extractPrice(doc);
      } catch (e) {
        console.warn('Custom extractor error:', e);
      }
    }
    
    // Selector'lardan fiyat çek
    if (!result.price && module.selectors && module.selectors.price) {
      for (const selector of module.selectors.price) {
        try {
          const element = doc.querySelector(selector);
          if (element) {
            const extracted = this.parsePrice(element.textContent);
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
    
    // Ürün adı
    if (module.selectors && module.selectors.productName) {
      for (const selector of module.selectors.productName) {
        try {
          const element = doc.querySelector(selector);
          if (element && element.textContent.trim().length > 10) {
            result.name = element.textContent.trim();
            break;
          }
        } catch (e) {
          continue;
        }
      }
    }
    
    // Görsel
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
  
  // 2. JSON-LD extraction
  extractFromJsonLd(doc) {
    const result = { name: null, price: null, currency: null, image: null };
    
    try {
      const scripts = doc.querySelectorAll('script[type="application/ld+json"]');
      for (const script of scripts) {
        try {
          const data = JSON.parse(script.textContent);
          
          if (data['@type'] === 'Product' || data.productID) {
            if (data.name) result.name = data.name;
            if (data.image) {
              result.image = Array.isArray(data.image) ? data.image[0] : data.image;
            }
            
            if (data.offers) {
              const offer = Array.isArray(data.offers) ? data.offers[0] : data.offers;
              if (offer.price) {
                result.price = parseFloat(offer.price);
                result.currency = offer.priceCurrency || null;
              }
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
  
  // 3. Meta tags extraction
  extractFromMeta(doc) {
    const result = { name: null, price: null, currency: null, image: null };
    
    try {
      const ogTitle = doc.querySelector('meta[property="og:title"]');
      const ogPrice = doc.querySelector('meta[property="og:price:amount"]');
      const ogCurrency = doc.querySelector('meta[property="og:price:currency"]');
      const ogImage = doc.querySelector('meta[property="og:image"]');
      
      if (ogTitle) result.name = ogTitle.content;
      if (ogPrice) result.price = parseFloat(ogPrice.content);
      if (ogCurrency) result.currency = ogCurrency.content;
      if (ogImage) result.image = ogImage.content;
      
      if (!result.name) {
        const twitterTitle = doc.querySelector('meta[name="twitter:title"]');
        if (twitterTitle) result.name = twitterTitle.content;
      }
      
      if (!result.image) {
        const twitterImage = doc.querySelector('meta[name="twitter:image"]');
        if (twitterImage) result.image = twitterImage.content;
      }
      
      if (!result.price) {
        const productPrice = doc.querySelector('meta[property="product:price:amount"]');
        if (productPrice) result.price = parseFloat(productPrice.content);
      }
    } catch (e) {
      console.warn('Meta extraction error:', e);
    }
    
    return result;
  },
  
  // 4. Smart DOM scanning
  extractFromDOM(doc, url) {
    const perf = PriceTrackerHelpers.performanceMonitor;
    perf.start('extractFromDOM');
    
    const result = { name: null, price: null, currency: null, image: null };
    
    // Para birimi varsayılanı
    let defaultCurrency = 'TL';
    if (url.includes('.com') && !url.includes('.com.tr')) defaultCurrency = '$';
    if (url.includes('.de') || url.includes('.fr') || url.includes('.it')) defaultCurrency = '€';
    if (url.includes('.co.uk')) defaultCurrency = '£';
    
    // Ürün adı
    try {
      const h1Elements = doc.querySelectorAll('h1');
      for (const h1 of h1Elements) {
        const text = h1.textContent.trim();
        if (text.length >= 15 && text.length <= 300) {
          result.name = text;
          break;
        }
      }
      
      if (!result.name) {
        const title = doc.title;
        if (title && title.length > 10) {
          result.name = title.split('|')[0].split(' - ')[0].trim();
        }
      }
    } catch (e) {
      console.warn('Name extraction error:', e);
    }
    
    // Fiyat
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
    
    // Görsel
    try {
      const images = doc.querySelectorAll('img[src*="product"], img[alt*="product"], img.product-image, img#product-image');
      if (images.length > 0) {
        const validImage = Array.from(images).find(img => {
          const rect = img.getBoundingClientRect();
          return rect.width > 200 && rect.height > 200;
        });
        if (validImage) result.image = validImage.src;
      }
    } catch (e) {
      console.warn('Image extraction error:', e);
    }
    
    perf.log('extractFromDOM');
    return result;
  },
  
  // Fiyat adaylarını bul - "SEPETTE" fiyatlarını hariç tut
  findPriceCandidates(doc) {
    const candidates = [];
    const perf = PriceTrackerHelpers.performanceMonitor;
    perf.start('findPriceCandidates');
    
    try {
      const priceContainers = doc.querySelectorAll([
        '[class*="price"]',
        '[id*="price"]',
        '[data-price]',
        '[class*="amount"]',
        '[class*="cost"]',
        '[class*="fiyat"]',
        '[class*="tutar"]'
      ].join(','));
      
      for (const container of priceContainers) {
        try {
          // "SEPETTE" veya "BASKET" içeren elementleri atla
          const containerText = container.textContent.toUpperCase();
          if (containerText.includes('SEPET') || 
              containerText.includes('BASKET') ||
              containerText.includes('CART')) {
            continue;
          }
          
          // Class/ID kontrolü
          const className = (container.className || '').toString().toLowerCase();
          const idName = (container.id || '').toLowerCase();
          if (className.includes('basket') || className.includes('cart') || className.includes('sepet') ||
              idName.includes('basket') || idName.includes('cart') || idName.includes('sepet')) {
            continue;
          }
          
          this.checkElementForPrice(container, candidates);
          
          // Child'ları kontrol et
          for (const child of container.children) {
            try {
              const childText = child.textContent.toUpperCase();
              if (childText.includes('SEPET') || childText.includes('BASKET') || childText.includes('CART')) {
                continue;
              }
              
              if (child.children.length === 0) {
                this.checkElementForPrice(child, candidates);
              }
            } catch (e) {
              continue;
            }
          }
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
  
  // Element fiyat içeriyor mu kontrol et
  checkElementForPrice(element, candidates) {
    try {
      if (!PriceTrackerHelpers.isElementVisible(element)) return;
      
      const text = element.textContent.trim();
      if (text.length < 2 || text.length > 30) return;
      
      const parsed = this.parsePrice(text);
      if (!parsed || !parsed.price) return;
      if (parsed.price < 0.01 || parsed.price > 999999) return;
      
      const rect = element.getBoundingClientRect();
      const computed = window.getComputedStyle(element);
      const fontSize = parseFloat(computed.fontSize) || 12;
      const fontWeight = parseInt(computed.fontWeight) || 400;
      
      const className = (element.className || '').toString().toLowerCase();
      const idName = (element.id || '').toLowerCase();
      const hasPriceKeyword = /price|fiyat|amount|cost|tutar|ucret/.test(className + idName);
      
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
      // Ignore
    }
  },
  
  // Fiyat adaylarını skorla
  scorePriceCandidates(candidates) {
    candidates.forEach(c => {
      let score = 0;
      
      score += Math.min((c.fontSize - 12) * 3, 30);
      
      if (c.fontWeight >= 600) score += 20;
      else if (c.fontWeight >= 500) score += 10;
      
      const idealArea = 10000;
      const areaDiff = Math.abs(c.area - idealArea);
      score += Math.max(0, 20 - (areaDiff / 1000));
      
      if (c.hasCurrencySymbol) score += 30;
      if (c.hasPriceKeyword) score += 25;
      
      if (c.yPosition < 800) score += 15;
      else if (c.yPosition < 1200) score += 5;
      
      const xPos = c.element.getBoundingClientRect().left;
      if (xPos > 50 && xPos < window.innerWidth - 200) score += 10;
      
      c.score = score;
    });
    
    return candidates.sort((a, b) => b.score - a.score);
  },
  
  // Metinden fiyat parse et
  parsePrice(text) {
    if (!text) return null;
    
    try {
      text = text.trim().replace(/\s+/g, ' ');
      
      const patterns = [
        { regex: /(\d{1,3}(?:\.\d{3})+,\d{1,2})\s*(?:TL|₺|tl|TRY)/i, type: 'tr', currency: 'TL', hasCurrency: true },
        { regex: /(\d+,\d{1,2})\s*(?:TL|₺|tl|TRY)/i, type: 'tr', currency: 'TL', hasCurrency: true },
        { regex: /(?:TL|₺|tl|TRY)\s*(\d{1,3}(?:\.\d{3})+,\d{1,2})/i, type: 'tr', currency: 'TL', hasCurrency: true },
        { regex: /(?:TL|₺|tl|TRY)\s*(\d+,\d{1,2})/i, type: 'tr', currency: 'TL', hasCurrency: true },
        
        { regex: /\$\s*(\d{1,3}(?:,\d{3})*(?:\.\d{1,2})?)/i, type: 'us', currency: '$', hasCurrency: true },
        { regex: /(\d{1,3}(?:,\d{3})*\.\d{1,2})\s*(?:USD|\$)/i, type: 'us', currency: '$', hasCurrency: true },
        { regex: /(\d+\.\d{1,2})\s*(?:USD|\$)/i, type: 'us', currency: '$', hasCurrency: true },
        
        { regex: /€\s*(\d{1,3}(?:[,\.]\d{3})*[,\.]\d{1,2})/i, type: 'eu', currency: '€', hasCurrency: true },
        { regex: /(\d{1,3}(?:[,\.]\d{3})*[,\.]\d{1,2})\s*(?:EUR|€)/i, type: 'eu', currency: '€', hasCurrency: true },
        
        { regex: /£\s*(\d{1,3}(?:,\d{3})*\.\d{1,2})/i, type: 'gb', currency: '£', hasCurrency: true },
        { regex: /(\d{1,3}(?:,\d{3})*\.\d{1,2})\s*(?:GBP|£)/i, type: 'gb', currency: '£', hasCurrency: true },
        
        { regex: /(\d{1,3}(?:\.\d{3})+,\d{1,2})(?!\d)/i, type: 'tr', currency: null, hasCurrency: false },
        { regex: /(\d{1,3}(?:,\d{3})+\.\d{1,2})(?!\d)/i, type: 'us', currency: null, hasCurrency: false },
        { regex: /(\d+,\d{1,2})(?!\d)/i, type: 'tr', currency: null, hasCurrency: false },
        { regex: /(\d+\.\d{1,2})(?!\d)/i, type: 'us', currency: null, hasCurrency: false }
      ];
      
      for (const pattern of patterns) {
        const match = text.match(pattern.regex);
        if (match) {
          let priceStr = match[1];
          
          if (pattern.type === 'tr') {
            priceStr = priceStr.replace(/\./g, '').replace(',', '.');
          } else if (pattern.type === 'us' || pattern.type === 'gb') {
            priceStr = priceStr.replace(/,/g, '');
          } else if (pattern.type === 'eu') {
            if (priceStr.includes(',') && priceStr.includes('.')) {
              const lastComma = priceStr.lastIndexOf(',');
              const lastDot = priceStr.lastIndexOf('.');
              if (lastComma > lastDot) {
                priceStr = priceStr.replace(/\./g, '').replace(',', '.');
              } else {
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
  }
};

// Global olarak erişilebilir yap
if (typeof window !== 'undefined') {
  window.PriceParser = PriceParser;
}