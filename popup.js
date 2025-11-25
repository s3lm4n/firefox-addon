// Enhanced Popup Script v3.3 - FIXED Debug Console
(function () {
  "use strict";

  let currentProduct = null;
  let products = [];
  let settings = null;
  let searchTimeout = null;

  // DOM Elements Cache
  const $ = (id) => document.getElementById(id);
  const $$ = (sel) => document.querySelectorAll(sel);

  const els = {
    // Tabs
    tabs: $$(".tab"),
    tabContents: $$(".tab-content"),

    // Header Stats
    totalProducts: $("totalProducts"),
    totalSavings: $("totalSavings"),
    lastCheck: $("lastCheck"),
    themeToggle: $("themeToggle"),
    debugBtn: $("debugBtn"),
    settingsBtn: $("settingsBtn"),

    // Home Tab
    loadingState: $("loadingState"),
    productDetected: $("productDetected"),
    emptyState: $("emptyState"),
    detectedName: $("detectedName"),
    detectedPrice: $("detectedPrice"),
    detectedConfidence: $("detectedConfidence"),
    detectedSite: $("detectedSite"),
    addProductBtn: $("addProductBtn"),
    refreshAllBtn: $("refreshAllBtn"),
    openSiteBtn: $("openSiteBtn"),
    manualSelectBtn: $("manualSelectBtn"),

    // List Tab
    searchInput: $("searchInput"),
    clearSearch: $("clearSearch"),
    productList: $("productList"),
    listEmptyState: $("listEmptyState"),

    // Toast
    toast: $("toast"),
    toastIcon: $("toastIcon"),
    toastMessage: $("toastMessage"),
  };

  /**
   * Initialize popup
   */
  async function init() {
    console.log("[Popup] 🚀 Initializing enhanced version...");

    try {
      // Load and apply theme
      await loadTheme();

      // Load settings from background
      await loadSettings();

      // Setup all event listeners
      setupEventListeners();

      // Load products from storage
      await loadProducts();

      // Check current page for product
      await checkCurrentPage();

      // Update header stats
      updateStats();

      console.log("[Popup] ✅ Initialization complete");
    } catch (error) {
      console.error("[Popup] ❌ Initialization error:", error);
      showToast("Başlatma hatası", "error");
    }
  }

  /**
   * Load and apply theme
   */
  async function loadTheme() {
    try {
      const result = await browser.storage.local.get("darkMode");
      const darkMode = result.darkMode || false;
      document.body.classList.toggle("dark-mode", darkMode);
    } catch (error) {
      console.error("[Popup] Theme load error:", error);
    }
  }

  /**
   * Load settings from background - uses Messenger abstraction
   */
  async function loadSettings() {
    try {
      settings = await Messenger.Actions.getSettings();
      if (!settings) {
        settings = Config.DEFAULT_SETTINGS;
      }
    } catch (error) {
      console.error("[Popup] Settings load error:", error);
      settings = {};
    }
  }

  /**
   * Setup all event listeners
   */
  function setupEventListeners() {
    // Tab navigation
    els.tabs.forEach((tab) => {
      tab.addEventListener("click", () => switchTab(tab.dataset.tab));

      // Keyboard navigation for tabs
      tab.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          switchTab(tab.dataset.tab);
        }
      });
    });

    // Theme toggle
    els.themeToggle?.addEventListener("click", toggleTheme);

    // Debug button - FIXED: Opens debug.html directly
    els.debugBtn?.addEventListener("click", openDebugConsole);

    // Settings button
    els.settingsBtn?.addEventListener("click", openSettings);

    // Add product button
    els.addProductBtn?.addEventListener("click", addProduct);

    // Refresh all button
    els.refreshAllBtn?.addEventListener("click", refreshAll);

    // Open site button
    els.openSiteBtn?.addEventListener("click", () => {
      if (currentProduct?.url) {
        browser.tabs.create({ url: currentProduct.url });
      }
    });

    // Manual select button
    els.manualSelectBtn?.addEventListener("click", activateManualSelector);

    // Search with debounce
    els.searchInput?.addEventListener("input", () => {
      clearTimeout(searchTimeout);
      searchTimeout = setTimeout(handleSearch, 300);
    });

    // Clear search
    els.clearSearch?.addEventListener("click", clearSearch);

    // Keyboard shortcuts
    document.addEventListener("keydown", handleKeyboardShortcuts);
  }

  /**
   * Open debug console - FIXED VERSION
   */
  async function openDebugConsole() {
    try {
      // Open the debug.html page in a new tab
      const debugUrl = browser.runtime.getURL("debug.html");
      await browser.tabs.create({ url: debugUrl });

      showToast("🔧 Debug konsolu açıldı", "success");

      // Close popup to show the debug console
      window.close();
    } catch (error) {
      console.error("[Popup] Debug console error:", error);

      // Fallback: Show instructions
      try {
        await browser.tabs.create({
          url: "about:debugging#/runtime/this-firefox",
        });
        showToast("ℹ️ about:debugging açıldı", "info");
        window.close();
      } catch (fallbackError) {
        showToast("❌ Debug konsolu açılamadı", "error");
      }
    }
  }

  /**
   * Open settings page
   */
  function openSettings() {
    browser.runtime.openOptionsPage();
  }

  /**
   * Activate manual selector
   */
  async function activateManualSelector() {
    try {
      showToast("🎯 Manuel seçici aktifleştiriliyor...", "info");

      // Get active tab
      const tabs = await browser.tabs.query({
        active: true,
        currentWindow: true,
      });

      if (!tabs || !tabs[0]) {
        throw new Error("Aktif sekme bulunamadı");
      }

      const tab = tabs[0];

      // Inject picker script
      await browser.tabs.executeScript(tab.id, { file: "picker.js" });

      // Close popup to allow interaction with page
      window.close();
    } catch (error) {
      console.error("[Popup] Manual selector error:", error);
      showToast("❌ Manuel seçici başlatılamadı", "error");
    }
  }

  /**
   * Handle keyboard shortcuts
   */
  function handleKeyboardShortcuts(e) {
    // Ctrl/Cmd + K for search focus
    if ((e.ctrlKey || e.metaKey) && e.key === "k") {
      e.preventDefault();
      switchTab("list");
      setTimeout(() => els.searchInput?.focus(), 100);
    }

    // Escape to clear search
    if (e.key === "Escape" && els.searchInput === document.activeElement) {
      clearSearch();
    }
  }

  /**
   * Switch between tabs
   */
  function switchTab(tabName) {
    els.tabs.forEach((tab) => {
      const isActive = tab.dataset.tab === tabName;
      tab.classList.toggle("active", isActive);
      tab.setAttribute("aria-selected", isActive);
    });

    els.tabContents.forEach((content) => {
      const isActive = content.id === tabName + "Tab";
      content.classList.toggle("active", isActive);
    });

    console.log("[Popup] 📑 Switched to tab:", tabName);
  }

  /**
   * Toggle dark/light theme
   */
  async function toggleTheme() {
    try {
      const isDark = document.body.classList.toggle("dark-mode");
      await browser.storage.local.set({ darkMode: isDark });

      // Re-render products to update theme
      renderProducts(els.searchInput?.value || "");

      showToast(isDark ? "🌙 Koyu tema" : "☀️ Açık tema", "info");
    } catch (error) {
      console.error("[Popup] Theme toggle error:", error);
    }
  }

  /**
   * Load products from storage - uses centralized Validators
   */
  async function loadProducts() {
    try {
      const result = await browser.storage.local.get("trackedProducts");
      const stored = result.trackedProducts || [];

      // Validate and sanitize products using centralized Validators
      products = stored
        .map((p) => Validators.sanitizeProductData(p))
        .filter((p) => p !== null);

      console.log("[Popup] 📦 Loaded", products.length, "products");

      // Render products list
      renderProducts();
    } catch (error) {
      console.error("[Popup] Load products error:", error);
      products = [];
      renderProducts();
    }
  }

  /**
   * Save products to storage
   */
  async function saveProducts() {
    try {
      await browser.storage.local.set({ trackedProducts: products });
      return true;
    } catch (error) {
      console.error("[Popup] Save products error:", error);
      return false;
    }
  }

  /**
   * Check current page for product - uses Validators and Messenger
   */
  async function checkCurrentPage() {
    try {
      showLoading();

      // Get active tab
      const tabs = await browser.tabs.query({
        active: true,
        currentWindow: true,
      });
      if (!tabs || !tabs[0]) {
        showEmpty("Tab bulunamadı");
        return;
      }

      const tab = tabs[0];

      // Validate URL using centralized Validators
      if (!Validators.isValidPageForExtraction(tab.url)) {
        showEmpty("Geçersiz sayfa");
        return;
      }

      // Ensure content script is loaded
      const scriptLoaded = await ensureContentScript(tab.id);
      if (!scriptLoaded) {
        showEmpty("Sayfa yükleniyor...");
        setTimeout(() => checkCurrentPage(), 2000);
        return;
      }

      // Get product info from content script using Messenger
      const response = await Messenger.Actions.getProductInfo(tab.id, false);

      if (response && Validators.isValidProductInfo(response)) {
        currentProduct = Validators.sanitizeProductData(response);
        showProduct(currentProduct);
      } else {
        showEmpty("Ürün bulunamadı");
      }
    } catch (error) {
      console.error("[Popup] Check page error:", error);
      showEmpty("Hata oluştu");
    }
  }

  /**
   * Ensure content script is injected and loaded - uses Messenger
   */
  async function ensureContentScript(tabId) {
    try {
      const isLoaded = await Messenger.Actions.pingTab(tabId);
      return isLoaded;
    } catch (e) {
      console.log("[Popup] 💉 Injecting content script...");

      try {
        await browser.tabs.executeScript(tabId, { file: "lib/helpers.js" });
        await browser.tabs.executeScript(tabId, { file: "lib/sites.js" });
        await browser.tabs.executeScript(tabId, { file: "lib/parser.js" });
        await browser.tabs.executeScript(tabId, { file: "content.js" });

        // Wait for script to initialize
        await PriceTrackerHelpers.wait(800);
        return true;
      } catch (error) {
        console.error("[Popup] Script injection failed:", error);
        return false;
      }
    }
  }

  /**
   * Show loading state
   */
  function showLoading() {
    els.loadingState.style.display = "block";
    els.productDetected.style.display = "none";
    els.emptyState.style.display = "none";
  }

  /**
   * Show detected product
   */
  function showProduct(product) {
    els.loadingState.style.display = "none";
    els.emptyState.style.display = "none";
    els.productDetected.style.display = "block";

    // Set product details
    els.detectedName.textContent = product.name;
    els.detectedPrice.textContent = `${product.price.toFixed(2)} ${
      product.currency
    }`;
    els.detectedSite.textContent = product.site || "Site";

    // Show confidence
    const confidence = Math.round((product.confidence || 0.8) * 100);
    els.detectedConfidence.textContent = `✓ ${confidence}%`;

    // Check if already tracked
    const exists = products.find((p) => p.url === product.url);

    if (exists) {
      els.addProductBtn.innerHTML = `
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
          <polyline points="20 6 9 17 4 12"></polyline>
        </svg>
        <span>Zaten Takipte</span>
      `;
      els.addProductBtn.disabled = true;
    } else {
      els.addProductBtn.innerHTML = `
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
          <line x1="12" y1="5" x2="12" y2="19"></line>
          <line x1="5" y1="12" x2="19" y2="12"></line>
        </svg>
        <span>Takibe Al</span>
      `;
      els.addProductBtn.disabled = false;
    }
  }

  /**
   * Show empty state with custom message
   */
  function showEmpty(message) {
    els.loadingState.style.display = "none";
    els.productDetected.style.display = "none";
    els.emptyState.style.display = "block";
    els.emptyState.querySelector(".empty-text").textContent = message;
  }

  /**
   * Add product to tracking
   */
  async function addProduct() {
    if (!currentProduct) return;

    els.addProductBtn.disabled = true;
    els.addProductBtn.innerHTML = `
      <div class="spinner"></div>
      <span>Ekleniyor...</span>
    `;

    try {
      const product = {
        name: currentProduct.name,
        price: currentProduct.price,
        currency: currentProduct.currency,
        url: currentProduct.url,
        site: currentProduct.site,
        initialPrice: currentProduct.price,
        previousPrice: null,
        priceHistory: [],
        addedDate: Date.now(),
        lastCheck: Date.now(),
        lastCheckStatus: "success",
        confidence: currentProduct.confidence || 0.8,
      };

      products.push(product);

      const saved = await saveProducts();

      if (saved) {
        showToast("✅ Ürün eklendi!", "success");

        els.addProductBtn.innerHTML = `
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
            <polyline points="20 6 9 17 4 12"></polyline>
          </svg>
          <span>Eklendi!</span>
        `;

        // Update UI
        renderProducts();
        updateStats();

        // Switch to list tab after 1 second
        setTimeout(() => switchTab("list"), 1000);
      } else {
        throw new Error("Kaydetme başarısız");
      }
    } catch (error) {
      console.error("[Popup] Add product error:", error);
      showToast("❌ Ekleme başarısız", "error");

      els.addProductBtn.innerHTML = `
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
          <line x1="12" y1="5" x2="12" y2="19"></line>
          <line x1="5" y1="12" x2="19" y2="12"></line>
        </svg>
        <span>Tekrar Dene</span>
      `;
      els.addProductBtn.disabled = false;
    }
  }

  /**
   * Refresh all products - uses Messenger abstraction
   */
  async function refreshAll() {
    if (products.length === 0) {
      showToast("ℹ️ Takip edilen ürün yok", "info");
      return;
    }

    els.refreshAllBtn.disabled = true;
    els.refreshAllBtn.innerHTML = `
      <div class="spinner"></div>
      <span>Kontrol ediliyor...</span>
    `;

    try {
      const result = await Messenger.Actions.checkAllPrices();

      if (result && !result.error) {
        els.refreshAllBtn.innerHTML = `
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="20 6 9 17 4 12"></polyline>
          </svg>
          <span>Tamamlandı!</span>
        `;

        // Reload products
        await loadProducts();
        updateStats();

        const msg =
          result.updated > 0
            ? `✅ ${result.updated} güncelleme`
            : "ℹ️ Değişiklik yok";
        showToast(msg, result.updated > 0 ? "success" : "info");

        // Reset button after toast duration
        setTimeout(() => {
          els.refreshAllBtn.innerHTML = `
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="23 4 23 10 17 10"></polyline>
              <polyline points="1 20 1 14 7 14"></polyline>
              <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path>
            </svg>
            <span>Hepsini Kontrol</span>
          `;
          els.refreshAllBtn.disabled = false;
        }, 2000);
      } else {
        throw new Error(result?.error || "Bilinmeyen hata");
      }
    } catch (error) {
      console.error("[Popup] Refresh all error:", error);
      showToast("❌ Kontrol başarısız", "error");

      els.refreshAllBtn.innerHTML = `
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="23 4 23 10 17 10"></polyline>
          <polyline points="1 20 1 14 7 14"></polyline>
          <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path>
        </svg>
        <span>Hepsini Kontrol</span>
      `;
      els.refreshAllBtn.disabled = false;
    }
  }

  /**
   * Render products list
   * NOTE: No limit on number of products - renders ALL tracked items
   * Optimized for performance with large datasets (50+ products)
   */
  function renderProducts(filterText = "") {
    if (products.length === 0) {
      els.productList.innerHTML = "";
      els.listEmptyState.style.display = "block";
      return;
    }

    let filtered = products;

    // Apply search filter - works across ALL products
    if (filterText) {
      const search = filterText.toLowerCase();
      filtered = products.filter(
        (p) =>
          p.name.toLowerCase().includes(search) ||
          (p.site && p.site.toLowerCase().includes(search))
      );
    }

    // Show no results message
    if (filtered.length === 0) {
      els.productList.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">🔍</div>
          <div class="empty-title">Sonuç Bulunamadı</div>
          <div class="empty-text">"${PriceTrackerHelpers.escapeHtml(
            filterText
          )}" için sonuç yok</div>
        </div>
      `;
      els.listEmptyState.style.display = "none";
      return;
    }

    els.listEmptyState.style.display = "none";

    // Sort by last check (most recent first)
    filtered.sort((a, b) => (b.lastCheck || 0) - (a.lastCheck || 0));

    // Render ALL product cards - no limits!
    // Using DocumentFragment for better performance with large lists
    const fragment = document.createDocumentFragment();
    const tempDiv = document.createElement("div");
    
    // Create index map for O(1) lookup instead of O(n) indexOf
    const productIndexMap = new Map(products.map((p, i) => [p, i]));
    
    // Batch render for performance
    tempDiv.innerHTML = filtered
      .map((product) => {
        const originalIndex = productIndexMap.get(product);
        return renderProductCard(product, originalIndex);
      })
      .join("");
    
    // Move all children to fragment
    while (tempDiv.firstChild) {
      fragment.appendChild(tempDiv.firstChild);
    }
    
    // Clear and append in one operation
    els.productList.innerHTML = "";
    els.productList.appendChild(fragment);

    // Attach event listeners to cards
    attachCardListeners();
  }

  /**
   * Render single product card HTML
   */
  function renderProductCard(product, index) {
    const price = parseFloat(product.price);
    const oldPrice = parseFloat(product.previousPrice || product.initialPrice);

    // Calculate price change
    let changeHTML = "";
    if (!isNaN(oldPrice) && Math.abs(price - oldPrice) > 0.01) {
      const diff = price - oldPrice;
      const percent = ((diff / oldPrice) * 100).toFixed(1);
      const isDown = diff < 0;

      changeHTML = `
        <div class="price-change-badge ${isDown ? "down" : "up"}">
          <span>${isDown ? "↓" : "↑"}</span>
          <span>${Math.abs(percent)}%</span>
        </div>
      `;
    }

    // Status indicator
    const statusClass =
      product.lastCheckStatus === "success"
        ? "success"
        : product.lastCheckStatus === "failed"
        ? "error"
        : "pending";

    const lastCheckText = product.lastCheck
      ? PriceTrackerHelpers.formatDate(product.lastCheck)
      : "Kontrol edilmedi";

    return `
      <div class="product-card" data-index="${index}">
        <div class="card-top">
          <div class="card-name">${PriceTrackerHelpers.escapeHtml(
            product.name
          )}</div>
          <div class="site-badge">${PriceTrackerHelpers.escapeHtml(
            product.site
          )}</div>
        </div>
        
        <div class="card-price-row">
          <div class="card-price">${price.toFixed(2)} ${product.currency}</div>
          ${changeHTML}
        </div>
        
        <div class="card-meta">
          <div class="status-dot ${statusClass}"></div>
          <span>${lastCheckText}</span>
        </div>
        
        <div class="card-actions">
          <button class="card-btn btn-visit" data-url="${PriceTrackerHelpers.escapeHtml(
            product.url
          )}" title="Sitede aç">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
              <polyline points="15 3 21 3 21 9"></polyline>
              <line x1="10" y1="14" x2="21" y2="3"></line>
            </svg>
            <span>Aç</span>
          </button>
          <button class="card-btn btn-refresh" data-index="${index}" title="Fiyat kontrol">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="23 4 23 10 17 10"></polyline>
              <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10"></path>
            </svg>
            <span>Kontrol</span>
          </button>
          <button class="card-btn btn-delete" data-index="${index}" title="Sil">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="3 6 5 6 21 6"></polyline>
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
            </svg>
            <span>Sil</span>
          </button>
        </div>
      </div>
    `;
  }

  /**
   * Attach event listeners to product cards
   */
  function attachCardListeners() {
    // Visit site buttons
    $$(".btn-visit").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        browser.tabs.create({ url: btn.dataset.url });
      });
    });

    // Refresh price buttons
    $$(".btn-refresh").forEach((btn) => {
      btn.addEventListener("click", async (e) => {
        e.stopPropagation();
        const index = parseInt(btn.dataset.index);
        await checkSingleProduct(index, btn);
      });
    });

    // Delete buttons
    $$(".btn-delete").forEach((btn) => {
      btn.addEventListener("click", async (e) => {
        e.stopPropagation();
        const index = parseInt(btn.dataset.index);
        await deleteProduct(index);
      });
    });
  }

  /**
   * Check single product price - uses Messenger abstraction
   */
  async function checkSingleProduct(index, btn) {
    const product = products[index];
    if (!product) return;

    const originalHTML = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<div class="spinner"></div>';

    try {
      const result = await Messenger.Actions.checkSingleProduct(product);

      if (result && result.product) {
        products[index] = result.product;
        await saveProducts();

        renderProducts(els.searchInput?.value || "");
        updateStats();

        showToast(
          result.updated ? "✅ Fiyat güncellendi!" : "ℹ️ Değişiklik yok",
          result.updated ? "success" : "info"
        );
      } else {
        throw new Error("Kontrol başarısız");
      }
    } catch (error) {
      console.error("[Popup] Check single error:", error);
      showToast("❌ Kontrol başarısız", "error");
      btn.innerHTML = originalHTML;
      btn.disabled = false;
    }
  }

  /**
   * Delete product with confirmation
   */
  async function deleteProduct(index) {
    const product = products[index];
    if (!product) return;

    const confirmed = confirm(
      `"${product.name.substring(
        0,
        60
      )}..."\n\nBu ürün silinecek. Devam edilsin mi?`
    );

    if (!confirmed) return;

    try {
      products.splice(index, 1);
      await saveProducts();

      renderProducts(els.searchInput?.value || "");
      updateStats();

      showToast("🗑️ Ürün silindi", "success");
    } catch (error) {
      console.error("[Popup] Delete error:", error);
      showToast("❌ Silme başarısız", "error");
    }
  }

  /**
   * Handle search input
   */
  function handleSearch() {
    const value = els.searchInput?.value.trim() || "";

    // Toggle clear button
    if (els.clearSearch) {
      els.clearSearch.classList.toggle("show", value.length > 0);
    }

    // Filter products
    renderProducts(value);
  }

  /**
   * Clear search input
   */
  function clearSearch() {
    if (els.searchInput) {
      els.searchInput.value = "";
      els.searchInput.focus();
    }
    if (els.clearSearch) {
      els.clearSearch.classList.remove("show");
    }
    renderProducts();
  }

  /**
   * Update header statistics
   */
  function updateStats() {
    // Total products count
    els.totalProducts.textContent = products.length;

    // Calculate total savings
    let savings = 0;
    products.forEach((p) => {
      const initial = parseFloat(p.initialPrice);
      const current = parseFloat(p.price);
      if (!isNaN(initial) && !isNaN(current) && current < initial) {
        savings += initial - current;
      }
    });

    els.totalSavings.textContent =
      savings > 0 ? `${savings.toFixed(0)}₺` : "0₺";

    // Last check time
    const lastChecks = products
      .map((p) => p.lastCheck)
      .filter((c) => c)
      .sort((a, b) => b - a);

    if (lastChecks.length > 0) {
      els.lastCheck.textContent = PriceTrackerHelpers.getRelativeTime(
        lastChecks[0]
      );
    } else {
      els.lastCheck.textContent = "-";
    }
  }

  /**
   * Show toast notification - uses Config.UI.TOAST_DURATION_MS
   */
  function showToast(message, type = "info") {
    const icons = {
      success: "✅",
      error: "❌",
      info: "ℹ️",
      warning: "⚠️",
    };

    els.toastIcon.textContent = icons[type] || icons.info;
    els.toastMessage.textContent = message;

    els.toast.classList.add("show");

    setTimeout(() => {
      els.toast.classList.remove("show");
    }, Config.UI.TOAST_DURATION_MS);
  }

  // Initialize when DOM is ready
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
