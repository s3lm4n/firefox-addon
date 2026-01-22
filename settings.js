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

      // Setup console capturing for debug panel
      setupConsoleCapture();

      logger.success("✅ Settings page initialized");
    } catch (error) {
      logger.error("❌ Initialization error:", error);
      showToast("Başlatma hatası", "error");
    }
  }

  /**
   * Setup console capturing to debug panel
   */
  function setupConsoleCapture() {
    const originalLog = console.log.bind(console);
    const originalWarn = console.warn.bind(console);
    const originalError = console.error.bind(console);

    console.log = function(...args) {
      originalLog.apply(console, args);
      const message = args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ');
      logToConsole(message, 'info');
    };

    console.warn = function(...args) {
      originalWarn.apply(console, args);
      const message = args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ');
      logToConsole(message, 'warning');
    };

    console.error = function(...args) {
      originalError.apply(console, args);
      const message = args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ');
      logToConsole(message, 'error');
    };

    logToConsole("Console capture başlatıldı - Tüm loglar bu panelde görünecek", "success");
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
    if ($("enablePriceAlerts"))
      $("enablePriceAlerts").checked = settings.enablePriceAlerts !== false;

    // Advanced
    if ($("enablePicker"))
      $("enablePicker").checked = settings.enablePicker || false;
    if ($("verboseLogging"))
      $("verboseLogging").checked = settings.verboseLogging || false;
    if ($("cacheDuration"))
      $("cacheDuration").value = settings.cacheDuration || 300;
    
    // New settings
    if ($("autoBackup"))
      $("autoBackup").checked = settings.autoBackup !== false;
    if ($("autoBackupInterval"))
      $("autoBackupInterval").value = settings.autoBackupInterval || 24;
    if ($("themePreference"))
      $("themePreference").value = settings.theme || "auto";
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

    // Export/Import - use DataManager if available
    $("exportData")?.addEventListener("click", exportData);
    $("importData")?.addEventListener("click", () => $("fileInput").click());
    $("fileInput")?.addEventListener("change", importData);
    $("clearAllData")?.addEventListener("click", clearAllData);

    // Backup actions
    $("manualBackup")?.addEventListener("click", createManualBackup);
    $("viewBackups")?.addEventListener("click", viewBackups);

    // Debug actions
    $("testExtraction")?.addEventListener("click", testExtraction);
    $("clearCache")?.addEventListener("click", clearCache);
    $("viewLogs")?.addEventListener("click", viewLogs);
    $("resetSettings")?.addEventListener("click", resetSettings);
    $("clearConsole")?.addEventListener("click", clearConsole);
    $("copyLogs")?.addEventListener("click", copyLogsToClipboard);

    // Segmented filter buttons
    $$("#logFilter .segmented-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        $$("#logFilter .segmented-btn").forEach(b => b.classList.remove("selected"));
        btn.classList.add("selected");
        filterConsoleLogs(btn.dataset.filter);
      });
    });

    // Custom rules
    $("customRules")?.addEventListener("click", () => {
      showToast("Özel kurallar editörü yakında eklenecek", "info");
    });
  }

  /**
   * Apply theme based on preference
   */
  function applyTheme(themePref) {
    if (themePref === "auto") {
      const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
      document.body.classList.toggle("dark-mode", prefersDark);
    } else if (themePref === "dark") {
      document.body.classList.add("dark-mode");
    } else {
      document.body.classList.remove("dark-mode");
    }
  }

  /**
   * Create manual backup
   */
  async function createManualBackup() {
    try {
      if (typeof DataManager !== "undefined") {
        await DataManager.downloadExport();
        showToast("✅ Yedek indirildi!", "success");
        logToConsole("Yedek başarıyla oluşturuldu", "success");
      } else {
        // Fallback to existing export
        await exportData();
      }
    } catch (error) {
      logger.error("Backup error:", error);
      showToast("❌ Yedekleme hatası", "error");
    }
  }

  /**
   * View backups
   */
  async function viewBackups() {
    try {
      if (typeof DataManager !== "undefined") {
        const backups = await DataManager.listAutoBackups();
        if (backups.length === 0) {
          showToast("Henüz otomatik yedek yok", "info");
          return;
        }
        
        const backupList = backups.map(b => 
          `${b.date.toLocaleString()} - ${b.productCount} ürün`
        ).join("\n");
        
        alert(`Otomatik Yedekler:\n\n${backupList}`);
      } else {
        showToast("Yedekleme özelliği kullanılamıyor", "warning");
      }
    } catch (error) {
      logger.error("View backups error:", error);
      showToast("❌ Yedekler yüklenemedi", "error");
    }
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
        enablePriceAlerts: $("enablePriceAlerts")?.checked !== false,
        enablePicker: $("enablePicker")?.checked || false,
        verboseLogging: $("verboseLogging")?.checked || false,
        cacheDuration: parseInt($("cacheDuration")?.value) || 300,
        autoBackup: $("autoBackup")?.checked !== false,
        autoBackupInterval: parseInt($("autoBackupInterval")?.value) || 24,
        theme: $("themePreference")?.value || "auto",
      };

      // Send to background using Messenger
      await Messenger.Actions.updateSettings(newSettings);

      settings = newSettings;
      
      // Apply theme immediately
      applyTheme(newSettings.theme);

      showToast("✅ Ayarlar kaydedildi!", "success");
      logToConsole("Ayarlar başarıyla kaydedildi", "success");

      logger.success("Settings saved:", newSettings);

      // Don't auto-close - let user continue using settings page
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
   * View logs - Shows log history modal
   */
  async function viewLogs() {
    try {
      const result = await browser.storage.local.get("debugLogHistory");
      const logHistory = result.debugLogHistory || [];

      let modal = $("logHistoryModal");
      if (!modal) {
        modal = document.createElement("div");
        modal.id = "logHistoryModal";
        modal.className = "log-history-modal";
        modal.innerHTML = `
          <div class="log-history-overlay"></div>
          <div class="log-history-content">
            <div class="log-history-header">
              <h3>📋 Log Geçmişi</h3>
              <div class="log-history-actions">
                <button class="btn btn-secondary btn-sm" id="exportLogHistoryBtn">Dışa Aktar</button>
                <button class="btn btn-danger btn-sm" id="clearLogHistoryBtn">Temizle</button>
                <button class="btn-icon" id="closeLogHistoryBtn">✕</button>
              </div>
            </div>
            <div class="log-history-stats">
              <span class="badge info" id="logHistoryCount">0</span> kayıt - Son 7 gün
            </div>
            <div class="log-history-list" id="logHistoryList"></div>
          </div>
        `;
        document.body.appendChild(modal);
        addLogHistoryStyles();
        
        // Event listeners
        modal.querySelector(".log-history-overlay").onclick = () => modal.classList.remove("show");
        $("closeLogHistoryBtn").onclick = () => modal.classList.remove("show");
        $("exportLogHistoryBtn").onclick = exportLogHistory;
        $("clearLogHistoryBtn").onclick = clearLogHistory;
      }

      renderLogHistory(logHistory);
      modal.classList.add("show");
      logToConsole("Log geçmişi açıldı", "info");
    } catch (error) {
      console.error("Log history error:", error);
      showToast("Log geçmişi yüklenemedi", "error");
    }
  }

  function addLogHistoryStyles() {
    if ($("logHistoryStyles")) return;
    const style = document.createElement("style");
    style.id = "logHistoryStyles";
    style.textContent = `
      .log-history-modal { display: none; position: fixed; inset: 0; z-index: 1000; }
      .log-history-modal.show { display: block; }
      .log-history-overlay { position: absolute; inset: 0; background: rgba(0,0,0,0.5); }
      .log-history-content { position: absolute; top: 50%; left: 50%; transform: translate(-50%,-50%); width: 90%; max-width: 800px; max-height: 80vh; background: var(--md-sys-color-surface, #fff); border-radius: 24px; box-shadow: 0 8px 32px rgba(0,0,0,0.3); display: flex; flex-direction: column; }
      .log-history-header { display: flex; justify-content: space-between; align-items: center; padding: 20px 24px; border-bottom: 1px solid var(--md-sys-color-outline-variant, #e0e0e0); }
      .log-history-header h3 { margin: 0; font-size: 20px; }
      .log-history-actions { display: flex; gap: 8px; }
      .log-history-stats { padding: 12px 24px; background: var(--md-sys-color-surface-container-low, #f5f5f5); }
      .log-history-list { flex: 1; overflow-y: auto; padding: 16px 24px; max-height: 400px; }
      .log-history-day { margin-bottom: 20px; }
      .log-history-day-header { font-weight: 600; color: var(--md-sys-color-primary, #6750A4); margin-bottom: 8px; padding-bottom: 8px; border-bottom: 1px solid var(--md-sys-color-outline-variant, #e0e0e0); }
      .log-history-item { display: flex; gap: 12px; padding: 8px; border-radius: 8px; margin-bottom: 4px; font-family: monospace; font-size: 12px; }
      .log-history-item:hover { background: var(--md-sys-color-surface-container-low, #f5f5f5); }
      .log-history-item.info { border-left: 3px solid #6750A4; }
      .log-history-item.success { border-left: 3px solid #1B8755; }
      .log-history-item.warning { border-left: 3px solid #7C5800; }
      .log-history-item.error { border-left: 3px solid #B3261E; }
      .log-history-time { color: #888; min-width: 70px; }
      .log-history-level { padding: 2px 6px; border-radius: 4px; font-size: 10px; font-weight: 600; min-width: 50px; text-align: center; }
      .log-history-level.info { background: #E8DEF8; color: #1D192B; }
      .log-history-level.success { background: #D1FAE5; color: #065F46; }
      .log-history-level.warning { background: #FEF3C7; color: #92400E; }
      .log-history-level.error { background: #FEE2E2; color: #991B1B; }
      .log-history-message { flex: 1; word-break: break-word; }
      .log-history-empty { text-align: center; padding: 40px; color: #888; }
    `;
    document.head.appendChild(style);
  }

  function renderLogHistory(logs) {
    const list = $("logHistoryList");
    $("logHistoryCount").textContent = logs.length;

    if (logs.length === 0) {
      list.innerHTML = '<div class="log-history-empty"><div style="font-size:48px;margin-bottom:12px">📭</div><div>Henüz log kaydı yok</div></div>';
      return;
    }

    const grouped = {};
    logs.forEach(log => {
      const day = new Date(log.timestamp).toLocaleDateString("tr-TR", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
      if (!grouped[day]) grouped[day] = [];
      grouped[day].push(log);
    });

    list.innerHTML = Object.entries(grouped).reverse().map(([day, dayLogs]) => `
      <div class="log-history-day">
        <div class="log-history-day-header">${day}</div>
        ${dayLogs.reverse().map(log => `
          <div class="log-history-item ${log.type}">
            <span class="log-history-time">${new Date(log.timestamp).toLocaleTimeString("tr-TR")}</span>
            <span class="log-history-level ${log.type}">${log.type.toUpperCase()}</span>
            <span class="log-history-message">${PriceTrackerHelpers.escapeHtml(log.message)}</span>
          </div>
        `).join("")}
      </div>
    `).join("");
  }

  async function exportLogHistory() {
    const result = await browser.storage.local.get("debugLogHistory");
    const logs = result.debugLogHistory || [];
    const blob = new Blob([JSON.stringify({ exportDate: new Date().toISOString(), logs }, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `log-history-${Date.now()}.json`;
    a.click();
    showToast(`${logs.length} log dışa aktarıldı`, "success");
  }

  async function clearLogHistory() {
    if (confirm("Tüm log geçmişi silinecek?")) {
      await browser.storage.local.set({ debugLogHistory: [] });
      renderLogHistory([]);
      showToast("Log geçmişi temizlendi", "success");
    }
  }

  /**
   * Reset settings to defaults
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

  // Debug log storage for filtering
  let debugLogs = [];
  let currentLogFilter = "all";

  /**
   * Log to console with M3 styling
   */
  function logToConsole(message, type = "info") {
    const output = $("consoleOutput");
    if (!output) return;

    const time = new Date().toLocaleTimeString("tr-TR", { 
      hour: "2-digit", 
      minute: "2-digit", 
      second: "2-digit" 
    });
    
    const logEntry = { time, message, type, timestamp: Date.now() };
    debugLogs.push(logEntry);

    // Keep max 100 logs in memory
    if (debugLogs.length > 100) {
      debugLogs = debugLogs.slice(-100);
    }

    // Save to persistent storage for history
    saveLogToHistory(message, type);

    renderConsoleLogs();
    updateLogCount();
  }

  /**
   * Save log to persistent history storage
   */
  async function saveLogToHistory(message, type) {
    try {
      const result = await browser.storage.local.get("debugLogHistory");
      let logHistory = result.debugLogHistory || [];
      
      logHistory.push({ timestamp: Date.now(), type, message });

      // Keep only last 7 days
      const sevenDaysAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
      logHistory = logHistory.filter(log => log.timestamp > sevenDaysAgo);

      // Keep max 500 logs
      if (logHistory.length > 500) {
        logHistory = logHistory.slice(-500);
      }

      await browser.storage.local.set({ debugLogHistory: logHistory });
    } catch (e) {
      console.debug("Save log history error:", e);
    }
  }

  /**
   * Render console logs with current filter
   */
  function renderConsoleLogs() {
    const output = $("consoleOutput");
    if (!output) return;

    const filtered = currentLogFilter === "all" 
      ? debugLogs 
      : debugLogs.filter(log => log.type === currentLogFilter);

    if (filtered.length === 0) {
      output.innerHTML = `
        <div class="debug-log-entry log-info">
          <span class="debug-log-timestamp">--:--:--</span>
          <span class="debug-log-level info">INFO</span>
          <span class="debug-log-message">Log bulunamadı</span>
        </div>
      `;
      return;
    }

    output.innerHTML = filtered.map(log => `
      <div class="debug-log-entry log-${log.type}">
        <span class="debug-log-timestamp">${log.time}</span>
        <span class="debug-log-level ${log.type}">${log.type.toUpperCase()}</span>
        <span class="debug-log-message">${PriceTrackerHelpers.escapeHtml(log.message)}</span>
      </div>
    `).join("");

    output.scrollTop = output.scrollHeight;
  }

  /**
   * Filter console logs
   */
  function filterConsoleLogs(filter) {
    currentLogFilter = filter;
    renderConsoleLogs();
  }

  /**
   * Update log count badge
   */
  function updateLogCount() {
    const badge = $("logCount");
    if (badge) {
      badge.textContent = debugLogs.length;
    }
  }

  /**
   * Clear console
   */
  function clearConsole() {
    debugLogs = [];
    currentLogFilter = "all";
    
    // Reset segmented buttons
    $$("#logFilter .segmented-btn").forEach((btn, i) => {
      btn.classList.toggle("selected", i === 0);
    });

    logToConsole("Console temizlendi", "info");
    showToast("Console temizlendi", "success");
  }

  /**
   * Copy logs to clipboard
   */
  function copyLogsToClipboard() {
    const text = debugLogs.map(log => 
      `[${log.time}] [${log.type.toUpperCase()}] ${log.message}`
    ).join("\n");

    navigator.clipboard.writeText(text).then(() => {
      showToast("Loglar panoya kopyalandı", "success");
    }).catch(() => {
      showToast("Kopyalama başarısız", "error");
    });
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
