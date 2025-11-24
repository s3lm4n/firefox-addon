// Manual Price Picker v2.0 - FIXED VERSION
(async () => {
  "use strict";

  // Prevent multiple instances
  if (window.__PRICE_PICKER_ACTIVE__) {
    console.log("[Picker] Already active, skipping");
    return;
  }
  window.__PRICE_PICKER_ACTIVE__ = true;

  const browser = window.browser || window.chrome;
  const domain = location.hostname.replace(/^www\./, "");

  // Constants for selector generation
  const DATA_ATTRIBUTES = ["data-testid", "data-test-id", "data-price", "data-product-id"];
  const MAX_CLASS_LENGTH = 30;
  const CLASS_EXCLUDE_PATTERN = /^(x\d+|css-|_)/;
  const MAX_SELECTOR_DEPTH = 5;

  let selectedElement = null;
  let currentHighlight = null;
  let overlay = null;
  let tooltip = null;
  let panel = null;
  let hint = null;

  console.log("[Picker] 🎯 Initializing manual price picker...");

  // Check for saved selector
  try {
    const data = await browser.storage.sync.get(domain);
    const saved = data[domain];
    if (saved?.selector) {
      const el = document.querySelector(saved.selector);
      if (el?.textContent.trim()) {
        console.log("[Picker] ✅ Found saved selector, using it");
        const text = el.textContent.trim();
        const price = extractPrice(text);

        browser.runtime.sendMessage({
          action: "manualPriceSelected",
          data: { text, price, url: location.href, selector: saved.selector },
        });

        showSuccessMessage(`Otomatik fiyat bulundu: ${text}`);
        setTimeout(() => (window.__PRICE_PICKER_ACTIVE__ = false), 2000);
        return;
      }
    }
  } catch (e) {
    console.log("[Picker] No saved selector, starting manual mode");
  }

  // Inject styles
  const style = document.createElement("style");
  style.id = "price-picker-styles";
  style.textContent = `
    .price-picker-overlay {
      position: fixed !important;
      top: 0 !important;
      left: 0 !important;
      right: 0 !important;
      bottom: 0 !important;
      background: rgba(0, 0, 0, 0.4) !important;
      backdrop-filter: blur(3px) !important;
      z-index: 2147483646 !important;
      cursor: crosshair !important;
    }
    
    .price-picker-highlight {
      outline: 4px solid #6366f1 !important;
      outline-offset: 2px !important;
      background: rgba(99, 102, 241, 0.15) !important;
      position: relative !important;
      cursor: pointer !important;
      z-index: 2147483645 !important;
    }
    
    .price-picker-tooltip {
      position: fixed !important;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%) !important;
      color: white !important;
      padding: 12px 16px !important;
      border-radius: 12px !important;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif !important;
      font-size: 13px !important;
      font-weight: 600 !important;
      z-index: 2147483647 !important;
      pointer-events: none !important;
      box-shadow: 0 8px 24px rgba(0, 0, 0, 0.3) !important;
      max-width: 300px !important;
      word-break: break-word !important;
    }
    
    .price-picker-hint {
      position: fixed !important;
      top: 20px !important;
      left: 50% !important;
      transform: translateX(-50%) !important;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%) !important;
      color: white !important;
      padding: 16px 32px !important;
      border-radius: 12px !important;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif !important;
      font-size: 15px !important;
      font-weight: 600 !important;
      z-index: 2147483647 !important;
      box-shadow: 0 8px 24px rgba(0, 0, 0, 0.3) !important;
      animation: slideDown 0.4s ease !important;
    }
    
    @keyframes slideDown {
      from {
        opacity: 0;
        transform: translateX(-50%) translateY(-20px);
      }
      to {
        opacity: 1;
        transform: translateX(-50%) translateY(0);
      }
    }
    
    .price-picker-panel {
      position: fixed !important;
      top: 50% !important;
      left: 50% !important;
      transform: translate(-50%, -50%) !important;
      background: white !important;
      padding: 32px !important;
      border-radius: 20px !important;
      box-shadow: 0 30px 90px rgba(0, 0, 0, 0.5) !important;
      z-index: 2147483647 !important;
      min-width: 450px !important;
      max-width: 600px !important;
      text-align: center !important;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif !important;
      animation: panelIn 0.3s ease !important;
    }
    
    @keyframes panelIn {
      from {
        opacity: 0;
        transform: translate(-50%, -50%) scale(0.9);
      }
      to {
        opacity: 1;
        transform: translate(-50%, -50%) scale(1);
      }
    }
    
    .price-picker-panel h2 {
      margin: 0 0 16px 0 !important;
      color: #1f2937 !important;
      font-size: 24px !important;
      font-weight: 700 !important;
    }
    
    .price-picker-panel p {
      margin: 0 0 24px 0 !important;
      color: #6b7280 !important;
      font-size: 16px !important;
      line-height: 1.5 !important;
    }
    
    .price-picker-info {
      background: #f9fafb !important;
      padding: 20px !important;
      border-radius: 12px !important;
      margin-bottom: 24px !important;
      text-align: left !important;
    }
    
    .price-picker-info-row {
      display: flex !important;
      justify-content: space-between !important;
      padding: 10px 0 !important;
      border-bottom: 1px solid #e5e7eb !important;
    }
    
    .price-picker-info-row:last-child {
      border-bottom: none !important;
    }
    
    .price-picker-info-label {
      font-weight: 600 !important;
      color: #6b7280 !important;
      font-size: 14px !important;
    }
    
    .price-picker-info-value {
      font-weight: 700 !important;
      color: #111827 !important;
      font-size: 14px !important;
      max-width: 300px !important;
      overflow: hidden !important;
      text-overflow: ellipsis !important;
      white-space: nowrap !important;
    }
    
    .price-picker-buttons {
      display: grid !important;
      grid-template-columns: 1fr 1fr !important;
      gap: 12px !important;
    }
    
    .price-picker-btn {
      padding: 14px 24px !important;
      border: none !important;
      border-radius: 10px !important;
      font-size: 14px !important;
      font-weight: 700 !important;
      cursor: pointer !important;
      transition: all 0.2s !important;
      font-family: inherit !important;
    }
    
    .price-picker-btn-cancel {
      background: #e5e7eb !important;
      color: #374151 !important;
    }
    
    .price-picker-btn-cancel:hover {
      background: #d1d5db !important;
      transform: translateY(-2px) !important;
    }
    
    .price-picker-btn-confirm {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%) !important;
      color: white !important;
    }
    
    .price-picker-btn-confirm:hover {
      transform: translateY(-2px) !important;
      box-shadow: 0 8px 24px rgba(102, 126, 234, 0.4) !important;
    }
  `;
  document.head.appendChild(style);

  // Create overlay
  overlay = document.createElement("div");
  overlay.className = "price-picker-overlay";
  document.body.appendChild(overlay);

  // Create tooltip
  tooltip = document.createElement("div");
  tooltip.className = "price-picker-tooltip";
  tooltip.style.display = "none";
  document.body.appendChild(tooltip);

  // Create hint
  hint = document.createElement("div");
  hint.className = "price-picker-hint";
  hint.textContent = "🎯 Fiyat içeren öğeyi seçin • ESC ile iptal";
  document.body.appendChild(hint);
  setTimeout(() => {
    if (hint) {
      hint.style.opacity = "0";
      hint.style.transform = "translateX(-50%) translateY(-20px)";
      setTimeout(() => {
        if (hint) {
          hint.remove();
          hint = null;
        }
      }, 300);
    }
  }, 4000);

  console.log("[Picker] ✅ UI elements created");

  // Escape HTML to prevent XSS
  function escapeHtml(text) {
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
  }

  // Extract price from text
  function extractPrice(text) {
    const match = text.match(/[\d.,]+/);
    return match ? match[0].replace(/[.,]/g, "") : null;
  }

  // Generate CSS selector
  function generateSelector(element) {
    if (!element) return null;

    try {
      // Priority 1: ID (only if unique)
      if (element.id && /^[a-zA-Z][\w-]*$/.test(element.id)) {
        try {
          const selector = `#${CSS.escape(element.id)}`;
          if (document.querySelectorAll(selector).length === 1) {
            return selector;
          }
        } catch (e) {
          console.warn("[Picker] ID selector failed:", e);
        }
      }

      // Priority 2: data-* attributes
      for (const attr of DATA_ATTRIBUTES) {
        const val = element.getAttribute(attr);
        if (val) {
          try {
            const selector = `[${attr}="${CSS.escape(val)}"]`;
            if (document.querySelectorAll(selector).length === 1) {
              return selector;
            }
          } catch (e) {
            console.warn("[Picker] Data attribute selector failed:", e);
          }
        }
      }

      // Priority 3: itemprop
      const itemprop = element.getAttribute("itemprop");
      if (itemprop === "price" || itemprop === "offers") {
        try {
          const selector = `[itemprop="${itemprop}"]`;
          const matches = document.querySelectorAll(selector);
          if (matches.length === 1) return selector;
        } catch (e) {
          console.warn("[Picker] Itemprop selector failed:", e);
        }
      }

      // Priority 4: Build path with classes
      const path = [];
      let current = element;
      let depth = 0;

      while (current && current !== document.body && depth < MAX_SELECTOR_DEPTH) {
        let selector = current.tagName.toLowerCase();

        if (current.id && /^[a-zA-Z][\w-]*$/.test(current.id)) {
          try {
            path.unshift(`#${CSS.escape(current.id)}`);
            break;
          } catch (e) {
            console.warn("[Picker] Path ID escape failed:", e);
          }
        }

        if (current.classList && current.classList.length > 0) {
          const classes = Array.from(current.classList)
            .filter((c) => c && c.length < MAX_CLASS_LENGTH && !CLASS_EXCLUDE_PATTERN.test(c))
            .slice(0, 2);

          if (classes.length > 0) {
            try {
              selector += "." + classes.map(c => CSS.escape(c)).join(".");
            } catch (e) {
              console.warn("[Picker] Class escape failed:", e);
            }
          }
        }

        // Add nth-child for better specificity if needed
        if (current.parentElement) {
          const siblings = Array.from(current.parentElement.children);
          const index = siblings.indexOf(current);
          if (siblings.length > 1 && index >= 0) {
            selector += `:nth-child(${index + 1})`;
          }
        }

        path.unshift(selector);
        current = current.parentElement;
        depth++;
      }

      const finalSelector = path.join(" > ");
      
      // Validate selector works
      try {
        const matches = document.querySelectorAll(finalSelector);
        if (matches.length === 1 && matches[0] === element) {
          return finalSelector;
        }
      } catch (e) {
        console.warn("[Picker] Final selector validation failed:", e);
      }

      return finalSelector;
    } catch (error) {
      console.error("[Picker] ❌ Selector generation failed:", error);
      return element.tagName.toLowerCase();
    }
  }

  // Mouse move handler
  function handleMouseMove(e) {
    // Don't highlight overlay or tooltip
    const target = e.target;
    if (target === overlay || target === tooltip || target === hint) {
      return;
    }

    // Remove previous highlight
    if (currentHighlight && currentHighlight !== target) {
      currentHighlight.classList.remove("price-picker-highlight");
    }

    // Add new highlight
    currentHighlight = target;
    currentHighlight.classList.add("price-picker-highlight");

    // Update tooltip
    const text = target.textContent.trim();
    const preview = text.substring(0, 80) + (text.length > 80 ? "..." : "");

    tooltip.textContent = preview;
    tooltip.style.display = "block";
    tooltip.style.left = e.clientX + 15 + "px";
    tooltip.style.top = e.clientY + 15 + "px";

    // Keep tooltip in viewport
    setTimeout(() => {
      const rect = tooltip.getBoundingClientRect();
      if (rect.right > window.innerWidth) {
        tooltip.style.left = e.clientX - rect.width - 15 + "px";
      }
      if (rect.bottom > window.innerHeight) {
        tooltip.style.top = e.clientY - rect.height - 15 + "px";
      }
    }, 0);
  }

  // Click handler
  function handleClick(e) {
    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();

    if (e.target === overlay || e.target === tooltip || e.target === hint) {
      return;
    }

    selectedElement = e.target;
    console.log("[Picker] Element selected:", selectedElement);

    // Remove highlights
    document.querySelectorAll(".price-picker-highlight").forEach((el) => {
      el.classList.remove("price-picker-highlight");
    });

    // Hide tooltip
    if (tooltip) {
      tooltip.style.display = "none";
    }

    // Show confirmation panel
    showConfirmationPanel();
  }

  // Keyboard handler
  function handleKeyDown(e) {
    if (e.key === "Escape") {
      e.preventDefault();
      cleanup();
    }
  }

  // Show confirmation panel
  function showConfirmationPanel() {
    try {
      const text = selectedElement.textContent.trim();
      const selector = generateSelector(selectedElement);
      const price = extractPrice(text);

      console.log("[Picker] Generated selector:", selector);
      console.log("[Picker] Extracted text:", text);
      console.log("[Picker] Extracted price:", price);

      if (!selector) {
        console.error("[Picker] ❌ Failed to generate selector");
        showErrorMessage("Selector oluşturulamadı. Lütfen başka bir element seçin.");
        return;
      }

    panel = document.createElement("div");
    panel.className = "price-picker-panel";
    panel.innerHTML = `
      <h2>🎯 Öğe Seçildi</h2>
      <p>Bu öğeyi fiyat olarak kaydetmek istiyor musunuz?</p>
      
      <div class="price-picker-info">
        <div class="price-picker-info-row">
          <span class="price-picker-info-label">İçerik:</span>
          <span class="price-picker-info-value" title="${text}">${text.substring(
      0,
      50
    )}${text.length > 50 ? "..." : ""}</span>
        </div>
        <div class="price-picker-info-row">
          <span class="price-picker-info-label">Fiyat:</span>
          <span class="price-picker-info-value">${price || "Bulunamadı"}</span>
        </div>
        <div class="price-picker-info-row">
          <span class="price-picker-info-label">Tag:</span>
          <span class="price-picker-info-value">${selectedElement.tagName.toLowerCase()}</span>
        </div>
        <div class="price-picker-info-row">
          <span class="price-picker-info-label">Selector:</span>
          <span class="price-picker-info-value" title="${selector}">${selector.substring(
      0,
      40
    )}...</span>
        </div>
      </div>
      
      <div class="price-picker-buttons">
        <button class="price-picker-btn price-picker-btn-cancel" id="pickerCancel">
          ❌ İptal
        </button>
        <button class="price-picker-btn price-picker-btn-confirm" id="pickerConfirm">
          ✅ Onayla
        </button>
      </div>
    `;

    document.body.appendChild(panel);

    // Add event listeners
    document.getElementById("pickerCancel").addEventListener("click", () => {
      panel.remove();
      cleanup();
    });

    document
      .getElementById("pickerConfirm")
      .addEventListener("click", async () => {
        try {
          console.log("[Picker] Confirming selection...");

          // Save selector
          await browser.storage.sync.set({
            [domain]: {
              selector,
              exampleText: text,
              lastSaved: Date.now(),
            },
          });

          // Send message
          await browser.runtime.sendMessage({
            action: "manualPriceSelected",
            data: { text, price, url: location.href, selector },
          });

          console.log("[Picker] ✅ Selection confirmed and saved");

          // Show success
          panel.innerHTML = `
          <h2>✅ Başarılı!</h2>
          <p>Fiyat öğesi kaydedildi.<br>Bu site artık otomatik olarak fiyatı çekecek.</p>
        `;

          setTimeout(cleanup, 2000);
        } catch (error) {
          console.error("[Picker] ❌ Save failed:", error);
          const errorMsg = escapeHtml(error.message || "Bilinmeyen hata");
          panel.innerHTML = `
          <h2>❌ Hata</h2>
          <p>Kayıt sırasında hata oluştu.<br>${errorMsg}</p>
          <div class="price-picker-buttons">
            <button class="price-picker-btn price-picker-btn-cancel" id="pickerRetry">
              Kapat
            </button>
          </div>
        `;
          
          document.getElementById("pickerRetry").addEventListener("click", () => {
            panel.remove();
            // Don't call cleanup - allow user to try again
          });
        }
      });
    } catch (error) {
      console.error("[Picker] ❌ Panel creation failed:", error);
      showErrorMessage("Panel oluşturulurken hata oluştu.");
      cleanup();
    }
  }

  // Show success message
  function showSuccessMessage(message) {
    const success = document.createElement("div");
    success.className = "price-picker-panel";
    success.innerHTML = `
      <h2>✅ Başarılı!</h2>
      <p>${escapeHtml(message)}</p>
    `;
    document.body.appendChild(success);
    setTimeout(() => success.remove(), 2000);
  }

  // Show error message
  function showErrorMessage(message) {
    const error = document.createElement("div");
    error.className = "price-picker-panel";
    error.innerHTML = `
      <h2>❌ Hata</h2>
      <p>${escapeHtml(message)}</p>
      <div class="price-picker-buttons">
        <button class="price-picker-btn price-picker-btn-confirm" id="errorOk">
          Tamam
        </button>
      </div>
    `;
    document.body.appendChild(error);
    
    document.getElementById("errorOk").addEventListener("click", () => {
      error.remove();
    });
    
    setTimeout(() => error.remove(), 5000);
  }

  // Cleanup
  function cleanup() {
    console.log("[Picker] 🧹 Cleaning up...");

    try {
      // Remove event listeners
      if (overlay) {
        overlay.removeEventListener("mousemove", handleMouseMove);
        overlay.removeEventListener("click", handleClick);
      }
      document.removeEventListener("keydown", handleKeyDown);

      // Remove highlights
      document.querySelectorAll(".price-picker-highlight").forEach((el) => {
        el.classList.remove("price-picker-highlight");
      });

      // Remove elements
      overlay?.remove();
      tooltip?.remove();
      panel?.remove();
      hint?.remove();
      document.getElementById("price-picker-styles")?.remove();

      // Clear references to prevent memory leaks
      overlay = null;
      tooltip = null;
      panel = null;
      hint = null;
      currentHighlight = null;
      selectedElement = null;

      window.__PRICE_PICKER_ACTIVE__ = false;
      console.log("[Picker] ✅ Cleanup complete");
    } catch (error) {
      console.error("[Picker] ⚠️ Cleanup error:", error);
      window.__PRICE_PICKER_ACTIVE__ = false;
    }
  }

  // Attach event listeners
  overlay.addEventListener("mousemove", handleMouseMove, false);
  overlay.addEventListener("click", handleClick, true);
  document.addEventListener("keydown", handleKeyDown, true);

  console.log("[Picker] ✅ Event listeners attached, picker ready!");
})();
