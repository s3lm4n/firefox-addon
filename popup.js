// Popup Script v3.0 - Fully Modernized with A11y & UX Enhancements
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
    skeletonLoading: document.getElementById('skeletonLoading'),
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
    themeToggle: document.getElementById('themeToggle'),
    priceSearchInput: document.getElementById('priceSearchInput'),
    listSearchInput: document.getElementById('listSearchInput'),
    clearListSearch: document.getElementById('clearListSearch'),
    searchSuggestion: document.getElementById('searchSuggestion'),
    debugConsole: document.getElementById('debugConsole'),
    clearDebug: document.getElementById('clearDebug'),
    exportDebug: document.getElementById('exportDebug'),
    contentArea: document.getElementById('contentArea')
  };
  
  // Debug logging with memory limit
  function addDebugLog(message, type = 'info') {
    const timestamp = new Date().toLocaleTimeString('tr-TR');
    const log = { message, type, timestamp };
    debugLogs.push(log);
    
    if (debugLogs.length > 50) debugLogs.shift();
    
    const debugLine = document.createElement('div');
    debugLine.className = `debug-line ${type}`;
    debugLine.textContent = `[${timestamp}] ${message}`;
    els.debugConsole.appendChild(debugLine);
    
    if (els.debugConsole.children.length > 50) {
      els.debugConsole.removeChild(els.debugConsole.firstChild);
    }
    
    els.debugConsole.scrollTop = els.debugConsole.scrollHeight;
  }
  
  // Initialize
  async function init() {
    addDebugLog('Popup başlatılıyor...', 'info');
    
    // Load dark mode preference
    const darkMode = await PriceTrackerHelpers.getStorage('darkMode', false);
    if (darkMode) document.body.classList.add('dark-mode');
    
    // Load settings
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
    setupKeyboardNavigation();
    await loadProducts();
    await checkCurrentPage();
    updateStats();
    
    // Initialize Lucide icons
    if (typeof lucide !== 'undefined') {
      lucide.createIcons();
    }
    
    addDebugLog('Popup hazır', 'success');
  }
  
  // Event listeners
  function setupEventListeners() {
    // Tab switching
    els.tabs.forEach(tab => {
      tab.addEventListener('click', () => switchTab(tab.dataset.tab));
    });
    
    // Settings button
    els.settingsBtn.addEventListener('click', () => {
      browser.runtime.openOptionsPage();
      addDebugLog('Ayarlar sayfası açılıyor', 'info');
    });
    
    // Theme toggle
    els.themeToggle.addEventListener('click', toggleTheme);
    
    // Action buttons
    els.addButton.addEventListener('click', addToTracking);
    els.refreshAllBtn.addEventListener('click', refreshAllProducts);
    
    // Search inputs
    els.priceSearchInput.addEventListener('input', handlePriceSearch);
    els.listSearchInput.addEventListener('input', handleListSearch);
    els.clearListSearch.addEventListener('click', clearListSearch);
    
    // Debug actions
    els.clearDebug.addEventListener('click', () => {
      debugLogs = [];
      els.debugConsole.innerHTML = '<div class="debug-line success">[INFO] Konsol temizlendi</div>';
    });
    
    els.exportDebug.addEventListener('click', exportDebugLogs);
  }
  
  // Keyboard navigation
  function setupKeyboardNavigation() {
    const tabs = Array.from(els.tabs);
    
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
    
    // Escape to close search
    els.listSearchInput.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        clearListSearch();
        els.listSearchInput.blur();
      }
    });
    
    // Ctrl/Cmd + K for quick search focus
    document.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        const activeTab = document.querySelector('.tab.active');
        if (activeTab && activeTab.dataset.tab === 'list') {
          els.listSearchInput.focus();
        }
      }
    });
  }
  
  // Tab switching with ARIA updates
  function switchTab(tabName) {
    els.tabs.forEach(tab => {
      const isActive = tab.dataset.tab === tabName;
      tab.classList.toggle('active', isActive);
      tab.setAttribute('aria-selected', isActive);
    });
    
    els.tabContents.forEach(content => {
      const isActive = content.id === tabName + 'Tab';
      content.classList.toggle('active', isActive);
    });
    
    addDebugLog(`Tab: ${tabName}`, 'info');
  }
  
  // Theme toggle
  async function toggleTheme() {
    const isDark = document.body.classList.toggle('dark-mode');
    await PriceTrackerHelpers.setStorage('darkMode', isDark);
    addDebugLog(`Tema: ${isDark ? 'Koyu' : 'Açık'}`, 'info');
    
    // Re-initialize icons for proper color
    if (typeof lucide !== 'undefined') {
      lucide.createIcons();
    }
  }
  
  // Check current page
  async function checkCurrentPage() {
    try {
      els.homeLoading.style.display = 'none';
      els.skeletonLoading.style.display = 'block';
      els.currentPageSection.style.display = 'none';
      
      const tabs = await browser.tabs.query({ active: true, currentWindow: true });
      if (!tabs[0]) {
        showEmptyState('❌', 'Aktif sekme bulunamadı');
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
        
        // Confidence badge color
        if (confidence >= 85) {
          els.confidenceBadge.style.background = 'rgba(34, 197, 94, 0.3)';
        } else if (confidence >= 70) {
          els.confidenceBadge.style.background = 'rgba(245, 158, 11, 0.3)';
        } else {
          els.confidenceBadge.style.background = 'rgba(239, 68, 68, 0.3)';
        }
        
        // Check if already tracked
        const exists = products.find(p => p.url === response.url);
        updateAddButton(exists);
        
        els.skeletonLoading.style.display = 'none';
        els.currentPageSection.style.display = 'block';
        
        addDebugLog(`Ürün: ${response.name.substring(0, 40)}...`, 'success');
        
      } else {
        showEmptyState('🔍', 'Ürün Bulunamadı', 'Bu sayfa bir ürün sayfası değil');
        addDebugLog('Ürün algılanamadı', 'warn');
      }
      
    } catch (error) {
      addDebugLog(`Hata: ${error.message}`, 'error');
      showEmptyState('⚠️', 'Hata', 'Sayfa bilgisi alınamadı');
    }
  }
  
  // Update add button state
  function updateAddButton(exists) {
    if (exists) {
      els.addButton.innerHTML = '<i data-lucide="check-circle" class="icon-sm"></i><span>Zaten Takipte</span>';
      els.addButton.style.background = 'var(--success)';
      els.addButton.style.color = 'white';
      els.addButton.disabled = true;
    } else {
      els.addButton.innerHTML = '<i data-lucide="plus-circle" class="icon-sm"></i><span>Takibe Al</span>';
      els.addButton.style.background = 'white';
      els.addButton.style.color = 'var(--primary)';
      els.addButton.disabled = false;
    }
    
    if (typeof lucide !== 'undefined') {
      lucide.createIcons();
    }
  }
  
  // Show empty state
  function showEmptyState(icon, title, text = '') {
    els.skeletonLoading.style.display = 'none';
    els.homeLoading.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">${icon}</div>
        <div class="empty-title">${title}</div>
        ${text ? `<div class="empty-text">${text}</div>` : ''}
      </div>
    `;
    els.homeLoading.style.display = 'flex';
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
        const closest = findClosestMatch(filterText, products);
        if (closest) {
          els.searchSuggestion.innerHTML = `Bunu mu kastettiniz? "<strong>${PriceTrackerHelpers.escapeHtml(closest.name.substring(0, 40))}</strong>..."`;
          els.searchSuggestion.style.display = 'block';
          els.searchSuggestion.onclick = () => {
            els.listSearchInput.value = closest.name.substring(0, 20);
            handleListSearch({ target: els.listSearchInput });
          };
        }
        
        els.productList.innerHTML = `
          <div class="empty-state">
            <div class="empty-icon">🔍</div>
            <div class="empty-title">Sonuç Bulunamadı</div>
            <div class="empty-text">"${PriceTrackerHelpers.escapeHtml(filterText)}" için sonuç yok</div>
          </div>
        `;
        return;
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
      const hasHistory = product.priceHistory && product.priceHistory.length > 1;
      
      return `
        <div class="product-card ${isHighlight ? 'highlight' : ''}" 
             data-index="${originalIndex}"
             role="listitem">
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
          
          ${hasHistory ? `
            <div class="mini-chart-container">
              <canvas class="mini-chart" 
                      id="chart-${originalIndex}" 
                      width="100" 
                      height="30"
                      role="img"
                      aria-label="Fiyat trend grafiği"></canvas>
            </div>
          ` : ''}
          
          <div class="card-meta">
            ${product.lastCheck ? `Son: ${PriceTrackerHelpers.formatDate(product.lastCheck)}` : 'Kontrol edilmedi'}
          </div>
          
          <div class="card-actions">
            <button class="btn-action btn-visit" 
                    data-url="${PriceTrackerHelpers.escapeHtml(product.url)}"
                    aria-label="Ürünü aç">
              <i data-lucide="external-link" class="icon-xs"></i>
              <span>Aç</span>
            </button>
            <button class="btn-action btn-check" 
                    data-index="${originalIndex}"
                    aria-label="Fiyatı kontrol et">
              <i data-lucide="refresh-cw" class="icon-xs"></i>
              <span>Kontrol</span>
            </button>
            <button class="btn-action btn-remove" 
                    data-index="${originalIndex}"
                    aria-label="Ürünü sil">
              <i data-lucide="trash-2" class="icon-xs"></i>
              <span>Sil</span>
            </button>
          </div>
        </div>
      `;
    }).join('');
    
    // Re-initialize Lucide icons
    if (typeof lucide !== 'undefined') {
      lucide.createIcons();
    }
    
    // Render charts after DOM update
    setTimeout(() => {
      filteredProducts.forEach((product, idx) => {
        const originalIndex = products.indexOf(product);
        renderMiniChart(originalIndex, product);
      });
    }, 0);
    
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
        checkSingleProduct(parseInt(btn.dataset.index), btn);
      });
    });
    
    els.productList.querySelectorAll('.btn-remove').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        removeProduct(parseInt(btn.dataset.index));
      });
    });
  }
  
  // Render mini chart
  function renderMiniChart(index, product) {
    if (!product.priceHistory || product.priceHistory.length < 2) return;
    
    const canvas = document.getElementById(`chart-${index}`);
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    const prices = [...product.priceHistory.map(h => h.price), product.price];
    const minPrice = Math.min(...prices);
    const maxPrice = Math.max(...prices);
    const priceRange = maxPrice - minPrice;
    
    if (priceRange === 0) return;
    
    // Normalize to canvas height
    const normalized = prices.map(p => 
      30 - ((p - minPrice) / priceRange) * 25
    );
    
    const isDarkMode = document.body.classList.contains('dark-mode');
    const isDecreasing = prices[prices.length - 1] < prices[0];
    
    // Draw line
    ctx.clearRect(0, 0, 100, 30);
    ctx.strokeStyle = isDecreasing ? '#22c55e' : '#ef4444';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    
    ctx.beginPath();
    normalized.forEach((y, i) => {
      const x = (i / (normalized.length - 1)) * 100;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();
    
    // Draw area fill
    ctx.lineTo(100, 30);
    ctx.lineTo(0, 30);
    ctx.closePath();
    ctx.fillStyle = isDecreasing
      ? 'rgba(34, 197, 94, 0.1)'
      : 'rgba(239, 68, 68, 0.1)';
    ctx.fill();
  }
  
  // Find closest match using Levenshtein distance
  function findClosestMatch(query, products) {
    const levenshtein = (a, b, threshold) => {
      if (Math.abs(a.length - b.length) > threshold) {
        return threshold + 1;
      }
      
      const matrix = [];
      for (let i = 0; i <= b.length; i++) {
        matrix[i] = [i];
      }
      for (let j = 0; j <= a.length; j++) {
        matrix[0][j] = j;
      }
      
      for (let i = 1; i <= b.length; i++) {
        let minRowValue = Infinity;
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
          minRowValue = Math.min(minRowValue, matrix[i][j]);
        }
        if (minRowValue > threshold) {
          return threshold + 1;
        }
      }
      return matrix[b.length][a.length];
    };
    
    let closest = null;
    let minDistance = Infinity;
    const maxAllowedDistance = Math.floor(query.length / 2);
    const queryLower = query.toLowerCase();
    
    for (const p of products) {
      const compareStr = p.name.toLowerCase().substring(0, query.length + 5);
      const distance = levenshtein(queryLower, compareStr, maxAllowedDistance);
      if (distance < minDistance && distance <= maxAllowedDistance) {
        minDistance = distance;
        closest = p;
      }
    }
    
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
  async function checkSingleProduct(index, btn) {
    const product = products[index];
    if (!product) return;
    
    if (btn) {
      btn.disabled = true;
      btn.innerHTML = '<i data-lucide="loader-2" class="icon-xs"></i><span>Kontrol...</span>';
      if (typeof lucide !== 'undefined') {
        lucide.createIcons();
      }
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
        btn.innerHTML = '<i data-lucide="refresh-cw" class="icon-xs"></i><span>Kontrol</span>';
        if (typeof lucide !== 'undefined') {
          lucide.createIcons();
        }
      }
    }
  }
  
  // Add to tracking with confetti effect
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
    
    // Confetti effect
    createConfetti();
    
    browser.notifications.create({
      type: 'basic',
      iconUrl: browser.runtime.getURL('icons/icon48.png'),
      title: '✅ Takibe Alındı',
      message: `${currentProduct.name.substring(0, 50)}...`
    });
    
    els.addButton.innerHTML = '<i data-lucide="check-circle" class="icon-sm"></i><span>Eklendi!</span>';
    els.addButton.style.background = 'var(--success)';
    
    if (typeof lucide !== 'undefined') {
      lucide.createIcons();
    }
    
    setTimeout(() => {
      updateAddButton(true);
    }, 2000);
    
    await loadProducts();
    updateStats();
    addDebugLog('Ürün takibe alındı', 'success');
  }
  
  // Confetti effect
  function createConfetti() {
    const colors = ['#6366f1', '#8b5cf6', '#22c55e', '#f59e0b'];
    const confettiCount = 30;
    
    for (let i = 0; i < confettiCount; i++) {
      const confetti = document.createElement('div');
      confetti.className = 'confetti';
      confetti.style.cssText = `
        position: fixed;
        width: 8px;
        height: 8px;
        background: ${colors[Math.floor(Math.random() * colors.length)]};
        left: ${Math.random() * 100}%;
        top: -10px;
        border-radius: 50%;
        animation: confettiFall ${1 + Math.random() * 2}s ease-out forwards;
        z-index: 9999;
        pointer-events: none;
      `;
      document.body.appendChild(confetti);
      
      setTimeout(() => confetti.remove(), 3000);
    }
  }
  
  // Remove product with animation
  async function removeProduct(index) {
    const card = els.productList.querySelector(`[data-index="${index}"]`);
    
    if (card) {
      card.classList.add('removing');
      await PriceTrackerHelpers.wait(400);
    }
    
    products.splice(index, 1);
    await PriceTrackerHelpers.setStorage('trackedProducts', products);
    
    await loadProducts();
    updateStats();
    
    addDebugLog('Ürün silindi', 'info');
  }
  
  // Refresh all products
  async function refreshAllProducts() {
    els.refreshAllBtn.disabled = true;
    els.refreshAllBtn.innerHTML = '<i data-lucide="loader-2" class="icon-sm"></i><span>Kontrol...</span>';
    
    if (typeof lucide !== 'undefined') {
      lucide.createIcons();
    }
    
    addDebugLog('Tüm ürünler kontrol ediliyor', 'info');
    
    try {
      const result = await browser.runtime.sendMessage({ action: 'checkAllPrices' });
      
      els.refreshAllBtn.innerHTML = '<i data-lucide="check-circle" class="icon-sm"></i><span>Tamam!</span>';
      
      if (typeof lucide !== 'undefined') {
        lucide.createIcons();
      }
      
      setTimeout(() => {
        els.refreshAllBtn.innerHTML = '<i data-lucide="refresh-cw" class="icon-sm"></i><span>Hepsini Kontrol</span>';
        els.refreshAllBtn.disabled = false;
        if (typeof lucide !== 'undefined') {
          lucide.createIcons();
        }
      }, 2000);
      
      await loadProducts();
      updateStats();
      
      addDebugLog(`${result.checked} kontrol, ${result.updated} güncelleme`, 'success');
    } catch (error) {
      addDebugLog(`Hata: ${error.message}`, 'error');
      els.refreshAllBtn.innerHTML = '<i data-lucide="x-circle" class="icon-sm"></i><span>Hata</span>';
      
      if (typeof lucide !== 'undefined') {
        lucide.createIcons();
      }
      
      setTimeout(() => {
        els.refreshAllBtn.innerHTML = '<i data-lucide="refresh-cw" class="icon-sm"></i><span>Hepsini Kontrol</span>';
        els.refreshAllBtn.disabled = false;
        if (typeof lucide !== 'undefined') {
          lucide.createIcons();
        }
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
  
  // Initialize on DOM ready
  document.addEventListener('DOMContentLoaded', init);
  
})();