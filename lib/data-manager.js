// Data Export/Import Manager v1.0
// Handles backup, restore, and data migration

const DataManager = (function () {
  "use strict";

  const EXPORT_VERSION = "2.1.0";

  /**
   * Export all extension data
   * @returns {Object} Exportable data object
   */
  async function exportAll() {
    try {
      const [products, settings, alerts, customSelectors, darkMode] = await Promise.all([
        browser.storage.local.get("trackedProducts"),
        browser.storage.local.get("settings"),
        browser.storage.local.get("priceAlerts"),
        browser.storage.sync.get(null), // Get all sync storage (custom selectors)
        browser.storage.local.get("darkMode"),
      ]);

      const exportData = {
        version: EXPORT_VERSION,
        exportDate: new Date().toISOString(),
        metadata: {
          productCount: (products.trackedProducts || []).length,
          alertCount: (alerts.priceAlerts || []).length,
          browserInfo: navigator.userAgent,
        },
        data: {
          products: products.trackedProducts || [],
          settings: settings.settings || {},
          alerts: alerts.priceAlerts || [],
          customSelectors: customSelectors || {},
          preferences: {
            darkMode: darkMode.darkMode || false,
          },
        },
      };

      return exportData;
    } catch (error) {
      console.error("[DataManager] Export error:", error);
      throw new Error("Veri dışa aktarma başarısız: " + error.message);
    }
  }

  /**
   * Download export as JSON file
   */
  async function downloadExport(filename = null) {
    const data = await exportAll();
    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: "application/json",
    });

    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename || `fiyat-takipci-backup-${formatDate(new Date())}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    return data;
  }

  /**
   * Import data from JSON
   * @param {Object|string} importData Data to import
   * @param {Object} options Import options
   */
  async function importData(importData, options = {}) {
    const { merge = false, skipSettings = false, skipProducts = false, skipAlerts = false } = options;

    try {
      // Parse if string
      const data = typeof importData === "string" ? JSON.parse(importData) : importData;

      // Validate structure
      if (!data.version || !data.data) {
        throw new Error("Geçersiz yedek dosyası formatı");
      }

      // Check version compatibility
      const [majorVersion] = data.version.split(".");
      if (parseInt(majorVersion) < 2) {
        // Migrate old format
        await migrateFromV1(data);
        return { success: true, migrated: true };
      }

      const results = {
        products: { imported: 0, skipped: 0 },
        alerts: { imported: 0, skipped: 0 },
        settings: false,
      };

      // Import products
      if (!skipProducts && data.data.products) {
        const existingProducts = merge
          ? (await browser.storage.local.get("trackedProducts")).trackedProducts || []
          : [];

        const newProducts = merge
          ? mergeProducts(existingProducts, data.data.products)
          : data.data.products;

        await browser.storage.local.set({ trackedProducts: newProducts });
        results.products.imported = newProducts.length;
        results.products.skipped = data.data.products.length - (newProducts.length - existingProducts.length);
      }

      // Import alerts
      if (!skipAlerts && data.data.alerts) {
        const existingAlerts = merge
          ? (await browser.storage.local.get("priceAlerts")).priceAlerts || []
          : [];

        const newAlerts = merge
          ? mergeAlerts(existingAlerts, data.data.alerts)
          : data.data.alerts;

        await browser.storage.local.set({ priceAlerts: newAlerts });
        results.alerts.imported = newAlerts.length;
      }

      // Import settings
      if (!skipSettings && data.data.settings) {
        await browser.storage.local.set({ settings: data.data.settings });
        results.settings = true;
      }

      // Import custom selectors
      if (data.data.customSelectors) {
        for (const [domain, selector] of Object.entries(data.data.customSelectors)) {
          if (domain && selector) {
            await browser.storage.sync.set({ [domain]: selector });
          }
        }
      }

      // Import preferences
      if (data.data.preferences) {
        if (data.data.preferences.darkMode !== undefined) {
          await browser.storage.local.set({ darkMode: data.data.preferences.darkMode });
        }
      }

      return { success: true, results };
    } catch (error) {
      console.error("[DataManager] Import error:", error);
      throw new Error("Veri içe aktarma başarısız: " + error.message);
    }
  }

  /**
   * Read file and import
   */
  async function importFromFile(file, options = {}) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();

      reader.onload = async (e) => {
        try {
          const result = await importData(e.target.result, options);
          resolve(result);
        } catch (error) {
          reject(error);
        }
      };

      reader.onerror = () => reject(new Error("Dosya okunamadı"));
      reader.readAsText(file);
    });
  }

  /**
   * Merge products without duplicates
   */
  function mergeProducts(existing, imported) {
    const urlMap = new Map(existing.map((p) => [p.url, p]));

    for (const product of imported) {
      if (!urlMap.has(product.url)) {
        urlMap.set(product.url, product);
      } else {
        // Merge price history
        const existingProduct = urlMap.get(product.url);
        if (product.priceHistory && existingProduct.priceHistory) {
          const historyMap = new Map(existingProduct.priceHistory.map((h) => [h.date, h]));
          for (const entry of product.priceHistory) {
            if (!historyMap.has(entry.date)) {
              existingProduct.priceHistory.push(entry);
            }
          }
          existingProduct.priceHistory.sort((a, b) => a.date - b.date);
        }
      }
    }

    return Array.from(urlMap.values());
  }

  /**
   * Merge alerts without duplicates
   */
  function mergeAlerts(existing, imported) {
    const idMap = new Map(existing.map((a) => [a.id, a]));

    for (const alert of imported) {
      // Check if same product/type alert exists
      const duplicate = existing.find(
        (a) => a.productUrl === alert.productUrl && a.type === alert.type
      );
      if (!duplicate) {
        // Generate new ID to avoid conflicts
        alert.id = `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        idMap.set(alert.id, alert);
      }
    }

    return Array.from(idMap.values());
  }

  /**
   * Migrate from v1 format
   */
  async function migrateFromV1(oldData) {
    // V1 format was simpler, just products array
    if (Array.isArray(oldData.products)) {
      const migratedProducts = oldData.products.map((p) => ({
        ...p,
        priceHistory: p.priceHistory || [],
        lastCheckStatus: p.lastCheckStatus || "unknown",
        confidence: p.confidence || 0.7,
      }));
      await browser.storage.local.set({ trackedProducts: migratedProducts });
    }

    if (oldData.settings) {
      await browser.storage.local.set({ settings: oldData.settings });
    }
  }

  /**
   * Clear all extension data
   */
  async function clearAll(options = {}) {
    const { keepSettings = false, keepProducts = false, keepAlerts = false } = options;

    try {
      if (!keepProducts) {
        await browser.storage.local.remove("trackedProducts");
      }
      if (!keepSettings) {
        await browser.storage.local.remove("settings");
      }
      if (!keepAlerts) {
        await browser.storage.local.remove("priceAlerts");
      }

      // Clear custom selectors from sync storage
      await browser.storage.sync.clear();

      return true;
    } catch (error) {
      console.error("[DataManager] Clear error:", error);
      throw new Error("Veri silme başarısız: " + error.message);
    }
  }

  /**
   * Get storage usage statistics
   */
  async function getStorageStats() {
    try {
      const local = await browser.storage.local.get(null);
      const sync = await browser.storage.sync.get(null);

      const localSize = new Blob([JSON.stringify(local)]).size;
      const syncSize = new Blob([JSON.stringify(sync)]).size;

      return {
        local: {
          size: localSize,
          sizeFormatted: formatBytes(localSize),
          keys: Object.keys(local).length,
        },
        sync: {
          size: syncSize,
          sizeFormatted: formatBytes(syncSize),
          keys: Object.keys(sync).length,
        },
        total: {
          size: localSize + syncSize,
          sizeFormatted: formatBytes(localSize + syncSize),
        },
      };
    } catch (error) {
      console.error("[DataManager] Stats error:", error);
      return null;
    }
  }

  /**
   * Format bytes to human readable
   */
  function formatBytes(bytes) {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  }

  /**
   * Format date for filename
   */
  function formatDate(date) {
    return date.toISOString().split("T")[0];
  }

  /**
   * Create automatic backup
   */
  async function createAutoBackup() {
    try {
      const data = await exportAll();
      const backupKey = `backup_${Date.now()}`;

      // Store in local storage (keep last 3 backups)
      const backups = (await browser.storage.local.get("autoBackups")).autoBackups || {};
      const backupKeys = Object.keys(backups).sort().reverse();

      // Remove old backups (keep last 3)
      while (backupKeys.length >= 3) {
        const oldKey = backupKeys.pop();
        delete backups[oldKey];
      }

      backups[backupKey] = data;
      await browser.storage.local.set({ autoBackups: backups });

      console.log("[DataManager] Auto backup created:", backupKey);
      return true;
    } catch (error) {
      console.error("[DataManager] Auto backup error:", error);
      return false;
    }
  }

  /**
   * Restore from auto backup
   */
  async function restoreFromAutoBackup(backupKey) {
    try {
      const backups = (await browser.storage.local.get("autoBackups")).autoBackups || {};
      const backup = backups[backupKey];

      if (!backup) {
        throw new Error("Yedek bulunamadı");
      }

      return await importData(backup);
    } catch (error) {
      console.error("[DataManager] Restore error:", error);
      throw error;
    }
  }

  /**
   * List available auto backups
   */
  async function listAutoBackups() {
    try {
      const backups = (await browser.storage.local.get("autoBackups")).autoBackups || {};
      return Object.entries(backups).map(([key, data]) => ({
        key,
        date: new Date(parseInt(key.split("_")[1])),
        productCount: data.metadata?.productCount || 0,
        alertCount: data.metadata?.alertCount || 0,
      }));
    } catch (error) {
      console.error("[DataManager] List backups error:", error);
      return [];
    }
  }

  // Public API
  return {
    EXPORT_VERSION,
    exportAll,
    downloadExport,
    importData,
    importFromFile,
    clearAll,
    getStorageStats,
    createAutoBackup,
    restoreFromAutoBackup,
    listAutoBackups,
    formatBytes,
  };
})();

// Export for browser extension
if (typeof window !== "undefined") {
  window.DataManager = DataManager;
}
