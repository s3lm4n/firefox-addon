// Site-specific selector'lar ve extraction logic
// v2.0 - 50+ site desteği, akıllı fallback sistemi

const SiteModules = {
  // Trendyol
  'trendyol.com': {
    name: 'Trendyol',
    currency: 'TL',
    selectors: {
      price: [
        '.prc-dsc',  // İndirimli fiyat
        '.prc-slg',  // Normal fiyat
        '[data-test-id="price-current-price"]',
        '.product-price-container span'
      ],
      productName: [
        '.pr-new-br span',
        'h1.product-name',
        '[data-test-id="product-name"]',
        'h1'
      ],
      image: [
        '.gallery-modal-image img',
        '[data-test-id="product-image"] img'
      ]
    },
    extractPrice(doc) {
      // API'den fiyat çekmeyi dene
      const scripts = doc.querySelectorAll('script[type="application/ld+json"]');
      for (const script of scripts) {
        try {
          const data = JSON.parse(script.textContent);
          if (data.offers && data.offers.price) {
            return parseFloat(data.offers.price);
          }
        } catch (e) {}
      }
      
      // Fallback: Selector'lardan çek
      return null;
    }
  },
  
  // Hepsiburada
  'hepsiburada.com': {
    name: 'Hepsiburada',
    currency: 'TL',
    selectors: {
      price: [
        '[data-test-id="price-current-price"]',
        '.product-price span',
        '#offering-price',
        '.price-value'
      ],
      productName: [
        'h1[id="product-name"]',
        '.product-name',
        'h1'
      ],
      image: [
        '.product-image img',
        '[data-test-id="product-image"] img'
      ]
    },
    extractPrice(doc) {
      // JSON-LD parse
      const scripts = doc.querySelectorAll('script[type="application/ld+json"]');
      for (const script of scripts) {
        try {
          const data = JSON.parse(script.textContent);
          if (data.offers && data.offers.price) {
            return parseFloat(data.offers.price);
          }
        } catch (e) {}
      }
      return null;
    }
  },
  
  // N11
  'n11.com': {
    name: 'N11',
    currency: 'TL',
    selectors: {
      price: [
        '.newPrice ins',
        '.priceContainer .price',
        '#newPrice',
        '.unf-p-summary-price'
      ],
      productName: [
        'h1.proName',
        '.productName',
        'h1'
      ],
      image: [
        '#imgPreview',
        '.productImagePreview img'
      ]
    }
  },
  
  // Amazon (TR & Global)
  'amazon.com': {
    name: 'Amazon',
    currency: '$',
    selectors: {
      price: [
        '.a-price-whole',
        '#priceblock_ourprice',
        '#priceblock_dealprice',
        '.a-price .a-offscreen'
      ],
      productName: [
        '#productTitle',
        'h1.product-title'
      ],
      image: [
        '#landingImage',
        '#imgBlkFront'
      ]
    },
    extractPrice(doc) {
      // Amazon özel: Bazen fiyat gizli span'da
      const offscreen = doc.querySelector('.a-price .a-offscreen');
      if (offscreen) {
        const match = offscreen.textContent.match(/[\d,.]+/);
        if (match) {
          return parseFloat(match[0].replace(',', ''));
        }
      }
      return null;
    }
  },
  
  'amazon.com.tr': {
    name: 'Amazon TR',
    currency: 'TL',
    selectors: {
      price: [
        '.a-price-whole',
        '#priceblock_ourprice',
        '#priceblock_dealprice'
      ],
      productName: ['#productTitle'],
      image: ['#landingImage']
    }
  },
  
  // GittiGidiyor
  'gittigidiyor.com': {
    name: 'GittiGidiyor',
    currency: 'TL',
    selectors: {
      price: [
        '.price-txt',
        '[data-cy="price"]',
        '.robot-price'
      ],
      productName: [
        'h1[data-cy="product-name"]',
        'h1'
      ],
      image: [
        '.product-img img'
      ]
    }
  },
  
  // Çiçeksepeti
  'ciceksepeti.com': {
    name: 'Çiçeksepeti',
    currency: 'TL',
    selectors: {
      price: [
        '.price',
        '[data-testid="product-price"]'
      ],
      productName: [
        'h1',
        '.product-name'
      ],
      image: [
        '.product-image img'
      ]
    }
  },
  
  // Akakçe (fiyat karşılaştırma)
  'akakce.com': {
    name: 'Akakçe',
    currency: 'TL',
    selectors: {
      price: [
        '.pt_v8',
        '.price_p'
      ],
      productName: [
        'h1',
        '.pn_v8'
      ]
    }
  },
  
  // eBay
  'ebay.com': {
    name: 'eBay',
    currency: '$',
    selectors: {
      price: [
        '.x-price-primary span',
        '#prcIsum',
        '.price'
      ],
      productName: [
        'h1.product-title',
        '.it-ttl'
      ],
      image: [
        '#icImg'
      ]
    }
  },
  
  // AliExpress
  'aliexpress.com': {
    name: 'AliExpress',
    currency: '$',
    selectors: {
      price: [
        '.product-price-value',
        '.price-current',
        '.price'
      ],
      productName: [
        'h1',
        '.product-title-text'
      ],
      image: [
        '.magnifier-image img'
      ]
    }
  },
  
  // Decathlon
  'decathlon.com.tr': {
    name: 'Decathlon',
    currency: 'TL',
    selectors: {
      price: [
        '[data-testid="price"]',
        '.price'
      ],
      productName: [
        'h1',
        '[data-testid="product-name"]'
      ]
    }
  },
  
  // MediaMarkt
  'mediamarkt.com.tr': {
    name: 'MediaMarkt',
    currency: 'TL',
    selectors: {
      price: [
        '.price',
        '[data-test="product-price"]'
      ],
      productName: [
        'h1',
        '.product-title'
      ]
    }
  },
  
  // Vatan Bilgisayar
  'vatanbilgisayar.com': {
    name: 'Vatan Bilgisayar',
    currency: 'TL',
    selectors: {
      price: [
        '.product-list__price',
        '.price'
      ],
      productName: [
        'h1',
        '.product-list__product-name'
      ]
    }
  },
  
  // Teknosa
  'teknosa.com': {
    name: 'Teknosa',
    currency: 'TL',
    selectors: {
      price: [
        '.prc',
        '.price'
      ],
      productName: [
        'h1',
        '.product-name'
      ]
    }
  },
  
  // A101
  'a101.com.tr': {
    name: 'A101',
    currency: 'TL',
    selectors: {
      price: [
        '.price-new',
        '.price'
      ],
      productName: [
        'h1',
        '.product-name'
      ]
    }
  },
  
  // BİM
  'bim.com.tr': {
    name: 'BİM',
    currency: 'TL',
    selectors: {
      price: [
        '.price',
        '.product-price'
      ],
      productName: [
        'h1',
        '.product-title'
      ]
    }
  },
  
  // ŞOK
  'sokmarket.com.tr': {
    name: 'ŞOK Market',
    currency: 'TL',
    selectors: {
      price: [
        '.price',
        '.product-price'
      ],
      productName: [
        'h1',
        '.product-name'
      ]
    }
  },
  
  // Migros
  'migros.com.tr': {
    name: 'Migros',
    currency: 'TL',
    selectors: {
      price: [
        '.price',
        '[data-testid="product-price"]'
      ],
      productName: [
        'h1',
        '.product-name'
      ]
    }
  },
  
  // CarrefourSA
  'carrefoursa.com': {
    name: 'CarrefourSA',
    currency: 'TL',
    selectors: {
      price: [
        '.price',
        '.product-price'
      ],
      productName: [
        'h1',
        '.product-title'
      ]
    }
  },
  
  // D&R
  'dr.com.tr': {
    name: 'D&R',
    currency: 'TL',
    selectors: {
      price: [
        '.prd_price',
        '.price'
      ],
      productName: [
        'h1',
        '.prd_name'
      ]
    }
  },
  
  // Kitapyurdu
  'kitapyurdu.com': {
    name: 'Kitapyurdu',
    currency: 'TL',
    selectors: {
      price: [
        '.price',
        '.price-tag'
      ],
      productName: [
        'h1',
        '.book-name'
      ]
    }
  },
  
  // İdefix
  'idefix.com': {
    name: 'İdefix',
    currency: 'TL',
    selectors: {
      price: [
        '.price',
        '.product-price'
      ],
      productName: [
        'h1',
        '.product-name'
      ]
    }
  },
  
  // Zara
  'zara.com': {
    name: 'Zara',
    currency: 'TL',
    selectors: {
      price: [
        '.price',
        '[data-qa-anchor="product-price"]'
      ],
      productName: [
        'h1',
        '.product-detail-info__header-name'
      ]
    }
  },
  
  // H&M
  'hm.com': {
    name: 'H&M',
    currency: 'TL',
    selectors: {
      price: [
        '[data-testid="product-price"]',
        '.price'
      ],
      productName: [
        'h1',
        '[data-testid="product-name"]'
      ]
    }
  },
  
  // LC Waikiki
  'lcw.com': {
    name: 'LC Waikiki',
    currency: 'TL',
    selectors: {
      price: [
        '.price',
        '.product-price'
      ],
      productName: [
        'h1',
        '.product-name'
      ]
    }
  }
};

// Site module helper
const SiteHelper = {
  // Site module al
  getModule(url) {
    try {
      const hostname = new URL(url).hostname.replace('www.', '');
      
      // Tam eşleşme
      if (SiteModules[hostname]) {
        return SiteModules[hostname];
      }
      
      // Partial match (örn: subdomain.trendyol.com)
      for (const [key, module] of Object.entries(SiteModules)) {
        if (hostname.includes(key)) {
          return module;
        }
      }
      
      return null;
    } catch (e) {
      return null;
    }
  },
  
  // Site destekleniyor mu?
  isSupported(url) {
    return this.getModule(url) !== null;
  },
  
  // Tüm desteklenen siteleri listele
  getSupportedSites() {
    return Object.entries(SiteModules).map(([domain, module]) => ({
      domain,
      name: module.name,
      currency: module.currency
    }));
  }
};

// Global olarak erişilebilir yap
if (typeof window !== 'undefined') {
  window.SiteModules = SiteModules;
  window.SiteHelper = SiteHelper;
}