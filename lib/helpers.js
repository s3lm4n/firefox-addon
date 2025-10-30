// Yardımcı fonksiyonlar ve utilities
// v2.0 - Güvenlik, performans ve code quality odaklı

const PriceTrackerHelpers = {
  // Güvenli HTML encode
  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  },
  
  // URL validasyonu
  isValidUrl(url) {
    try {
      const parsed = new URL(url);
      return ['http:', 'https:'].includes(parsed.protocol);
    } catch {
      return false;
    }
  },
  
  // Site hostname çıkar
  getHostname(url) {
    try {
      return new URL(url).hostname.replace('www.', '');
    } catch {
      return '';
    }
  },
  
  // Fiyat formatlama
  formatPrice(price, currency = 'TL') {
    if (!price || isNaN(price)) return '---';
    return `${price.toFixed(2)} ${currency}`;
  },
  
  // Tarih formatlama
  formatDate(timestamp, format = 'short') {
    if (!timestamp) return '---';
    const date = new Date(timestamp);
    
    if (format === 'short') {
      return date.toLocaleString('tr-TR', {
        day: '2-digit',
        month: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
      });
    } else if (format === 'long') {
      return date.toLocaleString('tr-TR', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    }
    
    return date.toISOString();
  },
  
  // Relatif zaman (5 dakika önce)
  getRelativeTime(timestamp) {
    const now = Date.now();
    const diff = now - timestamp;
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    
    if (seconds < 60) return 'Az önce';
    if (minutes < 60) return `${minutes} dakika önce`;
    if (hours < 24) return `${hours} saat önce`;
    if (days < 7) return `${days} gün önce`;
    
    return this.formatDate(timestamp, 'short');
  },
  
  // Yüzde değişim hesapla
  calculateChange(oldPrice, newPrice) {
    if (!oldPrice || !newPrice) return null;
    const diff = newPrice - oldPrice;
    const percent = (diff / oldPrice) * 100;
    
    return {
      absolute: diff,
      percent: percent,
      formatted: `${diff > 0 ? '+' : ''}${diff.toFixed(2)}`,
      percentFormatted: `${diff > 0 ? '+' : ''}${percent.toFixed(1)}%`,
      isIncrease: diff > 0,
      isDecrease: diff < 0
    };
  },
  
  // Debounce fonksiyonu
  debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout);
        func(...args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  },
  
  // Throttle fonksiyonu
  throttle(func, limit) {
    let inThrottle;
    return function(...args) {
      if (!inThrottle) {
        func.apply(this, args);
        inThrottle = true;
        setTimeout(() => inThrottle = false, limit);
      }
    };
  },
  
  // Retry mekanizması
  async retry(fn, options = {}) {
    const {
      maxAttempts = 3,
      delay = 1000,
      backoff = 2,
      onRetry = null
    } = options;
    
    let lastError;
    
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error;
        
        if (attempt < maxAttempts) {
          const waitTime = delay * Math.pow(backoff, attempt - 1);
          
          if (onRetry) {
            onRetry(attempt, maxAttempts, waitTime, error);
          }
          
          await new Promise(resolve => setTimeout(resolve, waitTime));
        }
      }
    }
    
    throw lastError;
  },
  
  // Storage helper
  async getStorage(key, defaultValue = null) {
    try {
      const result = await browser.storage.local.get(key);
      return result[key] !== undefined ? result[key] : defaultValue;
    } catch (error) {
      console.error('Storage get error:', error);
      return defaultValue;
    }
  },
  
  async setStorage(key, value) {
    try {
      await browser.storage.local.set({ [key]: value });
      return true;
    } catch (error) {
      console.error('Storage set error:', error);
      return false;
    }
  },
  
  // Rate limiter
  createRateLimiter(maxRequests, windowMs) {
    const requests = [];
    
    return {
      async checkLimit() {
        const now = Date.now();
        // Eski istekleri temizle
        while (requests.length > 0 && requests[0] < now - windowMs) {
          requests.shift();
        }
        
        if (requests.length >= maxRequests) {
          const oldestRequest = requests[0];
          const waitTime = windowMs - (now - oldestRequest);
          throw new Error(`Rate limit exceeded. Retry after ${Math.ceil(waitTime / 1000)}s`);
        }
        
        requests.push(now);
      }
    };
  },
  
  // Element visible mı?
  isElementVisible(element) {
    if (!element) return false;
    
    const rect = element.getBoundingClientRect();
    const style = window.getComputedStyle(element);
    
    return (
      rect.width > 0 &&
      rect.height > 0 &&
      style.display !== 'none' &&
      style.visibility !== 'hidden' &&
      style.opacity !== '0'
    );
  },
  
  // Deep clone (optimized with structuredClone)
  deepClone(obj) {
    // Use structuredClone if available (much faster than JSON method)
    if (typeof structuredClone !== 'undefined') {
      return structuredClone(obj);
    }
    // Fallback to JSON method for older browsers
    return JSON.parse(JSON.stringify(obj));
  },
  
  // Unique ID
  generateId() {
    return `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  },
  
  // Hash string
  async hashString(str) {
    const encoder = new TextEncoder();
    const data = encoder.encode(str);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  },
  
  // Truncate text
  truncate(text, maxLength, suffix = '...') {
    if (!text || text.length <= maxLength) return text;
    return text.substring(0, maxLength - suffix.length) + suffix;
  },
  
  // Number to locale string
  formatNumber(num, locale = 'tr-TR') {
    if (!num || isNaN(num)) return '0';
    return num.toLocaleString(locale);
  },
  
  // Wait helper
  wait(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  },
  
  // Logger
  createLogger(prefix) {
    const colors = {
      info: '#3498db',
      success: '#2ecc71',
      warn: '#f39c12',
      error: '#e74c3c'
    };
    
    return {
      info: (...args) => console.log(`%c[${prefix}]`, `color: ${colors.info}`, ...args),
      success: (...args) => console.log(`%c[${prefix}]`, `color: ${colors.success}`, ...args),
      warn: (...args) => console.warn(`%c[${prefix}]`, `color: ${colors.warn}`, ...args),
      error: (...args) => console.error(`%c[${prefix}]`, `color: ${colors.error}`, ...args)
    };
  },
  
  // Performance monitor
  performanceMonitor: {
    marks: new Map(),
    
    start(label) {
      this.marks.set(label, performance.now());
    },
    
    end(label) {
      const startTime = this.marks.get(label);
      if (!startTime) {
        console.warn(`No start mark found for: ${label}`);
        return null;
      }
      
      const duration = performance.now() - startTime;
      this.marks.delete(label);
      
      return duration;
    },
    
    log(label) {
      const duration = this.end(label);
      if (duration !== null) {
        console.log(`⏱️ ${label}: ${duration.toFixed(2)}ms`);
      }
      return duration;
    }
  }
};

// Global olarak erişilebilir yap
if (typeof window !== 'undefined') {
  window.PriceTrackerHelpers = PriceTrackerHelpers;
}