// Standalone Element Picker for Firefox Extension
// Based on uBlock Origin's element picker - fully independent version
// NO uBlock dependencies, pure WebExtension APIs

(function () {
  "use strict";

  // Prevent multiple instances
  if (window.__ELEMENT_PICKER_ACTIVE__) {
    console.log("[ElementPicker] Already active");
    return;
  }
  window.__ELEMENT_PICKER_ACTIVE__ = true;

  const browser = window.browser || window.chrome;

  // Picker state
  const pickerState = {
    currentElement: null,
    highlightedElement: null,
    overlay: null,
    tooltip: null,
    dialog: null,
    candidates: [],
    currentCandidateIndex: 0,
    isDialogMode: false,
    mouseX: 0,
    mouseY: 0,
  };

  // ===== DOM TRAVERSAL & SELECTOR GENERATION =====

  /**
   * Generate unique CSS selector for element
   */
  function generateSelector(elem) {
    if (!elem || elem === document || elem === document.documentElement) {
      return null;
    }

    // Try ID first
    if (elem.id && /^[a-z]/i.test(elem.id)) {
      const idSelector = `#${CSS.escape(elem.id)}`;
      if (document.querySelectorAll(idSelector).length === 1) {
        return idSelector;
      }
    }

    // Try data attributes
    const dataAttrs = ["data-testid", "data-test", "data-id", "data-price"];
    for (const attr of dataAttrs) {
      const val = elem.getAttribute(attr);
      if (val) {
        const selector = `[${attr}="${CSS.escape(val)}"]`;
        if (document.querySelectorAll(selector).length === 1) {
          return selector;
        }
      }
    }

    // Build path with classes
    const path = [];
    let current = elem;
    let depth = 0;
    const maxDepth = 5;

    while (current && current !== document.body && depth < maxDepth) {
      let part = current.tagName.toLowerCase();

      // Add classes (filter out dynamic/random ones)
      if (current.classList && current.classList.length > 0) {
        const validClasses = Array.from(current.classList)
          .filter(
            (cls) => cls.length < 30 && !/^(js-|x\d+|[a-f0-9]{8})/.test(cls)
          )
          .slice(0, 2);

        if (validClasses.length > 0) {
          part += "." + validClasses.map((c) => CSS.escape(c)).join(".");
        }
      }

      // Add nth-child if needed for uniqueness
      const parent = current.parentElement;
      if (parent) {
        const siblings = Array.from(parent.children);
        const sameTag = siblings.filter((s) => s.tagName === current.tagName);
        if (sameTag.length > 1) {
          const index = siblings.indexOf(current) + 1;
          part += `:nth-child(${index})`;
        }
      }

      path.unshift(part);

      // Check if current path is unique
      const testSelector = path.join(" > ");
      if (document.querySelectorAll(testSelector).length === 1) {
        return testSelector;
      }

      current = current.parentElement;
      depth++;
    }

    return path.join(" > ");
  }

  /**
   * Generate candidate selectors (from specific to general)
   */
  function generateCandidates(elem) {
    const candidates = [];
    const seen = new Set();

    // Add element selector
    const elemSelector = generateSelector(elem);
    if (elemSelector && !seen.has(elemSelector)) {
      candidates.push({
        selector: elemSelector,
        description: "Element",
        count: document.querySelectorAll(elemSelector).length,
      });
      seen.add(elemSelector);
    }

    // Add parent selectors (generalization)
    let current = elem.parentElement;
    let depth = 0;
    while (current && current !== document.body && depth < 3) {
      const parentSelector = generateSelector(current);
      if (parentSelector && !seen.has(parentSelector)) {
        candidates.push({
          selector: parentSelector,
          description: `Parent ${depth + 1}`,
          count: document.querySelectorAll(parentSelector).length,
        });
        seen.add(parentSelector);
      }
      current = current.parentElement;
      depth++;
    }

    // Add class-based selectors
    if (elem.classList && elem.classList.length > 0) {
      elem.classList.forEach((cls) => {
        if (cls.length < 30) {
          const clsSelector = `.${CSS.escape(cls)}`;
          if (!seen.has(clsSelector)) {
            candidates.push({
              selector: clsSelector,
              description: "By class",
              count: document.querySelectorAll(clsSelector).length,
            });
            seen.add(clsSelector);
          }
        }
      });
    }

    // Add attribute-based selectors
    const attrs = ["data-testid", "data-test", "data-id", "role", "aria-label"];
    attrs.forEach((attr) => {
      const val = elem.getAttribute(attr);
      if (val) {
        const attrSelector = `[${attr}="${CSS.escape(val)}"]`;
        if (!seen.has(attrSelector)) {
          candidates.push({
            selector: attrSelector,
            description: `By ${attr}`,
            count: document.querySelectorAll(attrSelector).length,
          });
          seen.add(attrSelector);
        }
      }
    });

    return candidates;
  }

  /**
   * Check if element is in Shadow DOM
   */
  function isInShadowDOM(elem) {
    let root = elem.getRootNode();
    return root instanceof ShadowRoot;
  }

  // ===== UI CREATION =====

  /**
   * Inject styles
   */
  function injectStyles() {
    if (document.getElementById("element-picker-styles")) return;

    const style = document.createElement("style");
    style.id = "element-picker-styles";
    style.textContent = `
      #element-picker-overlay {
        position: fixed !important;
        top: 0 !important;
        left: 0 !important;
        right: 0 !important;
        bottom: 0 !important;
        background: rgba(0, 0, 0, 0.3) !important;
        backdrop-filter: blur(2px) !important;
        z-index: 2147483646 !important;
        cursor: crosshair !important;
      }

      .element-picker-highlight {
        outline: 3px solid #3b82f6 !important;
        outline-offset: 2px !important;
        background: rgba(59, 130, 246, 0.1) !important;
        cursor: pointer !important;
        z-index: 2147483645 !important;
      }

      #element-picker-tooltip {
        position: fixed !important;
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%) !important;
        color: white !important;
        padding: 8px 12px !important;
        border-radius: 8px !important;
        font: 12px -apple-system, system-ui, sans-serif !important;
        font-weight: 600 !important;
        z-index: 2147483647 !important;
        pointer-events: none !important;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3) !important;
        max-width: 300px !important;
        white-space: nowrap !important;
        overflow: hidden !important;
        text-overflow: ellipsis !important;
      }

      #element-picker-hint {
        position: fixed !important;
        top: 20px !important;
        left: 50% !important;
        transform: translateX(-50%) !important;
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%) !important;
        color: white !important;
        padding: 12px 24px !important;
        border-radius: 10px !important;
        font: 14px -apple-system, system-ui, sans-serif !important;
        font-weight: 700 !important;
        z-index: 2147483647 !important;
        box-shadow: 0 8px 24px rgba(0, 0, 0, 0.3) !important;
        animation: slideDown 0.3s ease !important;
      }

      @keyframes slideDown {
        from { opacity: 0; transform: translateX(-50%) translateY(-20px); }
        to { opacity: 1; transform: translateX(-50%) translateY(0); }
      }

      #element-picker-dialog {
        position: fixed !important;
        top: 50% !important;
        left: 50% !important;
        transform: translate(-50%, -50%) !important;
        background: white !important;
        padding: 24px !important;
        border-radius: 16px !important;
        box-shadow: 0 30px 90px rgba(0, 0, 0, 0.5) !important;
        z-index: 2147483647 !important;
        min-width: 500px !important;
        max-width: 700px !important;
        font-family: -apple-system, system-ui, sans-serif !important;
        color: #111827 !important;
        animation: dialogIn 0.2s ease !important;
      }

      @keyframes dialogIn {
        from { opacity: 0; transform: translate(-50%, -50%) scale(0.95); }
        to { opacity: 1; transform: translate(-50%, -50%) scale(1); }
      }

      #element-picker-dialog h2 {
        margin: 0 0 16px 0 !important;
        font-size: 20px !important;
        font-weight: 800 !important;
        color: #111827 !important;
      }

      #element-picker-dialog .section {
        margin-bottom: 20px !important;
      }

      #element-picker-dialog .section-title {
        font-size: 12px !important;
        font-weight: 700 !important;
        color: #6b7280 !important;
        text-transform: uppercase !important;
        margin-bottom: 8px !important;
        letter-spacing: 0.5px !important;
      }

      #element-picker-dialog .selector-list {
        display: flex !important;
        flex-direction: column !important;
        gap: 8px !important;
        max-height: 300px !important;
        overflow-y: auto !important;
      }

      #element-picker-dialog .selector-item {
        padding: 12px !important;
        background: #f9fafb !important;
        border: 2px solid #e5e7eb !important;
        border-radius: 8px !important;
        cursor: pointer !important;
        transition: all 0.2s !important;
        display: flex !important;
        justify-content: space-between !important;
        align-items: center !important;
      }

      #element-picker-dialog .selector-item:hover {
        border-color: #6366f1 !important;
        background: #eef2ff !important;
      }

      #element-picker-dialog .selector-item.active {
        border-color: #6366f1 !important;
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%) !important;
        color: white !important;
      }

      #element-picker-dialog .selector-text {
        flex: 1 !important;
        font-family: 'Monaco', 'Menlo', monospace !important;
        font-size: 12px !important;
        overflow: hidden !important;
        text-overflow: ellipsis !important;
      }

      #element-picker-dialog .selector-count {
        font-size: 11px !important;
        font-weight: 700 !important;
        padding: 4px 8px !important;
        background: rgba(0, 0, 0, 0.1) !important;
        border-radius: 6px !important;
        margin-left: 12px !important;
      }

      #element-picker-dialog .selector-item.active .selector-count {
        background: rgba(255, 255, 255, 0.3) !important;
      }

      #element-picker-dialog .buttons {
        display: grid !important;
        grid-template-columns: 1fr 1fr !important;
        gap: 12px !important;
        margin-top: 20px !important;
      }

      #element-picker-dialog button {
        padding: 12px 20px !important;
        border: none !important;
        border-radius: 10px !important;
        font-size: 14px !important;
        font-weight: 700 !important;
        cursor: pointer !important;
        transition: all 0.2s !important;
        font-family: inherit !important;
      }

      #element-picker-dialog .btn-cancel {
        background: #e5e7eb !important;
        color: #374151 !important;
      }

      #element-picker-dialog .btn-cancel:hover {
        background: #d1d5db !important;
        transform: translateY(-2px) !important;
      }

      #element-picker-dialog .btn-confirm {
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%) !important;
        color: white !important;
      }

      #element-picker-dialog .btn-confirm:hover {
        transform: translateY(-2px) !important;
        box-shadow: 0 8px 24px rgba(102, 126, 234, 0.4) !important;
      }

      #element-picker-dialog .preview-info {
        padding: 12px !important;
        background: #fef3c7 !important;
        border: 2px solid #fbbf24 !important;
        border-radius: 8px !important;
        font-size: 13px !important;
        color: #78350f !important;
        margin-bottom: 16px !important;
      }
    `;
    document.head.appendChild(style);
  }

  /**
   * Create overlay
   */
  function createOverlay() {
    const overlay = document.createElement("div");
    overlay.id = "element-picker-overlay";
    document.body.appendChild(overlay);
    return overlay;
  }

  /**
   * Create tooltip
   */
  function createTooltip() {
    const tooltip = document.createElement("div");
    tooltip.id = "element-picker-tooltip";
    tooltip.style.display = "none";
    document.body.appendChild(tooltip);
    return tooltip;
  }

  /**
   * Create hint
   */
  function createHint() {
    const hint = document.createElement("div");
    hint.id = "element-picker-hint";
    hint.textContent =
      "Click element to select • ESC to cancel • Arrow keys to cycle";
    document.body.appendChild(hint);

    setTimeout(() => {
      hint.style.transition = "all 0.3s ease";
      hint.style.opacity = "0";
      hint.style.transform = "translateX(-50%) translateY(-20px)";
      setTimeout(() => hint.remove(), 300);
    }, 4000);
  }

  /**
   * Create dialog for selector selection
   */
  function createDialog(candidates) {
    const dialog = document.createElement("div");
    dialog.id = "element-picker-dialog";

    const html = `
      <h2>🎯 Select Element Matcher</h2>
      <div class="preview-info">
        Selected: <strong>${candidates[0].count}</strong> element(s) will match
      </div>
      <div class="section">
        <div class="section-title">Choose Selector (from specific to general)</div>
        <div class="selector-list">
          ${candidates
            .map(
              (cand, idx) => `
            <div class="selector-item ${
              idx === 0 ? "active" : ""
            }" data-index="${idx}">
              <div class="selector-text" title="${cand.selector}">
                ${cand.selector}
              </div>
              <div class="selector-count">${cand.count}</div>
            </div>
          `
            )
            .join("")}
        </div>
      </div>
      <div class="buttons">
        <button class="btn-cancel" id="picker-cancel">✕ Cancel</button>
        <button class="btn-confirm" id="picker-confirm">✓ Confirm</button>
      </div>
    `;

    dialog.innerHTML = html;
    document.body.appendChild(dialog);

    return dialog;
  }

  // ===== EVENT HANDLERS =====

  /**
   * Mouse move handler
   */
  function onMouseMove(e) {
    if (pickerState.isDialogMode) return;

    const target = e.target;
    if (
      target === pickerState.overlay ||
      target === pickerState.tooltip ||
      target.id === "element-picker-hint"
    ) {
      return;
    }

    // Remove previous highlight
    if (
      pickerState.highlightedElement &&
      pickerState.highlightedElement !== target
    ) {
      pickerState.highlightedElement.classList.remove(
        "element-picker-highlight"
      );
    }

    // Add new highlight
    pickerState.highlightedElement = target;
    target.classList.add("element-picker-highlight");

    // Update tooltip
    const tagName = target.tagName.toLowerCase();
    const classStr = target.className
      ? `.${Array.from(target.classList).join(".")}`
      : "";
    const idStr = target.id ? `#${target.id}` : "";

    pickerState.tooltip.textContent = `${tagName}${idStr}${classStr}`;
    pickerState.tooltip.style.display = "block";
    pickerState.tooltip.style.left = e.clientX + 15 + "px";
    pickerState.tooltip.style.top = e.clientY + 15 + "px";

    // Keep tooltip in viewport
    requestAnimationFrame(() => {
      const rect = pickerState.tooltip.getBoundingClientRect();
      if (rect.right > window.innerWidth) {
        pickerState.tooltip.style.left = e.clientX - rect.width - 15 + "px";
      }
      if (rect.bottom > window.innerHeight) {
        pickerState.tooltip.style.top = e.clientY - rect.height - 15 + "px";
      }
    });

    pickerState.mouseX = e.clientX;
    pickerState.mouseY = e.clientY;
  }

  /**
   * Click handler
   */
  function onClick(e) {
    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();

    if (pickerState.isDialogMode) return;

    const target = e.target;
    if (
      target === pickerState.overlay ||
      target === pickerState.tooltip ||
      target.id === "element-picker-hint"
    ) {
      return;
    }

    // Element selected
    pickerState.currentElement = target;
    console.log("[ElementPicker] Element selected:", target);

    // Remove highlight
    if (pickerState.highlightedElement) {
      pickerState.highlightedElement.classList.remove(
        "element-picker-highlight"
      );
    }

    // Hide tooltip
    pickerState.tooltip.style.display = "none";

    // Generate candidates
    pickerState.candidates = generateCandidates(target);
    pickerState.currentCandidateIndex = 0;

    console.log("[ElementPicker] Candidates:", pickerState.candidates);

    // Show dialog
    showDialog();
  }

  /**
   * Keyboard handler
   */
  function onKeyDown(e) {
    if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      cleanup();
    } else if (pickerState.isDialogMode) {
      if (e.key === "ArrowUp" || e.key === "ArrowDown") {
        e.preventDefault();
        cycleCandidate(e.key === "ArrowUp" ? -1 : 1);
      } else if (e.key === "Enter") {
        e.preventDefault();
        confirmSelection();
      }
    }
  }

  /**
   * Show dialog
   */
  function showDialog() {
    pickerState.isDialogMode = true;
    pickerState.overlay.style.cursor = "default";

    // Create dialog
    pickerState.dialog = createDialog(pickerState.candidates);

    // Attach selector item listeners
    const items = pickerState.dialog.querySelectorAll(".selector-item");
    items.forEach((item, idx) => {
      item.addEventListener("click", () => {
        selectCandidate(idx);
      });
    });

    // Attach button listeners
    pickerState.dialog
      .querySelector("#picker-cancel")
      .addEventListener("click", () => {
        pickerState.dialog.remove();
        pickerState.isDialogMode = false;
        pickerState.overlay.style.cursor = "crosshair";

        // Re-highlight element
        if (pickerState.currentElement) {
          pickerState.highlightedElement = pickerState.currentElement;
          pickerState.currentElement.classList.add("element-picker-highlight");
        }
      });

    pickerState.dialog
      .querySelector("#picker-confirm")
      .addEventListener("click", confirmSelection);

    // Preview selection
    previewSelection(0);
  }

  /**
   * Select candidate
   */
  function selectCandidate(index) {
    pickerState.currentCandidateIndex = index;

    // Update UI
    const items = pickerState.dialog.querySelectorAll(".selector-item");
    items.forEach((item, idx) => {
      item.classList.toggle("active", idx === index);
    });

    // Preview
    previewSelection(index);

    // Update info
    const info = pickerState.dialog.querySelector(".preview-info");
    info.innerHTML = `Selected: <strong>${pickerState.candidates[index].count}</strong> element(s) will match`;
  }

  /**
   * Cycle through candidates
   */
  function cycleCandidate(direction) {
    const newIndex = pickerState.currentCandidateIndex + direction;
    if (newIndex >= 0 && newIndex < pickerState.candidates.length) {
      selectCandidate(newIndex);
    }
  }

  /**
   * Preview selection by highlighting all matches
   */
  function previewSelection(index) {
    // Remove all previous preview highlights
    document.querySelectorAll(".element-picker-highlight").forEach((el) => {
      el.classList.remove("element-picker-highlight");
    });

    // Highlight all matching elements
    const selector = pickerState.candidates[index].selector;
    try {
      const matches = document.querySelectorAll(selector);
      matches.forEach((el) => {
        el.classList.add("element-picker-highlight");
      });
    } catch (err) {
      console.error("[ElementPicker] Invalid selector:", selector, err);
    }
  }

  /**
   * Confirm selection
   */
  async function confirmSelection() {
    const candidate = pickerState.candidates[pickerState.currentCandidateIndex];

    console.log("[ElementPicker] Confirmed selector:", candidate.selector);

    // Send message to background
    try {
      await browser.runtime.sendMessage({
        type: "price-element-selected",
        selector: candidate.selector,
        url: window.location.href,
        hostname: window.location.hostname,
        count: candidate.count,
        description: candidate.description,
      });

      console.log("[ElementPicker] Message sent to background");
    } catch (err) {
      console.error("[ElementPicker] Failed to send message:", err);
    }

    // Show success
    pickerState.dialog.innerHTML = `
      <h2>✅ Selector Saved!</h2>
      <div class="preview-info">
        Selector: <code>${candidate.selector}</code><br>
        Matches: <strong>${candidate.count}</strong> element(s)
      </div>
    `;

    setTimeout(() => {
      cleanup();
    }, 2000);
  }

  /**
   * Cleanup and remove picker
   */
  function cleanup() {
    console.log("[ElementPicker] Cleaning up...");

    // Remove event listeners
    document.removeEventListener("mousemove", onMouseMove, true);
    document.removeEventListener("click", onClick, true);
    document.removeEventListener("keydown", onKeyDown, true);

    // Remove highlights
    document.querySelectorAll(".element-picker-highlight").forEach((el) => {
      el.classList.remove("element-picker-highlight");
    });

    // Remove DOM elements
    pickerState.overlay?.remove();
    pickerState.tooltip?.remove();
    pickerState.dialog?.remove();
    document.getElementById("element-picker-hint")?.remove();
    document.getElementById("element-picker-styles")?.remove();

    window.__ELEMENT_PICKER_ACTIVE__ = false;
    console.log("[ElementPicker] Cleanup complete");
  }

  // ===== INITIALIZATION =====

  function init() {
    console.log("[ElementPicker] Initializing...");

    // Inject styles
    injectStyles();

    // Create UI elements
    pickerState.overlay = createOverlay();
    pickerState.tooltip = createTooltip();
    createHint();

    // Attach event listeners
    document.addEventListener("mousemove", onMouseMove, true);
    document.addEventListener("click", onClick, true);
    document.addEventListener("keydown", onKeyDown, true);

    console.log("[ElementPicker] Ready!");
  }

  // Start
  init();
})();
