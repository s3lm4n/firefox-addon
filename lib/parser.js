// Gelişmiş fiyat algılama ve parsing sistemi
// v2.0 - Akıllı algoritmalar, performans optimizasyonu

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
        result.confidence = 0.95; // Çok yüksek güven
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
    
    // 4. Smart DOM scanning (son çare, en yavaş ama kapsamlı)
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
      result.price = module.extractPrice(doc);
    }
    
    // Selector'lardan fiyat çek
    if (!result.price && module.selectors.price) {
      for (const selector of module.selectors.price) {
        const element = doc.querySelector(selector);
        if (element) {
          const extracted = this.parsePrice(element.textContent);
          if (extracted && extracted.price) {
            result.price = extracted.price;
            result.currency = extracted.currency || result.currency;
            break;
          }
        }
      }
    }
    
    // Ürün adı
    if (module.selectors.productName) {
      for (const selector of module.selectors.productName) {
        const element = doc.querySelector(selector);
        if (element && element.textContent.trim().length > 10) {
          result.name = element.textContent.trim();
          break;
        }
      }
    }
    
    // Görsel
    if (module.selectors.image) {
      for (const selector of module.selectors.image) {
        const element = doc.querySelector(selector);
        if (element && element.src) {
          result.image = element.src;
          break;
        }
      }
    }
    
    return result;
  },
  
  // 2. JSON-LD extraction
  extractFromJsonLd(doc) {
    const result = { name: null, price: null, currency: null, image: null };
    
    const scripts = doc.querySelectorAll('script[type="application/ld+json"]');
    for (const script of scripts) {
      try {
        const data = JSON.parse(script.textContent);
        
        // Product schema
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
        // JSON parse hatası - devam et
      }
    }
    
    return result;
  },
  
  // 3. Meta tags extraction
  extractFromMeta(doc) {
    const result = { name: null, price: null, currency: null, image: null };
    
    // Open Graph tags
    const ogTitle = doc.querySelector('meta[property="og:title"]');
    const ogPrice = doc.querySelector('meta[property="og:price:amount"]');
    const ogCurrency = doc.querySelector('meta[property="og:price:currency"]');
    const ogImage = doc.querySelector('meta[property="og:image"]');
    
    if (ogTitle) result.name = ogTitle.content;
    if (ogPrice) result.price = parseFloat(ogPrice.content);
    if (ogCurrency) result.currency = ogCurrency.content;
    if (ogImage) result.image = ogImage.content;
    
    // Twitter tags (fallback)
    if (!result.name) {
      const twitterTitle = doc.querySelector('meta[name="twitter:title"]');
      if (twitterTitle) result.name = twitterTitle.content;
    }
    
    if (!result.image) {
      const twitterImage = doc.querySelector('meta[name="twitter:image"]');
      if (twitterImage) result.image = twitterImage.content;
    }
    
    // Product meta tags
    if (!result.price) {
      const productPrice = doc.querySelector('meta[property="product:price:amount"]');
      if (productPrice) result.price = parseFloat(productPrice.content);
    }
    
    return result;
  },
  
  // 4. Smart DOM scanning (optimize edilmiş)
  extractFromDOM(doc, url) {
    const perf = PriceTrackerHelpers.performanceMonitor;
    perf.start('extractFromDOM');
    
    const result = { name: null, price: null, currency: null, image: null };
    
    // Para birimi varsayılanı
    let defaultCurrency = 'TL';
    if (url.includes('.com') && !url.includes('.com.tr')) defaultCurrency = '$';
    if (url.includes('.de') || url.includes('.fr') || url.includes('.it')) defaultCurrency = '€';
    if (url.includes('.co.uk')) defaultCurrency = '£';
    
    // Ürün adı - H1'den al
    const h1Elements = doc.querySelectorAll('h1');
    for (const h1 of h1Elements) {
      const text = h1.textContent.trim();
      if (text.length >= 15 && text.length <= 300) {
        result.name = text;
        break;
      }
    }
    
    // Fallback: title
    if (!result.name) {
      const title = doc.title;
      if (title && title.length > 10) {
        result.name = title.split('|')[0].split(' - ')[0].trim();
      }
    }
    
    // Fiyat - akıllı tarama
    const candidates = this.findPriceCandidates(doc);
    
    if (candidates.length > 0) {
      // Skorlama ve en iyi adayı seç
      const scored = this.scorePriceCandidates(candidates);
      const best = scored[0];
      
      result.price = best.price;
      result.currency = best.currency || defaultCurrency;
    }
    
    // Görsel
    const images = doc.querySelectorAll('img[src*="product"], img[alt*="product"], img.product-image, img#product-image');
    if (images.length > 0) {
      const validImage = Array.from(images).find(img => {
        const rect = img.getBoundingClientRect();
        return rect.width > 200 && rect.height > 200;
      });
      if (validImage) result.image = validImage.src;
    }
    
    perf.log('extractFromDOM');
    return result;
  },
  
  // Fiyat adaylarını bul (optimize edilmiş - sadece muhtemel elementler)
  findPriceCandidates(doc) {
    const candidates = [];
    const perf = PriceTrackerHelpers.performanceMonitor;
    perf.start('findPriceCandidates');
    
    // Stratejik selector'lar - tüm DOM'u taramak yerine
    const priceContainers = doc.querySelectorAll([
      '[class*="price"]',
      '[id*="price"]',
      '[data-price]',
      '[class*="amount"]',
      '[class*="cost"]',
      '[class*="fiyat"]',
      '[class*="tutar"]'
    ].join(','));
    
    // Her container'ı ve child'larını kontrol et
    for (const container of priceContainers) {
      // Container'ın kendisi
      this.checkElementForPrice(container, candidates);
      
      // Sadece ilk seviye child'lar (performans için)
      for (const child of container.children) {
        if (child.children.length === 0) { // Leaf node
          this.checkElementForPrice(child, candidates);
        }
      }
    }
    
    perf.log('findPriceCandidates');
    return candidates;
  },
  
  // Element fiyat içeriyor mu kontrol et
  checkElementForPrice(element, candidates) {
    // Sadece visible elementler
    if (!PriceTrackerHelpers.isElementVisible(element)) return;
    
    const text = element.textContent.trim();
    
    // Çok uzun veya çok kısa metinleri atla
    if (text.length < 2 || text.length > 30) return;
    
    // Fiyat parse et
    const parsed = this.parsePrice(text);
    if (!parsed || !parsed.price) return;
    
    // Fiyat range'i kontrolü
    if (parsed.price < 0.01 || parsed.price > 999999) return;
    
    // Element özellikleri
    const rect = element.getBoundingClientRect();
    const computed = window.getComputedStyle(element);
    const fontSize = parseFloat(computed.fontSize) || 12;
    const fontWeight = parseInt(computed.fontWeight) || 400;
    
    // Class ve ID kontrolü
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
  },
  
  // Fiyat adaylarını skorla ve sırala
  scorePriceCandidates(candidates) {
    candidates.forEach(c => {
      let score = 0;
      
      // Font boyutu (büyük fontlar önemli)
      score += Math.min((c.fontSize - 12) * 3, 30);
      
      // Font weight (bold önemli)
      if (c.fontWeight >= 600) score += 20;
      else if (c.fontWeight >= 500) score += 10;
      
      // Görünür alan (çok büyük değil, orta boy ideal)
      const idealArea = 10000; // 100x100 px
      const areaDiff = Math.abs(c.area - idealArea);
      score += Math.max(0, 20 - (areaDiff / 1000));
      
      // Para birimi sembolü varsa
      if (c.hasCurrencySymbol) score += 30;
      
      // Class/ID'de price keyword
      if (c.hasPriceKeyword) score += 25;
      
      // Ekranın üst kısmında (fold above)
      if (c.yPosition < 800) score += 15;
      else if (c.yPosition < 1200) score += 5;
      
      // X konumu (genelde sol veya ortada)
      const xPos = c.element.getBoundingClientRect().left;
      if (xPos > 50 && xPos < window.innerWidth - 200) score += 10;
      
      c.score = score;
    });
    
    // Sırala (yüksek skor önce)
    return candidates.sort((a, b) => b.score - a.score);
  },
  
  // Metinden fiyat parse et (gelişmiş regex) - DÜZELTİLMİŞ VERSİYON
  parsePrice(text) {
    if (!text) return null;
    
    text = text.trim().replace(/\s+/g, ' '); // Normalize whitespace
    
    // Pattern'ler - öncelik sırasına göre (DAHA KAPSAMLI)
    const patterns = [
      // TL patterns - Türk formatı
      { regex: /(\d{1,3}(?:\.\d{3})+,\d{1,2})\s*(?:TL|₺|tl|TRY)/i, type: 'tr', currency: 'TL', hasCurrency: true },
      { regex: /(\d+,\d{1,2})\s*(?:TL|₺|tl|TRY)/i, type: 'tr', currency: 'TL', hasCurrency: true },
      { regex: /(?:TL|₺|tl|TRY)\s*(\d{1,3}(?:\.\d{3})+,\d{1,2})/i, type: 'tr', currency: 'TL', hasCurrency: true },
      { regex: /(?:TL|₺|tl|TRY)\s*(\d+,\d{1,2})/i, type: 'tr', currency: 'TL', hasCurrency: true },
      
      // USD patterns
      { regex: /\$\s*(\d{1,3}(?:,\d{3})*(?:\.\d{1,2})?)/i, type: 'us', currency: '$', hasCurrency: true },
      { regex: /(\d{1,3}(?:,\d{3})*\.\d{1,2})\s*(?:USD|\$)/i, type: 'us', currency: '$', hasCurrency: true },
      { regex: /(\d+\.\d{1,2})\s*(?:USD|\$)/i, type: 'us', currency: '$', hasCurrency: true },
      
      // EUR patterns
      { regex: /€\s*(\d{1,3}(?:[,\.]\d{3})*[,\.]\d{1,2})/i, type: 'eu', currency: '€', hasCurrency: true },
      { regex: /(\d{1,3}(?:[,\.]\d{3})*[,\.]\d{1,2})\s*(?:EUR|€)/i, type: 'eu', currency: '€', hasCurrency: true },
      
      // GBP patterns
      { regex: /£\s*(\d{1,3}(?:,\d{3})*\.\d{1,2})/i, type: 'gb', currency: '£', hasCurrency: true },
      { regex: /(\d{1,3}(?:,\d{3})*\.\d{1,2})\s*(?:GBP|£)/i, type: 'gb', currency: '£', hasCurrency: true },
      
      // Generic patterns (para birimi yok) - DİKKAT: Bu pattern'ler son şans
      { regex: /(\d{1,3}(?:\.\d{3})+,\d{1,2})(?!\d)/i, type: 'tr', currency: null, hasCurrency: false },
      { regex: /(\d{1,3}(?:,\d{3})+\.\d{1,2})(?!\d)/i, type: 'us', currency: null, hasCurrency: false },
      { regex: /(\d+,\d{1,2})(?!\d)/i, type: 'tr', currency: null, hasCurrency: false },
      { regex: /(\d+\.\d{1,2})(?!\d)/i, type: 'us', currency: null, hasCurrency: false }
    ];
    
    for (const pattern of patterns) {
      const match = text.match(pattern.regex);
      if (match) {
        let priceStr = match[1];
        let currency = pattern.currency;
        
        // Type'a göre parse
        if (pattern.type === 'tr') {
          // Türk formatı: 1.234,56
          priceStr = priceStr.replace(/\./g, '').replace(',', '.');
        } else if (pattern.type === 'us' || pattern.type === 'gb') {
          // US/GB formatı: 1,234.56
          priceStr = priceStr.replace(/,/g, '');
        } else if (pattern.type === 'eu') {
          // EU formatı: 1.234,56 veya 1,234.56
          if (priceStr.includes(',') && priceStr.includes('.')) {
            // Hangisi son? Son olan decimal separator
            const lastComma = priceStr.lastIndexOf(',');
            const lastDot = priceStr.lastIndexOf('.');
            if (lastComma > lastDot) {
              // 1.234,56 formatı
              priceStr = priceStr.replace(/\./g, '').replace(',', '.');
            } else {
              // 1,234.56 formatı
              priceStr = priceStr.replace(/,/g, '');
            }
          } else if (priceStr.includes(',')) {
            priceStr = priceStr.replace(',', '.');
          }
        } else if (pattern.type === 'generic') {
          // Generic: virgül veya nokta olabilir
          if (priceStr.includes(',')) {
            priceStr = priceStr.replace(',', '.');
          }
        }
        
        const price = parseFloat(priceStr);
        
        if (!isNaN(price) && price > 0) {
          return {
            price: price,
            currency: currency,
            hasCurrency: pattern.hasCurrency,
            originalText: text
          };
        }
      }
    }
    
    return null;
  }
};

// Global olarak erişilebilir yap
if (typeof window !== 'undefined') {
  window.PriceParser = PriceParser;
}