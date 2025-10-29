// Popup Script v2.0 - FIXED VERSION
// UI mantığı ve kullanıcı etkileşimleri

(function() {
  'use strict';
  
  const logger = PriceTrackerHelpers.createLogger('Popup');
  
  let currentProduct = null;
  let products = [];
  let settings = null;
  let debugLogs = [];
  
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
    debugBtn: document.getElementById('debugBtn'),
    autoCheckToggle: document.getElementById('autoCheckToggle'),
    checkInterval: document.getElementById('checkInterval'),
    notificationsToggle: document.getElementById('notificationsToggle'),
    notifyDownToggle: document.getElementById('notifyDownToggle'),
    notifyUpToggle: document.getElementById('notifyUpToggle'),
    saveSettingsBtn: document.getElementById('saveSettingsBtn'),
    
    // Debug
    debugConsole: document.getElementById('debugConsole'),
    clearDebug: document.getElementById('clearDebug'),
    exportDebug: document.getElementById('exportDebug'),
    
    // Scroll
    contentArea: document.getElementById('contentArea'),
    scrollBtn: document.getElementById('scrollBtn')
  };
  
  // Debug logging function
  function addDebugLog(message, type = 'info') {
    const timestamp = new Date().toLocaleTimeString('tr-TR');
    const log = { message, type, timestamp };
    debugLogs.push(log);
    
    // Keep last 100 logs
    if (debugLogs.length > 100) {
      debugLogs.shift();
    }
    
    // Update console if visible
    const debugLine = document.createElement('div');
    debugLine.className = `debug-line ${type}`;
    debugLine.textContent = `[${timestamp}] ${message}`;
    els.debugConsole.appendChild(debugLine);
    els.debugConsole.scrollTop = els.debugConsole.scrollHeight;
  }
  
  // Initialize
  async function init() {
    addDebugLog('Popup başlatılıyor...', 'info');
    
    // Dark mode'u yükle
    const darkMode = await PriceTrackerHelpers.getStorage('darkMode', false);
    if (darkMode) {
      document.body.classList.add('dark-mode');
      els.darkModeToggle.textContent = '☀️';
    }
    
    // Ayarları yükle
    settings = await browser.runtime.sendMessage({ action: 'getSettings' });
    if (!settings) {
      settings = {
        checkInterval: 30,
        notifications: true,
        notifyOnPriceDown: true,
        notifyOnPriceUp: false,
        autoCheck: true
      };
      addDebugLog('Varsayılan ayarlar yüklendi', 'warn');
    } else {
      addDebugLog('Ayarlar yüklendi', 'success');
    }
    
    loadSettings();
    
    // Event listeners
    setupEventListeners();
    
    // Ürünleri yükle
    await loadProducts();
    
    // Aktif sekmedeki ürünü kontrol et
    await checkCurrentPage();
    
    // Stats'ı güncelle
    updateStats();
    
    addDebugLog('Popup hazır', 'success');
  }
  
  // Event listeners
  function setupEventListeners() {
    // Tab navigation
    els.tabs.forEach(tab => {
      tab.addEventListener('click', () => switchTab(tab.dataset.tab));
    });
    
    // Dark mode toggle
    els.darkModeToggle.addEventListener('click', toggleDarkMode);
    
    // Debug button
    els.debugBtn.addEventListener('click', () => switchTab('debug'));
    
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
    els.checkInterval.addEventListener('change', () => {
      addDebugLog(`Kontrol aralığı değiştirildi: ${els.checkInterval.value} dakika`, 'info');
    });
    
    // Save settings button
    els.saveSettingsBtn.addEventListener('click', saveSettings);
    
    // Debug actions
    els.clearDebug.addEventListener('click', () => {
      debugLogs = [];
      els.debugConsole.innerHTML = '<div class="debug-line success">[DEBUG] Konsol temizlendi</div>';
      addDebugLog('Konsol temizlendi', 'success');
    });
    
    els.exportDebug.addEventListener('click', exportDebugLogs);
    
    // Scroll button
    els.scrollBtn.addEventListener('click', () => {
      els.contentArea.scrollTo({
        top: els.contentArea.scrollHeight,
        behavior: 'smooth'
      });
    });
    
    // Scroll visibility
    els.contentArea.addEventListener('scroll', () => {
      const scrollTop = els.contentArea.scrollTop;
      const scrollHeight = els.contentArea.scrollHeight;
      const clientHeight = els.contentArea.clientHeight;
      
      // Show button if not at bottom and content is scrollable
      if (scrollHeight > clientHeight && scrollTop < scrollHeight - clientHeight - 50) {
        els.scrollBtn.classList.add('visible');
      } else {
        els.scrollBtn.classList.remove('visible');
      }
    });
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
    
    addDebugLog(`Tab değiştirildi: ${tabName}`, 'info');
  }
  
  // Dark mode
  async function toggleDarkMode() {
    const isDark = document.body.classList.toggle('dark-mode');
    els.darkModeToggle.textContent = isDark ? '☀️' : '🌙';
    await PriceTrackerHelpers.setStorage('darkMode', isDark);
    addDebugLog(`Dark mode: ${isDark ? 'Açık' : 'Kapalı'}`, 'info');
  }
  
  // Check current page
  async function checkCurrentPage() {
    try {
      els.homeLoading.style.display = 'flex';
      els.currentPageSection.style.display = 'none';
      
      addDebugLog('Aktif sayfa kontrol ediliyor...', 'info');
      
      const tabs = await browser.tabs.query({ active: true, currentWindow: true });
      if (!tabs[0]) {
        els.homeLoading.innerHTML = '<div class="empty-state"><div class="empty-icon">❌</div><div>Aktif sekme bulunamadı</div></div>';
        addDebugLog('Aktif sekme bulunamadı', 'error');
        return;
      }
      
      addDebugLog(`Sayfa taranıyor: ${tabs[0].url}`, 'info');
      
      const response = await browser.tabs.sendMessage(tabs[0].id, {
        action: 'getProductInfo'
      });
      
      if (response && response.price) {
        currentProduct = response;
        
        addDebugLog(`Ürün bulundu: ${response.name} - ${response.price} ${response.currency}`, 'success');
        
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
        } else {
          els.addButton.innerHTML = '<span>➕</span><span>Takibe Al</span>';
          els.addButton.style.background = 'white';
          els.addButton.style.color = 'var(--primary)';
        }
        
        els.homeLoading.style.display = 'none';
        els.currentPageSection.style.display = 'block';
        
      } else {
        addDebugLog('Bu sayfada ürün bulunamadı', 'warn');
        els.homeLoading.innerHTML = `
          <div class="empty-state">
            <div class="empty-icon">🔍</div>
            <div class="empty-title">Ürün Bulunamadı</div>
            <div class="empty-text">Bu sayfa bir ürün sayfası değil veya fiyat algılanamadı</div>
          </div>
        `;
      }
      
    } catch (error) {
      addDebugLog(`Hata: ${error.message}`, 'error');
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
    addDebugLog(`${products.length} ürün yüklendi`, 'info');
    renderProductList();
  }
  
  // Render product list - FİYAT GÖSTERMEDE DÜZELTİLDİ
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
      // Güncel fiyat ve eski fiyat
      const currentPrice = product.price; // Güncel fiyat
      const oldPrice = product.previousPrice || product.initialPrice; // Eski fiyat (previousPrice veya initialPrice)
      
      // Fiyat değişimi hesapla
      let change = null;
      if (oldPrice && Math.abs(currentPrice - oldPrice) > 0.01) {
        change = PriceTrackerHelpers.calculateChange(oldPrice, currentPrice);
      }
      
      return `
        <div class="product-card" data-index="${index}">
          <div class="card-header">
            <div class="card-name" title="${PriceTrackerHelpers.escapeHtml(product.name)}">
              ${PriceTrackerHelpers.escapeHtml(PriceTrackerHelpers.truncate(product.name, 60))}
            </div>
            <span class="site-badge">${PriceTrackerHelpers.escapeHtml(product.site)}</span>
          </div>
          
          <div class="card-price-section">
            <div class="card-price">
              <span class="current-price">${PriceTrackerHelpers.formatPrice(currentPrice, product.currency)}</span>
              ${oldPrice && Math.abs(currentPrice - oldPrice) > 0.01 ? `
                <div class="old-price-badge">
                  <span class="old-price-label">Eski:</span>
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
          </div>
          
          <div class="card-meta">
            ${product.lastCheck ? `Son kontrol: ${PriceTrackerHelpers.formatDate(product.lastCheck)}` : 'Henüz kontrol edilmedi'}
          </div>
          
          <div class="card-actions">
            <button class="btn-action btn-visit" data-url="${PriceTrackerHelpers.escapeHtml(product.url)}">
              <span>🔗</span>
              <span>Aç</span>
            </button>
            <button class="btn-action btn-check" data-index="${index}">
              <span>🔄</span>
              <span>Kontrol</span>
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
        addDebugLog(`Ürün sayfası açıldı: ${btn.dataset.url}`, 'info');
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
  
  // Check single product
  async function checkSingleProduct(index) {
    const product = products[index];
    if (!product) return;
    
    addDebugLog(`Ürün kontrol ediliyor: ${product.name}`, 'info');
    
    // Button'u disable et
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
        
        if (result.updated) {
          addDebugLog(`Fiyat güncellendi: ${result.product.name} - ${result.product.price} ${result.product.currency}`, 'success');
        } else {
          addDebugLog(`Fiyat değişmedi: ${result.product.name}`, 'info');
        }
        
        renderProductList();
        updateStats();
      } else {
        addDebugLog(`Ürün kontrol edilemedi: ${product.name}`, 'error');
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
    
    addDebugLog('Ürün takibe alınıyor...', 'info');
    
    const existing = products.findIndex(p => p.url === currentProduct.url);
    
    if (existing >= 0) {
      // Güncelle
      products[existing] = {
        ...currentProduct,
        initialPrice: products[existing].initialPrice || currentProduct.price,
        previousPrice: products[existing].price, // Mevcut fiyatı previousPrice olarak sakla
        addedDate: products[existing].addedDate || Date.now()
      };
      addDebugLog('Ürün güncellendi', 'info');
    } else {
      // Ekle
      products.push({
        ...currentProduct,
        initialPrice: currentProduct.price,
        previousPrice: null, // İlk ekleme, eski fiyat yok
        addedDate: Date.now()
      });
      addDebugLog('Ürün eklendi', 'success');
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
      
      const productName = products[index].name;
      products.splice(index, 1);
      await PriceTrackerHelpers.setStorage('trackedProducts', products);
      
      addDebugLog(`Ürün silindi: ${productName}`, 'info');
      
      await loadProducts();
      updateStats();
    }
  }
  
  // Refresh all products - DÜZELTİLDİ
  async function refreshAllProducts() {
    addDebugLog('Tüm ürünler kontrol ediliyor...', 'info');
    
    els.refreshAll.disabled = true;
    els.refreshAll.innerHTML = '⏳ Kontrol...';
    
    try {
      const result = await browser.runtime.sendMessage({ action: 'checkAllPrices' });
      
      addDebugLog(`Kontrol tamamlandı: ${result.checked} kontrol, ${result.updated} güncelleme, ${result.errors} hata`, 'success');
      
      els.refreshAll.innerHTML = `✅ Tamamlandı!`;
      
      setTimeout(() => {
        els.refreshAll.innerHTML = '🔄 Kontrol Et';
        els.refreshAll.disabled = false;
      }, 2000);
      
      await loadProducts();
      updateStats();
      
    } catch (error) {
      addDebugLog(`Hata: ${error.message}`, 'error');
      els.refreshAll.innerHTML = '❌ Hata';
      
      setTimeout(() => {
        els.refreshAll.innerHTML = '🔄 Kontrol Et';
        els.refreshAll.disabled = false;
      }, 2000);
    }
  }
  
  // Export products
  function exportProducts() {
    addDebugLog('Veriler dışa aktarılıyor...', 'info');
    
    const data = {
      exportDate: new Date().toISOString(),
      version: '2.0.0',
      products: products,
      settings: settings
    };
    
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `fiyat-takipci-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    
    addDebugLog('Dışa aktarma tamamlandı', 'success');
  }
  
  // Export debug logs
  function exportDebugLogs() {
    const blob = new Blob([JSON.stringify(debugLogs, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `debug-logs-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    
    addDebugLog('Debug logları kaydedildi', 'success');
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
    els.checkInterval.value = settings.checkInterval || 30;
  }
  
  // Toggle setting
  function toggleSetting(key) {
    const toggle = {
      autoCheck: els.autoCheckToggle,
      notifications: els.notificationsToggle,
      notifyOnPriceDown: els.notifyDownToggle,
      notifyOnPriceUp: els.notifyUpToggle
    }[key];
    
    const newValue = !settings[key];
    settings[key] = newValue;
    toggle.classList.toggle('active', newValue);
    
    addDebugLog(`Ayar değiştirildi: ${key} = ${newValue}`, 'info');
  }
  
  // Save settings - KAYIT SİSTEMİ EKLENDİ
  async function saveSettings() {
    addDebugLog('Ayarlar kaydediliyor...', 'info');
    
    // Değerleri topla
    settings.autoCheck = els.autoCheckToggle.classList.contains('active');
    settings.notifications = els.notificationsToggle.classList.contains('active');
    settings.notifyOnPriceDown = els.notifyDownToggle.classList.contains('active');
    settings.notifyOnPriceUp = els.notifyUpToggle.classList.contains('active');
    settings.checkInterval = parseInt(els.checkInterval.value) || 30;
    
    // Background'a gönder
    await browser.runtime.sendMessage({
      action: 'updateSettings',
      settings: settings
    });
    
    // Button feedback
    els.saveSettingsBtn.innerHTML = '<span>✅</span><span>Kaydedildi!</span>';
    els.saveSettingsBtn.style.background = '#10b981';
    
    addDebugLog('Ayarlar kaydedildi', 'success');
    
    setTimeout(() => {
      els.saveSettingsBtn.innerHTML = '<span>💾</span><span>Ayarları Kaydet</span>';
      els.saveSettingsBtn.style.background = '';
    }, 2000);
  }
  
  // Initialize on load
  document.addEventListener('DOMContentLoaded', init);
  
})();