// Options Page Script
// Ayarlar sayfası mantığı

(function() {
  'use strict';
  
  const logger = PriceTrackerHelpers.createLogger('Options');
  
  let settings = null;
  let products = [];
  
  // DOM Elements
  const els = {
    // Stats
    totalProducts: document.getElementById('totalProducts'),
    totalSavings: document.getElementById('totalSavings'),
    totalChecks: document.getElementById('totalChecks'),
    supportedSites: document.getElementById('supportedSites'),
    
    // Settings
    autoCheckToggle: document.getElementById('autoCheckToggle'),
    autoCheckWrapper: document.getElementById('autoCheckWrapper'),
    checkInterval: document.getElementById('checkInterval'),
    maxRetries: document.getElementById('maxRetries'),
    notificationsToggle: document.getElementById('notificationsToggle'),
    notificationsWrapper: document.getElementById('notificationsWrapper'),
    notifyDownToggle: document.getElementById('notifyDownToggle'),
    notifyDownWrapper: document.getElementById('notifyDownWrapper'),
    notifyUpToggle: document.getElementById('notifyUpToggle'),
    notifyUpWrapper: document.getElementById('notifyUpWrapper'),
    
    // Actions
    exportBtn: document.getElementById('exportBtn'),
    importBtn: document.getElementById('importBtn'),
    importFile: document.getElementById('importFile'),
    clearHistoryBtn: document.getElementById('clearHistoryBtn'),
    clearAllBtn: document.getElementById('clearAllBtn'),
    
    // Sites
    sitesList: document.getElementById('sitesList'),
    
    // Toast
    toast: document.getElementById('toast'),
    toastMessage: document.getElementById('toastMessage')
  };
  
  // Initialize
  async function init() {
    logger.info('Initializing options page...');
    
    // Load settings
    settings = await browser.runtime.sendMessage({ action: 'getSettings' });
    if (!settings) {
      settings = {
        checkInterval: 30,
        maxRetries: 3,
        notifications: true,
        notifyOnPriceDown: true,
        notifyOnPriceUp: false,
        autoCheck: true
      };
    }
    
    // Load products
    products = await PriceTrackerHelpers.getStorage('trackedProducts', []);
    
    // Setup UI
    loadSettings();
    updateStats();
    loadSupportedSites();
    setupEventListeners();
    
    logger.success('Options page initialized');
  }
  
  // Load settings to UI
  function loadSettings() {
    els.autoCheckToggle.classList.toggle('active', settings.autoCheck);
    els.notificationsToggle.classList.toggle('active', settings.notifications);
    els.notifyDownToggle.classList.toggle('active', settings.notifyOnPriceDown);
    els.notifyUpToggle.classList.toggle('active', settings.notifyOnPriceUp);
    
    els.checkInterval.value = settings.checkInterval || 30;
    els.maxRetries.value = settings.maxRetries || 3;
  }
  
  // Setup event listeners
  function setupEventListeners() {
    // Toggles
    els.autoCheckWrapper.addEventListener('click', () => toggleSetting('autoCheck', els.autoCheckToggle));
    els.notificationsWrapper.addEventListener('click', () => toggleSetting('notifications', els.notificationsToggle));
    els.notifyDownWrapper.addEventListener('click', () => toggleSetting('notifyOnPriceDown', els.notifyDownToggle));
    els.notifyUpWrapper.addEventListener('click', () => toggleSetting('notifyOnPriceUp', els.notifyUpToggle));
    
    // Inputs
    els.checkInterval.addEventListener('change', () => updateSetting('checkInterval', parseInt(els.checkInterval.value)));
    els.maxRetries.addEventListener('change', () => updateSetting('maxRetries', parseInt(els.maxRetries.value)));
    
    // Buttons
    els.exportBtn.addEventListener('click', exportData);
    els.importBtn.addEventListener('click', () => els.importFile.click());
    els.importFile.addEventListener('change', importData);
    els.clearHistoryBtn.addEventListener('click', clearHistory);
    els.clearAllBtn.addEventListener('click', clearAll);
  }
  
  // Toggle setting
  async function toggleSetting(key, toggleElement) {
    const newValue = !settings[key];
    settings[key] = newValue;
    toggleElement.classList.toggle('active', newValue);
    
    await browser.runtime.sendMessage({
      action: 'updateSettings',
      settings: { [key]: newValue }
    });
    
    showToast(`${key} ${newValue ? 'etkinleştirildi' : 'devre dışı bırakıldı'}`);
    logger.info(`Setting ${key} updated to ${newValue}`);
  }
  
  // Update setting
  async function updateSetting(key, value) {
    // Validation
    if (key === 'checkInterval' && (value < 5 || value > 1440)) {
      showToast('Kontrol aralığı 5-1440 dakika arasında olmalıdır', 'error');
      els.checkInterval.value = settings.checkInterval;
      return;
    }
    
    if (key === 'maxRetries' && (value < 1 || value > 10)) {
      showToast('Yeniden deneme sayısı 1-10 arasında olmalıdır', 'error');
      els.maxRetries.value = settings.maxRetries;
      return;
    }
    
    settings[key] = value;
    
    await browser.runtime.sendMessage({
      action: 'updateSettings',
      settings: { [key]: value }
    });
    
    showToast('Ayarlar kaydedildi');
    logger.info(`Setting ${key} updated to ${value}`);
  }
  
  // Update stats
  function updateStats() {
    els.totalProducts.textContent = products.length;
    
    // Calculate savings
    let totalSavings = 0;
    products.forEach(product => {
      if (product.initialPrice && product.price < product.initialPrice) {
        totalSavings += (product.initialPrice - product.price);
      }
    });
    
    els.totalSavings.textContent = totalSavings > 0 ? 
      `${totalSavings.toFixed(2)}₺` : '0₺';
    
    // Count total checks
    let totalChecks = 0;
    products.forEach(product => {
      if (product.priceHistory) {
        totalChecks += product.priceHistory.length;
      }
    });
    
    els.totalChecks.textContent = totalChecks;
    
    // Supported sites
    const sites = SiteHelper.getSupportedSites();
    els.supportedSites.textContent = `${sites.length}`;
  }
  
  // Load supported sites
  function loadSupportedSites() {
    const sites = SiteHelper.getSupportedSites();
    
    els.sitesList.innerHTML = sites
      .sort((a, b) => a.name.localeCompare(b.name, 'tr'))
      .map(site => `
        <div class="site-badge" title="${site.domain}">
          ${site.name}
        </div>
      `)
      .join('');
  }
  
  // Export data
  function exportData() {
    const data = {
      version: '2.0.0',
      exportDate: new Date().toISOString(),
      products: products,
      settings: settings
    };
    
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `fiyat-takipci-backup-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    
    showToast('Veriler dışa aktarıldı');
    logger.success('Data exported');
  }
  
  // Import data
  async function importData(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      
      // Validate
      if (!data.products || !Array.isArray(data.products)) {
        throw new Error('Invalid data format');
      }
      
      // Confirm
      const confirmed = confirm(
        `${data.products.length} ürün içe aktarılacak.\n` +
        `Mevcut ${products.length} ürünle birleştirilecek.\n\n` +
        `Devam edilsin mi?`
      );
      
      if (!confirmed) return;
      
      // Merge products (avoid duplicates by URL)
      const existingUrls = new Set(products.map(p => p.url));
      let addedCount = 0;
      
      data.products.forEach(product => {
        if (!existingUrls.has(product.url)) {
          products.push(product);
          addedCount++;
        }
      });
      
      await PriceTrackerHelpers.setStorage('trackedProducts', products);
      
      // Import settings if available
      if (data.settings) {
        settings = { ...settings, ...data.settings };
        await browser.runtime.sendMessage({
          action: 'updateSettings',
          settings: settings
        });
        loadSettings();
      }
      
      updateStats();
      showToast(`${addedCount} yeni ürün içe aktarıldı`);
      logger.success(`Imported ${addedCount} products`);
      
    } catch (error) {
      showToast('İçe aktarma başarısız: ' + error.message, 'error');
      logger.error('Import error:', error);
    }
    
    // Reset file input
    event.target.value = '';
  }
  
  // Clear history
  async function clearHistory() {
    const confirmed = confirm(
      'Tüm ürünlerin fiyat geçmişi silinecek.\n' +
      'Ürünler silinmeyecek, sadece geçmiş fiyat bilgileri temizlenecek.\n\n' +
      'Devam edilsin mi?'
    );
    
    if (!confirmed) return;
    
    products.forEach(product => {
      product.priceHistory = [];
      product.previousPrice = null;
    });
    
    await PriceTrackerHelpers.setStorage('trackedProducts', products);
    updateStats();
    showToast('Fiyat geçmişi temizlendi');
    logger.info('Price history cleared');
  }
  
  // Clear all data
  async function clearAll() {
    const confirmed = confirm(
      '⚠️ DİKKAT ⚠️\n\n' +
      'TÜM VERİLER SİLİNECEK!\n' +
      '- Tüm takip edilen ürünler\n' +
      '- Fiyat geçmişi\n' +
      '- Ayarlar\n\n' +
      'Bu işlem geri alınamaz!\n\n' +
      'Devam etmek istediğinize emin misiniz?'
    );
    
    if (!confirmed) return;
    
    // Double confirm
    const doubleConfirmed = confirm(
      'Son onay:\n\n' +
      'Tüm verileriniz silinecek ve bu işlem geri alınamayacak.\n' +
      'Gerçekten devam etmek istiyor musunuz?'
    );
    
    if (!doubleConfirmed) return;
    
    // Clear storage
    await browser.storage.local.clear();
    
    // Reset variables
    products = [];
    settings = {
      checkInterval: 30,
      maxRetries: 3,
      notifications: true,
      notifyOnPriceDown: true,
      notifyOnPriceUp: false,
      autoCheck: true
    };
    
    // Update background
    await browser.runtime.sendMessage({
      action: 'updateSettings',
      settings: settings
    });
    
    // Update UI
    loadSettings();
    updateStats();
    
    showToast('Tüm veriler silindi');
    logger.warn('All data cleared');
  }
  
  // Show toast notification
  function showToast(message, type = 'success') {
    els.toastMessage.textContent = message;
    
    const icon = type === 'success' ? '✅' : '❌';
    els.toast.querySelector('.toast-icon').textContent = icon;
    
    els.toast.classList.add('show');
    
    setTimeout(() => {
      els.toast.classList.remove('show');
    }, 3000);
  }
  
  // Initialize on load
  document.addEventListener('DOMContentLoaded', init);
  
})();