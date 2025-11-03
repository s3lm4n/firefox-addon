// Options Page Script v3.0 - Fully Modernized
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
    
    // Tabs
    navTabs: document.querySelectorAll('.nav-tab'),
    tabContents: document.querySelectorAll('.tab-content'),
    
    // Settings - Auto Check
    autoCheckToggle: document.getElementById('autoCheckToggle'),
    autoCheckWrapper: document.getElementById('autoCheckWrapper'),
    checkInterval: document.getElementById('checkInterval'),
    maxRetries: document.getElementById('maxRetries'),
    
    // Settings - Notifications
    notificationsToggle: document.getElementById('notificationsToggle'),
    notificationsWrapper: document.getElementById('notificationsWrapper'),
    notifyDownToggle: document.getElementById('notifyDownToggle'),
    notifyDownWrapper: document.getElementById('notifyDownWrapper'),
    notifyUpToggle: document.getElementById('notifyUpToggle'),
    notifyUpWrapper: document.getElementById('notifyUpWrapper'),
    
    // Theme
    themeOptions: document.querySelectorAll('.theme-option'),
    
    // Actions
    exportBtn: document.getElementById('exportBtn'),
    importBtn: document.getElementById('importBtn'),
    importFile: document.getElementById('importFile'),
    clearHistoryBtn: document.getElementById('clearHistoryBtn'),
    clearAllBtn: document.getElementById('clearAllBtn'),
    
    // Toast
    toast: document.getElementById('toast'),
    toastIcon: document.getElementById('toastIcon'),
    toastMessage: document.getElementById('toastMessage')
  };
  
  // Initialize
  async function init() {
    logger.info('Initializing options page...');
    
    // Load dark mode
    const darkMode = await PriceTrackerHelpers.getStorage('darkMode', false);
    if (darkMode) {
      document.body.classList.add('dark-mode');
      updateThemeOptions('dark');
    }
    
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
    setupEventListeners();
    setupKeyboardNavigation();
    
    // Initialize Lucide icons
    if (typeof lucide !== 'undefined') {
      lucide.createIcons();
    }
    
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
    // Tab navigation
    els.navTabs.forEach(tab => {
      tab.addEventListener('click', () => switchTab(tab.dataset.tab));
    });
    
    // Toggles
    els.autoCheckWrapper.addEventListener('click', () => toggleSetting('autoCheck', els.autoCheckToggle));
    els.notificationsWrapper.addEventListener('click', () => toggleSetting('notifications', els.notificationsToggle));
    els.notifyDownWrapper.addEventListener('click', () => toggleSetting('notifyOnPriceDown', els.notifyDownToggle));
    els.notifyUpWrapper.addEventListener('click', () => toggleSetting('notifyOnPriceUp', els.notifyUpToggle));
    
    // Inputs
    els.checkInterval.addEventListener('change', () => updateSetting('checkInterval', parseInt(els.checkInterval.value)));
    els.maxRetries.addEventListener('change', () => updateSetting('maxRetries', parseInt(els.maxRetries.value)));
    
    // Theme options
    els.themeOptions.forEach(option => {
      option.addEventListener('click', () => switchTheme(option.dataset.theme));
    });
    
    // Buttons
    els.exportBtn.addEventListener('click', exportData);
    els.importBtn.addEventListener('click', () => els.importFile.click());
    els.importFile.addEventListener('change', importData);
    els.clearHistoryBtn.addEventListener('click', clearHistory);
    els.clearAllBtn.addEventListener('click', clearAll);
  }
  
  // Keyboard navigation
  function setupKeyboardNavigation() {
    const tabs = Array.from(els.navTabs);
    
    tabs.forEach((tab, index) => {
      tab.addEventListener('keydown', (e) => {
        let newIndex = index;
        
        if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
          e.preventDefault();
          newIndex = (index + 1) % tabs.length;
        } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
          e.preventDefault();
          newIndex = (index - 1 + tabs.length) % tabs.length;
        } else if (e.key === 'Home') {
          e.preventDefault();
          newIndex = 0;
        } else if (e.key === 'End') {
          e.preventDefault();
          newIndex = tabs.length - 1;
        }
        
        if (newIndex !== index) {
          switchTab(tabs[newIndex].dataset.tab);
          tabs[newIndex].focus();
        }
      });
    });
  }
  
  // Switch tab
  function switchTab(tabName) {
    els.navTabs.forEach(tab => {
      const isActive = tab.dataset.tab === tabName;
      tab.classList.toggle('active', isActive);
      tab.setAttribute('aria-selected', isActive);
    });
    
    els.tabContents.forEach(content => {
      const isActive = content.id === tabName + 'Tab';
      content.classList.toggle('active', isActive);
    });
    
    logger.info(`Switched to tab: ${tabName}`);
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
    
    showToast(`${key} ${newValue ? 'etkinleştirildi' : 'devre dışı bırakıldı'}`, 'success');
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
    
    showToast('Ayarlar kaydedildi', 'success');
    logger.info(`Setting ${key} updated to ${value}`);
  }
  
  // Switch theme
  async function switchTheme(theme) {
    const isDark = theme === 'dark';
    document.body.classList.toggle('dark-mode', isDark);
    await PriceTrackerHelpers.setStorage('darkMode', isDark);
    
    updateThemeOptions(theme);
    
    // Re-initialize icons
    if (typeof lucide !== 'undefined') {
      lucide.createIcons();
    }
    
    showToast(`${isDark ? 'Koyu' : 'Açık'} tema etkinleştirildi`, 'success');
    logger.info(`Theme switched to: ${theme}`);
  }
  
  // Update theme options UI
  function updateThemeOptions(activeTheme) {
    els.themeOptions.forEach(option => {
      option.classList.toggle('active', option.dataset.theme === activeTheme);
    });
  }
  
  // Update stats
  function updateStats() {
    els.totalProducts.textContent = products.length;
    
    // Calculate savings and checks in a single loop
    let totalSavings = 0;
    let totalChecks = 0;
    
    for (const product of products) {
      if (product.initialPrice && product.price < product.initialPrice) {
        totalSavings += (product.initialPrice - product.price);
      }
      if (product.priceHistory) {
        totalChecks += product.priceHistory.length;
      }
    }
    
    els.totalSavings.textContent = totalSavings > 0 ? 
      `${totalSavings.toFixed(2)}₺` : '0₺';
    els.totalChecks.textContent = totalChecks;
  }
  
  // Export data
  function exportData() {
    const data = {
      version: '2.1.0',
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
    
    showToast('Veriler dışa aktarıldı', 'success');
    logger.success('Data exported');
  }
  
  // Import data
  async function importData(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    // Show loading
    els.importBtn.disabled = true;
    els.importBtn.innerHTML = '<div class="spinner"></div><span>İçe Aktarılıyor...</span>';
    
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      
      // Validate
      if (!data.products || !Array.isArray(data.products)) {
        throw new Error('Geçersiz veri formatı');
      }
      
      // Confirm
      const confirmed = confirm(
        `${data.products.length} ürün içe aktarılacak.\n` +
        `Mevcut ${products.length} ürünle birleştirilecek.\n\n` +
        `Devam edilsin mi?`
      );
      
      if (!confirmed) {
        resetImportButton();
        return;
      }
      
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
      showToast(`${addedCount} yeni ürün içe aktarıldı`, 'success');
      logger.success(`Imported ${addedCount} products`);
      
    } catch (error) {
      showToast('İçe aktarma başarısız: ' + error.message, 'error');
      logger.error('Import error:', error);
    } finally {
      resetImportButton();
    }
    
    // Reset file input
    event.target.value = '';
  }
  
  // Reset import button
  function resetImportButton() {
    els.importBtn.disabled = false;
    els.importBtn.innerHTML = '<i data-lucide="upload"></i><span>İçe Aktar</span>';
    if (typeof lucide !== 'undefined') {
      lucide.createIcons();
    }
  }
  
  // Clear history
  async function clearHistory() {
    const confirmed = confirm(
      'Tüm ürünlerin fiyat geçmişi silinecek.\n' +
      'Ürünler silinmeyecek, sadece geçmiş fiyat bilgileri temizlenecek.\n\n' +
      'Devam edilsin mi?'
    );
    
    if (!confirmed) return;
    
    // Show loading
    els.clearHistoryBtn.disabled = true;
    els.clearHistoryBtn.innerHTML = '<div class="spinner"></div><span>Temizleniyor...</span>';
    
    products.forEach(product => {
      product.priceHistory = [];
      product.previousPrice = null;
    });
    
    await PriceTrackerHelpers.setStorage('trackedProducts', products);
    updateStats();
    
    // Reset button
    setTimeout(() => {
      els.clearHistoryBtn.disabled = false;
      els.clearHistoryBtn.innerHTML = '<i data-lucide="clock"></i><span>Fiyat Geçmişini Temizle</span>';
      if (typeof lucide !== 'undefined') {
        lucide.createIcons();
      }
    }, 1000);
    
    showToast('Fiyat geçmişi temizlendi', 'success');
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
    
    // Show loading
    els.clearAllBtn.disabled = true;
    els.clearAllBtn.innerHTML = '<div class="spinner"></div><span>Siliniyor...</span>';
    
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
    
    // Reset button
    setTimeout(() => {
      els.clearAllBtn.disabled = false;
      els.clearAllBtn.innerHTML = '<i data-lucide="alert-triangle"></i><span>Tüm Verileri Sil</span>';
      if (typeof lucide !== 'undefined') {
        lucide.createIcons();
      }
    }, 1000);
    
    showToast('Tüm veriler silindi', 'success');
    logger.warn('All data cleared');
  }
  
  // Show toast notification
  function showToast(message, type = 'success') {
    els.toastMessage.textContent = message;
    
    const icons = {
      success: '✅',
      error: '❌',
      info: 'ℹ️',
      warning: '⚠️'
    };
    
    els.toastIcon.textContent = icons[type] || icons.success;
    els.toast.classList.add('show');
    
    setTimeout(() => {
      els.toast.classList.remove('show');
    }, 3000);
  }
  
  // Initialize on load
  document.addEventListener('DOMContentLoaded', init);
  
})();