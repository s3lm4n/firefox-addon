// Popup Script v2.1 - Enhanced Version
(function() {
  'use strict';
  
  const logger = PriceTrackerHelpers.createLogger('Popup');
  
  let currentProduct = null;
  let products = [];
  let settings = null;
  let debugLogs = [];
  let searchTimeout = null;
  
  // DOM Elements
  const els = {
    tabs: document.querySelectorAll('.tab'),
    tabContents: document.querySelectorAll('.tab-content'),
    homeLoading: document.getElementById('homeLoading'),
    currentPageSection: document.getElementById('currentPageSection'),
    currentProductName: document.getElementById('currentProductName'),
    currentProductPrice: document.getElementById('currentProductPrice'),
    confidenceBadge: document.getElementById('confidenceBadge'),
    addButton: document.getElementById('addButton'),
    refreshAllBtn: document.getElementById('refreshAllBtn'),
    productList: document.getElementById('productList'),
    totalProducts: document.getElementById('totalProducts'),
    lastCheck: document.getElementById('lastCheck'),
    settingsBtn: document.getElementById('settingsBtn'),
    priceSearchInput: document.getElementById('priceSearchInput'),
    listSearchInput: document.getElementById('listSearchInput'),
    clearListSearch: document.getElementById('clearListSearch'),
    searchSuggestion: document.getElementById('searchSuggestion'),
    debugConsole: document.getElementById('debugConsole'),
    clearDebug: document.getElementById('clearDebug'),
    exportDebug: document.getElementById('exportDebug'),
    contentArea: document.getElementById('contentArea')
  };
  
  // Debug logging
  function addDebugLog(message, type = 'info') {
    const timestamp = new Date().toLocaleTimeString('tr-TR');
    const log = { message, type, timestamp };
    debugLogs.push(log);
    
    if (debugLogs.length > 100) debugLogs.shift();
    
    const debugLine = document.createElement('div');
    debugLine.className = `debug-line ${type}`;
    debugLine.textContent = `[${timestamp}] ${message}`;
    els.debugConsole.appendChild(debugLine);
    els.debugConsole.scrollTop = els.debugConsole.scrollHeight;
  }
  
  // Initialize
  async function init() {
    addDebugLog('Popup başlatılıyor...', 'info');
    
    const darkMode = await PriceTrackerHelpers.getStorage('darkMode', false);
    if (darkMode) document.body.classList.add('dark-mode');
    
    settings = await browser.runtime.sendMessage({ action: 'getSettings' });
    if (!settings) {
      settings = {
        checkInterval: 30,
        notifications: true,
        notifyOnPriceDown: true,
        notifyOnPriceUp: false,
        autoCheck: true
      };
    }
    
    setupEventListeners();
    await loadProducts();
    await checkCurrentPage();
    updateStats();
    
    addDebugLog('Popup hazır', 'success');
  }
  
  // Event listeners
  function setupEventListeners() {
    els.tabs.forEach(tab => {
      tab.addEventListener('click', () => switchTab(tab.dataset.tab));
    });
    
    els.settingsBtn.addEventListener('click', () => {
      browser.runtime.openOptionsPage();
      addDebugLog('Ayarlar sayfası açılıyor', 'info');
    });
    
    els.addButton.addEventListener('click', addToTracking);
    els.refreshAllBtn.addEventListener('click', refreshAllProducts);
    
    els.priceSearchInput.addEventListener('input', handlePriceSearch);
    els.listSearchInput.addEventListener('input', handleListSearch);
    els.clearListSearch.addEventListener('click', clearListSearch);
    
    els.clearDebug.addEventListener('click', () => {
      debugLogs = [];
      els.debugConsole.innerHTML = '<div class="debug-line success">[INFO] Konsol temizlendi</div>';
    });
    
    els.exportDebug.addEventListener('click', exportDebugLogs);
  }
  
  // Tab switching
  function switchTab(tabName) {
    els.tabs.forEach(tab => {
      tab.classList.toggle('active', tab.dataset.tab === tabName);
    });
    
    els.tabContents.forEach(content => {
      const isActive = content.id === tabName + 'Tab';
      content.classList.toggle('active', isActive);
    });
    
    addDebugLog(`Tab: ${tabName}`, 'info');
  }
  
  // Check current page
  async function checkCurrentPage() {
    try {
      els.homeLoading.style.display = 'flex';
      els.currentPageSection.style.display = 'none';
      
      const tabs = await browser.tabs.query({ active: true, currentWindow: true });
      if (!tabs[0]) {
        els.homeLoading.innerHTML = '<div class="empty-state"><div class="empty-icon">❌</div><div>Aktif sekme bulunamadı</div></div>';
        return;
      }
      
      addDebugLog(`Taranıyor: ${tabs[0].url}`, 'info');
      
      const response = await browser.tabs.sendMessage(tabs[0].id, {
        action: 'getProductInfo'
      });
      
      if (response && response.price) {
        currentProduct = response;
        
        els.currentProductName.textContent = response.name;
        els.currentProductPrice.textContent = PriceTrackerHelpers.formatPrice(response.price, response.currency);
        
        const confidence = Math.round(response.confidence * 100);
        els.confidenceBadge.textContent = `${confidence}% güvenilir`;
        
        if (confidence >= 85) {
          els.confidenceBadge.style.background = 'rgba(16, 185, 129, 0.3)';
        } else if (confidence >= 70) {
          els.confidenceBadge.style.background = 'rgba(245, 158, 11, 0.3)';
        } else {
          els.confidenceBadge.style.background = 'rgba(239, 68, 68, 0.3)';
        }
        
        const exists = products.find(p => p.url === response.url);
        if (exists) {
          els.addButton.innerHTML = '<span>✅</span><span>Zaten Takipte</span>';
          els.addButton.style.background = '#10b981';
          els.addButton.style.color = 'white';
        } else {
          els.addButton.innerHTML = '<span>➕</span><span>Takibe Al</span>';
          els.addButton.style.background = 'white';
          els.addButton.style.color = 'var(--primary)';
        }
        
        els.homeLoading.style.display = 'none';
        els.currentPageSection.style.display = 'block';
        
        addDebugLog(`Ürün: ${response.name.substring(0, 40)}...`, 'success');
        
      } else {
        els.homeLoading.innerHTML = `
          <div class="empty-state">
            <div class="empty-icon">🔍</div>
            <div class="empty-title">Ürün Bulunamadı</div>
            <div class="empty-text">Bu sayfa bir ürün sayfası değil</div>
          </div>
        `;
        addDebugLog('Ürün algılanamadı', 'warn');
      }
      
    } catch (error) {
      addDebugLog(`Hata: ${error.message}`, 'error');
      els.homeLoading.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">⚠️</div>
          <div class="empty-title">Hata</div>
          <div class="empty-text">Sayfa bilgisi alınamadı</div>
        </div>
      `;
    }
  }
  
  // Load products
  async function loadProducts() {
    products = await PriceTrackerHelpers.getStorage('trackedProducts', []);
    addDebugLog(`${products.length} ürün yüklendi`, 'info');
    renderProductList();
  }
  
  // Render product list
  function renderProductList(filterText = '') {
    if (products.length === 0) {
      els.productList.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">📦</div>
          <div class="empty-title">Henüz Ürün Yok</div>
          <div class="empty-text">Bir ürün sayfasına gidip takibe alın</div>
        </div>
      `;
      return;
    }
    
    let filteredProducts = products;
    let highlightIndex = -1;
    
    if (filterText) {
      const searchLower = filterText.toLowerCase();
      filteredProducts = products.filter(p => 
        p.name.toLowerCase().includes(searchLower) ||
        p.site.toLowerCase().includes(searchLower)
      );
      
      if (filteredProducts.length === 0) {
        // Find closest match
        const closest = findClosestMatch(filterText, products);
        if (closest) {
          els.searchSuggestion.innerHTML = `Bunu mu kastettiniz? "<strong>${PriceTrackerHelpers.escapeHtml(closest.name.substring(0, 40))}</strong>..."`;
          els.searchSuggestion.style.display = 'block';
          els.searchSuggestion.onclick = () => {
            els.listSearchInput.value = closest.name.substring(0, 20);
            handleListSearch({ target: els.listSearchInput });
          };
        }
      } else {
        els.searchSuggestion.style.display = 'none';
        highlightIndex = products.indexOf(filteredProducts[0]);
      }
    } else {
      els.searchSuggestion.style.display = 'none';
    }
    
    els.productList.innerHTML = filteredProducts.map((product, idx) => {
      const originalIndex = products.indexOf(product);
      const currentPrice = product.price;
      const oldPrice = product.previousPrice || product.initialPrice;
      
      let change = null;
      if (oldPrice && Math.abs(currentPrice - oldPrice) > 0.01) {
        change = PriceTrackerHelpers.calculateChange(oldPrice, currentPrice);
      }
      
      const isHighlight = originalIndex === highlightIndex;
      
      return `
        <div class="product-card ${isHighlight ? 'highlight' : ''}" data-index="${originalIndex}">
          <div class="card-header">
            <div class="card-name" title="${PriceTrackerHelpers.escapeHtml(product.name)}">
              ${PriceTrackerHelpers.escapeHtml(PriceTrackerHelpers.truncate(product.name, 60))}
            </div>
            <span class="site-badge">${PriceTrackerHelpers.escapeHtml(product.site)}</span>
          </div>
          
          <div class="card-price">
            <span class="current-price">${PriceTrackerHelpers.formatPrice(currentPrice, product.currency)}</span>
            ${oldPrice && Math.abs(currentPrice - oldPrice) > 0.01 ? `
              <div class="old-price-badge">
                <span>Eski:</span>
                <span class="old-price-value">${PriceTrackerHelpers.formatPrice(oldPrice, product.currency)}</span>
              </div>
            ` : ''}
          </div>
          
          ${change ? `
            <div class="price-change ${change.isDecrease ? 'down' : 'up'}">
              <span>${change.isDecrease ? '🔻' : '🔺'}</span>
              <span>${change.formatted} ${product.currency} (${change.percentFormatted})</span>
            </div>
          ` : ''}
          
          <div class="card-meta">
            ${product.lastCheck ? `Son: ${PriceTrackerHelpers.formatDate(product.lastCheck)}` : 'Kontrol edilmedi'}
          </div>
          
          <div class="card-actions">
            <button class="btn-action btn-visit" data-url="${PriceTrackerHelpers.escapeHtml(product.url)}">
              <span>🔗</span>
              <span>Aç</span>
            </button>
            <button class="btn-action btn-check" data-index="${originalIndex}">
              <span>🔄</span>
              <span>Kontrol</span>
            </button>
            <button class="btn-action btn-remove" data-index="${originalIndex}">
              <span>🗑️</span>
              <span>Sil</span>
            </button>
          </div>
        </div>
      `;
    }).join('');
    
    // Event listeners
    els.productList.querySelectorAll('.btn-visit').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        browser.tabs.create({ url: btn.dataset.url });
        addDebugLog('Ürün açıldı', 'info');
      });
    });
    
    els.productList.querySelectorAll('.btn-check').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        checkSingleProduct(parseInt(btn.dataset.index));
      });
    });
    
    els.productList.querySelectorAll('.btn-remove').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        removeProduct(parseInt(btn.dataset.index));
      });
    });
  }
  
  // Find closest match using Levenshtein distance
  function findClosestMatch(query, products) {
    const levenshtein = (a, b) => {
      const matrix = [];
      for (let i = 0; i <= b.length; i++) {
        matrix[i] = [i];
      }
      for (let j = 0; j <= a.length; j++) {
        matrix[0][j] = j;
      }
      for (let i = 1; i <= b.length; i++) {
        for (let j = 1; j <= a.length; j++) {
          if (b.charAt(i - 1) === a.charAt(j - 1)) {
            matrix[i][j] = matrix[i - 1][j - 1];
          } else {
            matrix[i][j] = Math.min(
              matrix[i - 1][j - 1] + 1,
              matrix[i][j - 1] + 1,
              matrix[i - 1][j] + 1
            );
          }
        }
      }
      return matrix[b.length][a.length];
    };
    
    let closest = null;
    let minDistance = Infinity;
    
    products.forEach(p => {
      const distance = levenshtein(query.toLowerCase(), p.name.toLowerCase().substring(0, query.length + 5));
      if (distance < minDistance && distance < query.length / 2) {
        minDistance = distance;
        closest = p;
      }
    });
    
    return closest;
  }
  
  // Handle price search
  function handlePriceSearch(e) {
    clearTimeout(searchTimeout);
    const url = e.target.value.trim();
    
    if (!url) return;
    
    searchTimeout = setTimeout(async () => {
      addDebugLog(`Fiyat sorgulanıyor: ${url}`, 'info');
      
      try {
        const response = await fetch(url);
        const html = await response.text();
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');
        
        const info = await PriceParser.extractProductInfo(doc, url);
        
        if (info && info.price) {
          addDebugLog(`Fiyat bulundu: ${info.price} ${info.currency}`, 'success');
          alert(`${info.name}\n\nFiyat: ${info.price} ${info.currency}`);
        } else {
          addDebugLog('Fiyat bulunamadı', 'warn');
          alert('Bu URL\'de fiyat bulunamadı');
        }
      } catch (error) {
        addDebugLog(`Hata: ${error.message}`, 'error');
        alert('Fiyat sorgulanamadı');
      }
    }, 1000);
  }
  
  // Handle list search
  function handleListSearch(e) {
    const filterText = e.target.value.trim();
    renderProductList(filterText);
  }
  
  // Clear list search
  function clearListSearch() {
    els.listSearchInput.value = '';
    els.searchSuggestion.style.display = 'none';
    renderProductList();
  }
  
  // Check single product
  async function checkSingleProduct(index) {
    const product = products[index];
    if (!product) return;
    
    const btn = document.querySelector(`.btn-check[data-index="${index}"]`);
    if (btn) {
      btn.disabled = true;
      btn.innerHTML = '<span>⏳</span><span>Kontrol...</span>';
    }
    
    try {
      const result = await browser.runtime.sendMessage({
        action: 'checkSingleProduct',
        product: product
      });
      
      if (result && result.product) {
        products[index] = result.product;
        await PriceTrackerHelpers.setStorage('trackedProducts', products);
        
        renderProductList();
        updateStats();
        
        addDebugLog(result.updated ? 'Fiyat güncellendi' : 'Değişiklik yok', result.updated ? 'success' : 'info');
      }
    } catch (error) {
      addDebugLog(`Hata: ${error.message}`, 'error');
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = '<span>🔄</span><span>Kontrol</span>';
      }
    }
  }
  
  // Add to tracking
  async function addToTracking() {
    if (!currentProduct) return;
    
    const existing = products.findIndex(p => p.url === currentProduct.url);
    
    if (existing >= 0) {
      products[existing] = {
        ...currentProduct,
        initialPrice: products[existing].initialPrice || currentProduct.price,
        previousPrice: products[existing].price,
        addedDate: products[existing].addedDate || Date.now()
      };
    } else {
      products.push({
        ...currentProduct,
        initialPrice: currentProduct.price,
        previousPrice: null,
        addedDate: Date.now()
      });
    }
    
    await PriceTrackerHelpers.setStorage('trackedProducts', products);
    
    browser.notifications.create({
      type: 'basic',
      iconUrl: browser.runtime.getURL('icons/icon48.png'),
      title: '✅ Takibe Alındı',
      message: `${currentProduct.name.substring(0, 50)}...`
    });
    
    els.addButton.innerHTML = '<span>✅</span><span>Eklendi!</span>';
    els.addButton.style.background = '#10b981';
    
    setTimeout(() => {
      els.addButton.innerHTML = '<span>✅</span><span>Zaten Takipte</span>';
    }, 2000);
    
    await loadProducts();
    updateStats();
    addDebugLog('Ürün takibe alındı', 'success');
  }
  
  // Remove product
  async function removeProduct(index) {
    const card = els.productList.querySelector(`[data-index="${index}"]`);
    
    if (card) {
      card.classList.add('removing');
      await PriceTrackerHelpers.wait(400);
      
      products.splice(index, 1);
      await PriceTrackerHelpers.setStorage('trackedProducts', products);
      
      await loadProducts();
      updateStats();
      addDebugLog('Ürün silindi', 'info');
    }
  }
  
  // Refresh all products
  async function refreshAllProducts() {
    els.refreshAllBtn.disabled = true;
    els.refreshAllBtn.innerHTML = '<span>⏳</span><span>Kontrol...</span>';
    
    addDebugLog('Tüm ürünler kontrol ediliyor', 'info');
    
    try {
      const result = await browser.runtime.sendMessage({ action: 'checkAllPrices' });
      
      els.refreshAllBtn.innerHTML = '<span>✅</span><span>Tamam!</span>';
      
      setTimeout(() => {
        els.refreshAllBtn.innerHTML = '<span>🔄</span><span>Hepsini Kontrol</span>';
        els.refreshAllBtn.disabled = false;
      }, 2000);
      
      await loadProducts();
      updateStats();
      
      addDebugLog(`${result.checked} kontrol, ${result.updated} güncelleme`, 'success');
    } catch (error) {
      addDebugLog(`Hata: ${error.message}`, 'error');
      els.refreshAllBtn.innerHTML = '<span>❌</span><span>Hata</span>';
      
      setTimeout(() => {
        els.refreshAllBtn.innerHTML = '<span>🔄</span><span>Hepsini Kontrol</span>';
        els.refreshAllBtn.disabled = false;
      }, 2000);
    }
  }
  
  // Export debug logs
  function exportDebugLogs() {
    const blob = new Blob([JSON.stringify(debugLogs, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `debug-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    addDebugLog('Loglar kaydedildi', 'success');
  }
  
  // Update stats
  function updateStats() {
    els.totalProducts.textContent = products.length;
    
    const lastChecks = products
      .filter(p => p.lastCheck)
      .map(p => p.lastCheck)
      .sort((a, b) => b - a);
    
    if (lastChecks.length > 0) {
      els.lastCheck.textContent = PriceTrackerHelpers.getRelativeTime(lastChecks[0]);
    } else {
      els.lastCheck.textContent = '-';
    }
  }
  
  document.addEventListener('DOMContentLoaded', init);
  
})();