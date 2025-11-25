// Settings Page Script v1.0
(function () {
  "use strict";

  const logger = PriceTrackerHelpers.createLogger("Settings");
  let settings = {};
  let products = [];

  // DOM Elements
  const $ = (id) => document.getElementById(id);
  const $$ = (sel) => document.querySelectorAll(sel);

  /**
   * Initialize settings page
   */
  async function init() {
    logger.info("🚀 Initializing settings page...");

    try {
      // Load theme
      await loadTheme();

      // Load settings
      await loadSettings();

      // Load products for stats
      await loadProducts();

      // Setup event listeners
      setupEventListeners();

      // Update debug stats
      updateDebugStats();

      logger.success("✅ Settings page initialized");
    } catch (error) {
      logger.error("❌ Initialization error:", error);
      showToast("Başlatma hatası", "error");
    }
  }

  /**
   * Load and apply theme
   */
  async function loadTheme() {
    try {
      const darkMode = await PriceTrackerHelpers.getStorage("darkMode", false);
      document.body.classList.toggle("dark-mode", darkMode);
    } catch (error) {
      logger.error("Theme load error:", error);
    }
  }

  /**
   * Load settings from storage - uses Messenger and Config
   */
  async function loadSettings() {
    try {
      settings = await Messenger.Actions.getSettings();

      if (!settings) {
        settings = Config.DEFAULT_SETTINGS;
      }

      // Populate form fields
      populateForm();

      logger.info("📥 Settings loaded:", settings);
    } catch (error) {
      logger.error("Settings load error:", error);
    }
  }

  /**
   * Load products from storage
   */
  async function loadProducts() {
    try {
      products = await PriceTrackerHelpers.getStorage("trackedProducts", []);
      logger.info(`📦 Loaded ${products.length} products`);
    } catch (error) {
      logger.error("Products load error:", error);
      products = [];
    }
  }

  /**
   * Populate form with current settings
   */
  function populateForm() {
    // General
    if ($("autoCheck")) $("autoCheck").checked = settings.autoCheck;
    if ($("checkInterval")) $("checkInterval").value = settings.checkInterval;
    if ($("maxRetries")) $("maxRetries").value = settings.maxRetries;
    if ($("rateLimitPerHour"))
      $("rateLimitPerHour").value = settings.rateLimitPerHour;

    // Notifications
    if ($("notifications")) $("notifications").checked = settings.notifications;
    if ($("notifyOnPriceDown"))
      $("notifyOnPriceDown").checked = settings.notifyOnPriceDown;
    if ($("notifyOnPriceUp"))
      $("notifyOnPriceUp").checked = settings.notifyOnPriceUp;
    if ($("minChangePercent"))
      $("minChangePercent").value = settings.minChangePercent || 5;

    // Advanced
    if ($("enablePicker"))
      $("enablePicker").checked = settings.enablePicker || false;
    if ($("verboseLogging"))
      $("verboseLogging").checked = settings.verboseLogging || false;
    if ($("cacheDuration"))
      $("cacheDuration").value = settings.cacheDuration || 300;
  }

  /**
   * Setup event listeners
   */
  function setupEventListeners() {
    // Tabs
    $$(".tab").forEach((tab) => {
      tab.addEventListener("click", () => switchTab(tab.dataset.tab));
    });

    // Theme toggle
    $("themeToggle")?.addEventListener("click", toggleTheme);

    // Save button
    $("saveBtn")?.addEventListener("click", saveSettings);

    // Cancel button
    $("cancelBtn")?.addEventListener("click", () => window.close());

    // Export/Import
    $("exportData")?.addEventListener("click", exportData);
    $("importData")?.addEventListener("click", () => $("fileInput").click());
    $("fileInput")?.addEventListener("change", importData);
    $("clearAllData")?.addEventListener("click", clearAllData);

    // Debug actions
    $("testExtraction")?.addEventListener("click", testExtraction);
    $("clearCache")?.addEventListener("click", clearCache);
    $("viewLogs")?.addEventListener("click", viewLogs);
    $("resetSettings")?.addEventListener("click", resetSettings);
    $("clearConsole")?.addEventListener("click", clearConsole);

    // Custom rules
    $("customRules")?.addEventListener("click", () => {
      showToast("Özel kurallar editörü yakında eklenecek", "info");
    });
  }

  /**
   * Switch between tabs
   */
  function switchTab(tabName) {
    $$(".tab").forEach((tab) => {
      tab.classList.toggle("active", tab.dataset.tab === tabName);
    });

    $$(".tab-content").forEach((content) => {
      content.classList.toggle("active", content.id === tabName + "Tab");
    });

    logger.info("📑 Switched to tab:", tabName);
  }

  /**
   * Toggle theme
   */
  async function toggleTheme() {
    try {
      const isDark = document.body.classList.toggle("dark-mode");
      await PriceTrackerHelpers.setStorage("darkMode", isDark);
      showToast(isDark ? "🌙 Koyu tema" : "☀️ Açık tema", "info");
    } catch (error) {
      logger.error("Theme toggle error:", error);
    }
  }

  /**
   * Save settings
   */
  async function saveSettings() {
    try {
      // Collect values from form
      const newSettings = {
        autoCheck: $("autoCheck")?.checked,
        checkInterval: parseInt($("checkInterval")?.value) || 30,
        maxRetries: parseInt($("maxRetries")?.value) || 3,
        rateLimitPerHour: parseInt($("rateLimitPerHour")?.value) || 100,
        notifications: $("notifications")?.checked,
        notifyOnPriceDown: $("notifyOnPriceDown")?.checked,
        notifyOnPriceUp: $("notifyOnPriceUp")?.checked,
        minChangePercent: parseFloat($("minChangePercent")?.value) || 5,
        enablePicker: $("enablePicker")?.checked || false,
        verboseLogging: $("verboseLogging")?.checked || false,
        cacheDuration: parseInt($("cacheDuration")?.value) || 300,
      };

      // Send to background using Messenger
      await Messenger.Actions.updateSettings(newSettings);

      settings = newSettings;

      showToast("✅ Ayarlar kaydedildi!", "success");
      logToConsole("Ayarlar başarıyla kaydedildi", "success");

      logger.success("Settings saved:", newSettings);

      // Close window after 1 second
      setTimeout(() => window.close(), 1000);
    } catch (error) {
      logger.error("Save settings error:", error);
      showToast("❌ Kaydetme hatası", "error");
      logToConsole(`Hata: ${error.message}`, "error");
    }
  }

  /**
   * Export data
   */
  async function exportData() {
    try {
      const data = {
        version: "2.0.1",
        exportDate: new Date().toISOString(),
        settings: settings,
        products: products,
      };

      const blob = new Blob([JSON.stringify(data, null, 2)], {
        type: "application/json",
      });

      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `fiyat-takipci-${Date.now()}.json`;
      a.click();

      URL.revokeObjectURL(url);

      showToast("✅ Veriler dışa aktarıldı", "success");
      logToConsole("Veriler dışa aktarıldı", "success");
    } catch (error) {
      logger.error("Export error:", error);
      showToast("❌ Dışa aktarma hatası", "error");
      logToConsole(`Hata: ${error.message}`, "error");
    }
  }

  /**
   * Import data
   */
  async function importData(e) {
    try {
      const file = e.target.files[0];
      if (!file) return;

      const reader = new FileReader();

      reader.onload = async (event) => {
        try {
          const data = JSON.parse(event.target.result);

          // Validate data
          if (!data.products || !data.settings) {
            throw new Error("Geçersiz veri formatı");
          }

          // Confirm import
          const confirmed = confirm(
            `${data.products.length} ürün ve ayarlar içe aktarılacak. Mevcut veriler silinecek. Devam edilsin mi?`
          );

          if (!confirmed) return;

          // Save imported data
          await PriceTrackerHelpers.setStorage(
            "trackedProducts",
            data.products
          );
          await Messenger.Actions.updateSettings(data.settings);

          products = data.products;
          settings = data.settings;

          populateForm();
          updateDebugStats();

          showToast("✅ Veriler içe aktarıldı", "success");
          logToConsole(`${data.products.length} ürün içe aktarıldı`, "success");

          // Reset file input
          e.target.value = "";
        } catch (parseError) {
          logger.error("Import parse error:", parseError);
          showToast("❌ Geçersiz dosya formatı", "error");
          logToConsole(`Hata: ${parseError.message}`, "error");
        }
      };

      reader.readAsText(file);
    } catch (error) {
      logger.error("Import error:", error);
      showToast("❌ İçe aktarma hatası", "error");
    }
  }

  /**
   * Clear all data - uses Messenger
   */
  async function clearAllData() {
    try {
      const confirmed = confirm(
        "TÜM VERİLER SİLİNECEK!\n\nBu işlem geri alınamaz. Tüm takip edilen ürünler ve ayarlar silinecek. Devam edilsin mi?"
      );

      if (!confirmed) return;

      // Clear storage
      await PriceTrackerHelpers.setStorage("trackedProducts", []);
      await Messenger.Actions.clearCache();

      products = [];
      updateDebugStats();

      showToast("🗑️ Tüm veriler silindi", "success");
      logToConsole("Tüm veriler temizlendi", "warning");
    } catch (error) {
      logger.error("Clear data error:", error);
      showToast("❌ Silme hatası", "error");
    }
  }

  /**
   * Test extraction on current page
   */
  async function testExtraction() {
    try {
      logToConsole("Extraction testi başlatılıyor...", "info");

      // Get active tab
      const tabs = await browser.tabs.query({
        active: true,
        currentWindow: true,
      });

      if (!tabs || !tabs[0]) {
        throw new Error("Aktif sekme bulunamadı");
      }

      const tab = tabs[0];

      logToConsole(`URL: ${tab.url}`, "info");

      // Request product info
      const response = await browser.tabs.sendMessage(tab.id, {
        action: "getProductInfo",
        skipCache: true,
      });

      if (response && response.price) {
        logToConsole(`✅ Ürün bulundu!`, "success");
        logToConsole(`İsim: ${response.name}`, "info");
        logToConsole(`Fiyat: ${response.price} ${response.currency}`, "info");
        logToConsole(`Site: ${response.site}`, "info");
        logToConsole(
          `Güven: ${Math.round(response.confidence * 100)}%`,
          "info"
        );
        logToConsole(`Metod: ${response.method}`, "info");

        showToast("✅ Test başarılı!", "success");
      } else {
        logToConsole("⚠️ Ürün bulunamadı", "warning");
        showToast("⚠️ Ürün bulunamadı", "warning");
      }
    } catch (error) {
      logger.error("Test extraction error:", error);
      logToConsole(`❌ Hata: ${error.message}`, "error");
      showToast("❌ Test hatası", "error");
    }
  }

  /**
   * Clear cache - uses Messenger
   */
  async function clearCache() {
    try {
      await Messenger.Actions.clearCache();
      logToConsole("Önbellek temizlendi", "success");
      showToast("🧹 Önbellek temizlendi", "success");
    } catch (error) {
      logger.error("Clear cache error:", error);
      showToast("❌ Önbellek temizleme hatası", "error");
    }
  }

  /**
   * View logs
   */
  function viewLogs() {
    logToConsole("Log geçmişi özelliği yakında eklenecek", "info");
    showToast("Log geçmişi yakında eklenecek", "info");
  }

  /**
   * Reset settings to defaults - uses Config.DEFAULT_SETTINGS
   */
  async function resetSettings() {
    try {
      const confirmed = confirm(
        "Tüm ayarlar varsayılan değerlere sıfırlanacak. Devam edilsin mi?"
      );

      if (!confirmed) return;

      const defaults = Config.DEFAULT_SETTINGS;

      await Messenger.Actions.updateSettings(defaults);

      settings = defaults;
      populateForm();

      showToast("🔄 Ayarlar sıfırlandı", "success");
      logToConsole("Ayarlar varsayılan değerlere sıfırlandı", "success");
    } catch (error) {
      logger.error("Reset settings error:", error);
      showToast("❌ Sıfırlama hatası", "error");
    }
  }

  /**
   * Update debug stats
   */
  function updateDebugStats() {
    if ($("debugTotalProducts")) {
      $("debugTotalProducts").textContent = products.length;
    }

    if ($("debugCacheSize")) {
      const sizeKB = new Blob([JSON.stringify(products)]).size / 1024;
      $("debugCacheSize").textContent = `${sizeKB.toFixed(1)} KB`;
    }

    if ($("debugLastCheck")) {
      const lastChecks = products
        .map((p) => p.lastCheck)
        .filter((c) => c)
        .sort((a, b) => b - a);

      if (lastChecks.length > 0) {
        $("debugLastCheck").textContent = PriceTrackerHelpers.formatDate(
          lastChecks[0]
        );
      } else {
        $("debugLastCheck").textContent = "Hiç";
      }
    }

    if ($("debugErrorCount")) {
      const errorCount = products.filter(
        (p) => p.lastCheckStatus === "error"
      ).length;
      $("debugErrorCount").textContent = errorCount;
    }
  }

  /**
   * Log to console
   */
  function logToConsole(message, type = "info") {
    const output = $("consoleOutput");
    if (!output) return;

    const time = new Date().toLocaleTimeString("tr-TR");
    const line = document.createElement("div");
    line.className = `console-line ${type}`;
    line.innerHTML = `
      <span class="console-time">${time}</span>
      <span class="console-message">${PriceTrackerHelpers.escapeHtml(
        message
      )}</span>
    `;

    output.appendChild(line);
    output.scrollTop = output.scrollHeight;

    // Keep max 100 lines
    while (output.children.length > 100) {
      output.removeChild(output.firstChild);
    }
  }

  /**
   * Clear console
   */
  function clearConsole() {
    const output = $("consoleOutput");
    if (output) {
      output.innerHTML = `
        <div class="console-line info">
          <span class="console-time">${new Date().toLocaleTimeString(
            "tr-TR"
          )}</span>
          <span class="console-message">Console temizlendi</span>
        </div>
      `;
    }
  }

  /**
   * Load custom selectors from storage
   */
  async function loadCustomSelectors() {
    const list = $("custom-selectors-list");
    if (!list) return;

    try {
      // Get all saved selectors from sync storage
      const data = await browser.storage.sync.get(null);
      
      // Filter for site selectors (they have selector property)
      const selectors = Object.entries(data)
        .filter(([key, value]) => value && value.selector)
        .map(([domain, value]) => ({
          domain,
          selector: value.selector,
          exampleText: value.exampleText || '',
          lastSaved: value.lastSaved || 0
        }));

      if (selectors.length === 0) {
        list.innerHTML = '<p style="color: #6b7280; text-align: center;">Henüz kaydedilmiş seçici yok</p>';
        return;
      }

      list.innerHTML = selectors.map(s => `
        <div style="display: flex; justify-content: space-between; align-items: center; padding: 12px; background: var(--bg-secondary, #f3f4f6); border-radius: 8px; margin-bottom: 8px;">
          <div>
            <div style="font-weight: 600; color: var(--text-primary, #111827);">${PriceTrackerHelpers.escapeHtml(s.domain)}</div>
            <div style="font-size: 12px; color: #6b7280; margin-top: 4px;">${PriceTrackerHelpers.escapeHtml(s.exampleText.substring(0, 50))}${s.exampleText.length > 50 ? '...' : ''}</div>
          </div>
          <button class="btn-icon delete-selector" data-domain="${PriceTrackerHelpers.escapeHtml(s.domain)}" title="Sil" style="background: #ef4444; color: white; border: none; border-radius: 6px; padding: 6px 10px; cursor: pointer;">
            🗑️
          </button>
        </div>
      `).join('');

      // Add delete handlers
      list.querySelectorAll('.delete-selector').forEach(btn => {
        btn.addEventListener('click', async () => {
          const domain = btn.dataset.domain;
          if (confirm(`"${domain}" için kaydedilen seçici silinsin mi?`)) {
            await browser.storage.sync.remove(domain);
            loadCustomSelectors();
            showToast('✅ Seçici silindi', 'success');
          }
        });
      });

    } catch (error) {
      logger.error('Load custom selectors error:', error);
      list.innerHTML = '<p style="color: #ef4444; text-align: center;">Yükleme hatası</p>';
    }
  }

  // Make loadCustomSelectors available globally for settings.html inline script
  window.loadCustomSelectors = loadCustomSelectors;

  /**
   * Show toast notification
   */
  function showToast(message, type = "info") {
    const toast = $("toast");
    const icon = $("toastIcon");
    const msg = $("toastMessage");

    if (!toast || !icon || !msg) return;

    const icons = {
      success: "✅",
      error: "❌",
      info: "ℹ️",
      warning: "⚠️",
    };

    icon.textContent = icons[type] || icons.info;
    msg.textContent = message;

    toast.classList.add("show");

    setTimeout(() => {
      toast.classList.remove("show");
    }, 3000);
  }

  // Make showToast available globally for settings.html inline script
  window.showToast = showToast;

  // Initialize when DOM is ready
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
