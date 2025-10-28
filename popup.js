// Popup Script v2.0
// UI mantığı ve kullanıcı etkileşimleri

(function() {
  'use strict';
  
  const logger = PriceTrackerHelpers.createLogger('Popup');
  
  let currentProduct = null;
  let products = [];
  let settings = null;
  
  // DOM Elements
  const els = {
    // Tabs
    tabs: document.querySelectorAll('.tab'),
    tabContents: document.querySelectorAll('.tab-content'),
    
    // Home
    homeLoading: document.getElementById('homeLoading'),
    currentPageSection: document.getElementById('currentPageSection'),
    currentProductName: document.getElementById('currentProductName'),
    currentProductPrice: document.getElementById('currentProductPrice'),
    confidenceBadge: document.getElementById('confidenceBadge'),
    addButton: document.getElementById('addButton'),
    
    // List
    productList: document.getElementById('productList'),
    listCount: document.getElementById('listCount'),
    refreshAll: document.getElementById('refreshAll'),
    exportData: document.getElementById('exportData'),
    
    // Stats
    totalProducts: document.getElementById('totalProducts'),
    totalSavings: document.getElementById('totalSavings'),
    lastCheck: document.getElementById('lastCheck'),
    
    // Settings
    darkModeToggle: document.getElementById('darkModeToggle'),
    settingsBtn: document.getElementById('settingsBtn'),
    autoCheckToggle: document.getElementById('autoCheckToggle'),
    checkInterval: document.getElementById('checkInterval'),
    notificationsToggle: document.getElementById('notificationsToggle'),
    notifyDownToggle: document.getElementById('notifyDownToggle'),
    notifyUpToggle: document.getElementById('notifyUpToggle')
  };
  
  // Initialize
  async function init() {
    logger.info('Initializing popup...');
    
    // Dark mode'u yükle
    const darkMode = await PriceTrackerHelpers.getStorage('darkMode', false);
    if (darkMode) {
      document.body.classList.add('dark-mode');
      els.darkModeToggle.textContent = '☀️';
    }
    
    // Ayarları yükle
    settings = await browser.runtime.sendMessage({ action: 'getSettings' });
    loadSettings();
    
    // Event listeners
    setupEventListeners();
    
    // Ürünleri yükle
    await loadProducts();
    
    // Aktif sekmedeki ürünü kontrol et
    await checkCurrentPage();
    
    // Stats'ı güncelle
    updateStats();
    
    logger.success('Popup initialized');
  }
  
  // Event listeners
  function setupEventListeners() {
    // Tab navigation
    els.tabs.forEach(tab => {
      tab.addEventListener('click', () => switchTab(tab.dataset.tab));
    });
    
    // Dark mode toggle
    els.darkModeToggle.addEventListener('click', toggleDarkMode);
    
    // Settings button
    els.settingsBtn.addEventListener('click', () => switchTab('settings'));
    
    // Add button
    els.addButton.addEventListener('click', addToTracking);
    
    // Refresh all
    els.refreshAll.addEventListener('click', refreshAllProducts);
    
    // Export
    els.exportData.addEventListener('click', exportProducts);
    
    // Settings toggles
    els.autoCheckToggle.addEventListener('click', () => toggleSetting('autoCheck'));
    els.notificationsToggle.addEventListener('click', () => toggleSetting('notifications'));
    els.notifyDownToggle.addEventListener('click', () => toggleSetting('notifyOnPriceDown'));
    els.notifyUpToggle.addEventListener('click', () => toggleSetting('notifyOnPriceUp'));
    
    // Check interval
    els.checkInterval.addEventListener('change', updateCheckInterval);
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
  }
  
  // Dark mode
  async function toggleDarkMode() {
    const isDark = document.body.classList.toggle('dark-mode');
    els.darkModeToggle.textContent = isDark ? '☀️' : '🌙';
    await PriceTrackerHelpers.setStorage('darkMode', isDark);
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
      
      const response = await browser.tabs.sendMessage(tabs[0].id, {
        action: 'getProductInfo'
      });
      
      if (response && response.price) {
        currentProduct = response;
        
        // UI'ı güncelle
        els.currentProductName.textContent = response.name;
        els.currentProductPrice.textContent = PriceTrackerHelpers.formatPrice(response.price, response.currency);
        
        // Confidence badge
        const confidence = Math.round(response.confidence * 100);
        els.confidenceBadge.textContent = `${confidence}% güvenilir`;
        
        if (confidence >= 85) {
          els.confidenceBadge.style.background = 'rgba(16, 185, 129, 0.3)';
        } else if (confidence >= 70) {
          els.confidenceBadge.style.background = 'rgba(245, 158, 11, 0.3)';
        } else {
          els.confidenceBadge.style.background = 'rgba(239, 68, 68, 0.3)';
        }
        
        // Buton metnini güncelle
        const exists = products.find(p => p.url === response.url);
        if (exists) {
          els.addButton.innerHTML = '<span>✅</span><span>Zaten Takipte</span>';
          els.addButton.style.background = '#10b981';
          els.addButton.style.color = 'white';
        }
        
        els.homeLoading.style.display = 'none';
        els.currentPageSection.style.display = 'block';
        
      } else {
        els.homeLoading.innerHTML = `
          <div class="empty-state">
            <div class="empty-icon">🔍</div>
            <div class="empty-title">Ürün Bulunamadı</div>
            <div class="empty-text">Bu sayfa bir ürün sayfası değil veya fiyat algılanamadı</div>
          </div>
        `;
      }
      
    } catch (error) {
      logger.error('Error checking current page:', error);
      els.homeLoading.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">⚠️</div>
          <div class="empty-title">Hata</div>
          <div class="empty-text">Sayfa bilgisi alınamadı. Sayfayı yenileyin.</div>
        </div>
      `;
    }
  }
  
  // Load products
  async function loadProducts() {
    products = await PriceTrackerHelpers.getStorage('trackedProducts', []);
    renderProductList();
  }
  
  // Render product list
  function renderProductList() {
    els.listCount.textContent = products.length;
    
    if (products.length === 0) {
      els.productList.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">📦</div>
          <div class="empty-title">Henüz Ürün Yok</div>
          <div class="empty-text">Bir ürün sayfasına gidip "Takibe Al" butonuna tıklayın</div>
        </div>
      `;
      return;
    }
    
    els.productList.innerHTML = products.map((product, index) => {
      const change = product.previousPrice ? 
        PriceTrackerHelpers.calculateChange(product.previousPrice, product.price) : null;
      
      const initialChange = product.initialPrice ?
        PriceTrackerHelpers.calculateChange(product.initialPrice, product.price) : null;
      
      return `
        <div class="product-card" data-index="${index}">
          <div class="card-header">
            <div class="card-name" title="${PriceTrackerHelpers.escapeHtml(product.name)}">
              ${PriceTrackerHelpers.escapeHtml(PriceTrackerHelpers.truncate(product.name, 60))}
            </div>
            <span class="site-badge">${PriceTrackerHelpers.escapeHtml(product.site)}</span>
          </div>
          
          <div class="card-price">
            <span class="current-price">${PriceTrackerHelpers.formatPrice(product.price, product.currency)}</span>
            ${product.previousPrice ? `<span class="old-price">${PriceTrackerHelpers.formatPrice(product.previousPrice, product.currency)}</span>` : ''}
          </div>
          
          ${change ? `
            <div class="price-change ${change.isDecrease ? 'down' : 'up'}">
              <span>${change.isDecrease ? '🔻' : '🔺'}</span>
              <span>${change.formatted} ${product.currency} (${change.percentFormatted})</span>
            </div>
          ` : ''}
          
          ${initialChange && Math.abs(initialChange.absolute) > 0.01 ? `
            <div class="price-change ${initialChange.isDecrease ? 'down' : 'up'}">
              <span>İlk fiyattan:</span>
              <span>${initialChange.percentFormatted}</span>
              ${initialChange.isDecrease ? `<span>• Tasarruf: ${Math.abs(initialChange.absolute).toFixed(2)} ${product.currency}</span>` : ''}
            </div>
          ` : ''}
          
          <div class="card-meta">
            ${product.lastCheck ? `Son kontrol: ${PriceTrackerHelpers.formatDate(product.lastCheck)}` : 'Henüz kontrol edilmedi'}
          </div>
          
          <div class="card-actions">
            <button class="btn-action btn-visit" data-url="${PriceTrackerHelpers.escapeHtml(product.url)}">
              <span>🔗</span>
              <span>Aç</span>
            </button>
            <button class="btn-action btn-remove" data-index="${index}">
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
      });
    });
    
    els.productList.querySelectorAll('.btn-remove').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        removeProduct(parseInt(btn.dataset.index));
      });
    });
    
    // Card click - open URL
    els.productList.querySelectorAll('.product-card').forEach(card => {
      card.addEventListener('click', () => {
        const btn = card.querySelector('.btn-visit');
        if (btn) {
          browser.tabs.create({ url: btn.dataset.url });
        }
      });
    });
  }
  
  // Add to tracking
  async function addToTracking() {
    if (!currentProduct) return;
    
    logger.info('Adding product to tracking...');
    
    const existing = products.findIndex(p => p.url === currentProduct.url);
    
    if (existing >= 0) {
      // Güncelle
      products[existing] = {
        ...currentProduct,
        initialPrice: products[existing].initialPrice || currentProduct.price,
        addedDate: products[existing].addedDate || Date.now()
      };
      logger.info('Product updated');
    } else {
      // Ekle
      products.push({
        ...currentProduct,
        initialPrice: currentProduct.price,
        addedDate: Date.now()
      });
      logger.success('Product added');
    }
    
    await PriceTrackerHelpers.setStorage('trackedProducts', products);
    
    // Notification
    browser.notifications.create({
      type: 'basic',
      iconUrl: browser.runtime.getURL('icons/icon48.png'),
      title: '✅ Takibe Alındı',
      message: `${currentProduct.name.substring(0, 50)}...\n${PriceTrackerHelpers.formatPrice(currentProduct.price, currentProduct.currency)}`
    });
    
    // UI güncelle
    els.addButton.innerHTML = '<span>✅</span><span>Eklendi!</span>';
    els.addButton.style.background = '#10b981';
    els.addButton.style.color = 'white';
    
    setTimeout(() => {
      els.addButton.innerHTML = '<span>✅</span><span>Zaten Takipte</span>';
    }, 2000);
    
    await loadProducts();
    updateStats();
  }
  
  // Remove product
  async function removeProduct(index) {
    const card = els.productList.querySelector(`[data-index="${index}"]`);
    
    if (card) {
      card.classList.add('removing');
      
      await PriceTrackerHelpers.wait(400);
      
      products.splice(index, 1);
      await PriceTrackerHelpers.setStorage('trackedProducts', products);
      
      logger.info('Product removed');
      
      await loadProducts();
      updateStats();
    }
  }
  
  // Refresh all products
  async function refreshAllProducts() {
    logger.info('Refreshing all products...');
    
    els.refreshAll.disabled = true;
    els.refreshAll.innerHTML = '⏳ Kontrol ediliyor...';
    
    try {
      const result = await browser.runtime.sendMessage({ action: 'checkAllPrices' });
      
      logger.success(`Refresh complete:`, result);
      
      els.refreshAll.innerHTML = `✅ Tamamlandı!`;
      
      setTimeout(() => {
        els.refreshAll.innerHTML = '🔄 Tümünü Kontrol';
        els.refreshAll.disabled = false;
      }, 2000);
      
      await loadProducts();
      updateStats();
      
    } catch (error) {
      logger.error('Refresh error:', error);
      els.refreshAll.innerHTML = '❌ Hata';
      
      setTimeout(() => {
        els.refreshAll.innerHTML = '🔄 Tümünü Kontrol';
        els.refreshAll.disabled = false;
      }, 2000);
    }
  }
  
  // Export products
  function exportProducts() {
    logger.info('Exporting products...');
    
    const data = {
      exportDate: new Date().toISOString(),
      version: '2.0.0',
      products: products
    };
    
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `fiyat-takipci-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    
    logger.success('Export complete');
  }
  
  // Update stats
  function updateStats() {
    els.totalProducts.textContent = products.length;
    
    // Calculate total savings
    let totalSavings = 0;
    products.forEach(product => {
      if (product.initialPrice && product.price < product.initialPrice) {
        totalSavings += (product.initialPrice - product.price);
      }
    });
    
    els.totalSavings.textContent = totalSavings > 0 ? 
      `${totalSavings.toFixed(2)}₺` : '0₺';
    
    // Last check
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
  
  // Load settings
  function loadSettings() {
    if (!settings) return;
    
    els.autoCheckToggle.classList.toggle('active', settings.autoCheck);
    els.notificationsToggle.classList.toggle('active', settings.notifications);
    els.notifyDownToggle.classList.toggle('active', settings.notifyOnPriceDown);
    els.notifyUpToggle.classList.toggle('active', settings.notifyOnPriceUp);
    els.checkInterval.value = settings.checkInterval;
  }
  
  // Toggle setting
  async function toggleSetting(key) {
    const toggle = {
      autoCheck: els.autoCheckToggle,
      notifications: els.notificationsToggle,
      notifyOnPriceDown: els.notifyDownToggle,
      notifyOnPriceUp: els.notifyUpToggle
    }[key];
    
    const newValue = !settings[key];
    settings[key] = newValue;
    toggle.classList.toggle('active', newValue);
    
    await browser.runtime.sendMessage({
      action: 'updateSettings',
      settings: { [key]: newValue }
    });
    
    logger.info(`Setting ${key} updated to ${newValue}`);
  }
  
  // Update check interval
  async function updateCheckInterval() {
    const value = parseInt(els.checkInterval.value);
    
    if (value < 5 || value > 1440) {
      els.checkInterval.value = settings.checkInterval;
      return;
    }
    
    settings.checkInterval = value;
    
    await browser.runtime.sendMessage({
      action: 'updateSettings',
      settings: { checkInterval: value }
    });
    
    logger.info(`Check interval updated to ${value} minutes`);
  }
  
  // Initialize on load
  document.addEventListener('DOMContentLoaded', init);
  
})();