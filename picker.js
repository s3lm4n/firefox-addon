// content/picker.js - IMPROVED SELECTOR VERSION
(async () => {
  "use strict";

  // Firefox'ta inject edildiğinde browser undefined olur → chrome var
  const browser = window.browser || window.chrome;

  if (window.__SELO_PICKER_ACTIVE__) return;
  window.__SELO_PICKER_ACTIVE__ = true;

  const domain = location.hostname.replace(/^www\./, "");
  let selectedEl = null;
  let currentHighlight = null;

  // IMPROVED: Çok daha sağlam selector üret
  const getSelector = el => {
    if (!el) return null;
    
    // Priority 1: Unique ID
    if (el.id && /^[a-zA-Z][\w-]*$/.test(el.id)) {
      // Validate ID is unique
      if (document.querySelectorAll(`#${el.id}`).length === 1) {
        return `#${el.id}`;
      }
    }

    // Priority 2: data-* attributes (common in modern sites)
    const dataAttrs = ['data-testid', 'data-test-id', 'data-price', 'data-test'];
    for (const attr of dataAttrs) {
      const val = el.getAttribute(attr);
      if (val) {
        const selector = `[${attr}="${val}"]`;
        if (document.querySelectorAll(selector).length === 1) {
          return selector;
        }
      }
    }

    // Priority 3: itemprop (Schema.org microdata)
    const itemprop = el.getAttribute('itemprop');
    if (itemprop === 'price' || itemprop === 'offers') {
      const selector = `[itemprop="${itemprop}"]`;
      const matches = document.querySelectorAll(selector);
      if (matches.length === 1) {
        return selector;
      } else if (matches.length > 1) {
        // Add parent context
        return getContextualSelector(el);
      }
    }

    // Priority 4: Unique class combinations
    const uniqueClass = getUniqueClassSelector(el);
    if (uniqueClass) return uniqueClass;

    // Priority 5: Build optimized path
    return buildOptimizedPath(el);
  };

  // Get unique class selector
  const getUniqueClassSelector = (el) => {
    if (!el.classList || el.classList.length === 0) return null;
    
    const classes = Array.from(el.classList).filter(c => 
      c && 
      !/^(active|selected|hover|focus|hidden|show)$/i.test(c) && // Skip state classes
      !c.match(/^\d/) // Skip numeric-only classes
    );

    // Try different combinations
    for (let i = 1; i <= Math.min(classes.length, 3); i++) {
      for (let j = 0; j <= classes.length - i; j++) {
        const combo = classes.slice(j, j + i);
        const selector = el.tagName.toLowerCase() + '.' + combo.join('.');
        const matches = document.querySelectorAll(selector);
        
        if (matches.length === 1) {
          return selector;
        }
      }
    }

    return null;
  };

  // Build contextual selector with parent
  const getContextualSelector = (el) => {
    const parts = [];
    let current = el;
    let depth = 0;
    const maxDepth = 4;

    while (current && current !== document.body && depth < maxDepth) {
      let selector = current.tagName.toLowerCase();

      // Add ID if exists
      if (current.id && /^[a-zA-Z][\w-]*$/.test(current.id)) {
        parts.unshift(`#${current.id}`);
        break; // ID is unique enough
      }

      // Add meaningful classes (max 2)
      if (current.classList && current.classList.length > 0) {
        const classes = Array.from(current.classList)
          .filter(c => 
            c && 
            c.length < 30 && // Avoid generated classes
            !/^(x\d+|css-|MuiBox|makeStyles)/.test(c) && // Skip framework classes
            !/^(active|selected|hover)$/i.test(c) // Skip state classes
          )
          .slice(0, 2);
        
        if (classes.length > 0) {
          selector += '.' + classes.join('.');
        }
      }

      // Add data attributes
      const dataTestId = current.getAttribute('data-testid') || current.getAttribute('data-test-id');
      if (dataTestId) {
        selector += `[data-testid="${dataTestId}"]`;
      }

      parts.unshift(selector);
      current = current.parentElement;
      depth++;
    }

    const fullSelector = parts.join(' > ');
    
    // Validate selector
    try {
      if (document.querySelectorAll(fullSelector).length === 1) {
        return fullSelector;
      }
    } catch (e) {
      console.warn('Invalid selector generated:', fullSelector);
    }

    return buildOptimizedPath(el);
  };

  // Build optimized path (fallback)
  const buildOptimizedPath = (el) => {
    const path = [];
    let current = el;
    
    while (current && current !== document.body) {
      let selector = current.tagName.toLowerCase();
      
      // Add relevant attributes
      const classList = current.classList;
      if (classList && classList.length > 0) {
        // Get most specific classes (usually price-related)
        const relevantClasses = Array.from(classList)
          .filter(c => 
            /price|amount|cost|value|fiyat|tutar/i.test(c) || 
            (c.length > 2 && c.length < 20 && !/^[a-z]\d+$/.test(c))
          )
          .slice(0, 2);
        
        if (relevantClasses.length > 0) {
          selector += '.' + relevantClasses.join('.');
        }
      }

      // Add nth-of-type if needed
      const parent = current.parentElement;
      if (parent) {
        const siblings = Array.from(parent.children).filter(e => e.tagName === current.tagName);
        if (siblings.length > 1) {
          const index = siblings.indexOf(current) + 1;
          selector += `:nth-of-type(${index})`;
        }
      }

      path.unshift(selector);
      current = parent;

      // Stop at meaningful parent
      if (current && (current.id || current.getAttribute('data-testid'))) {
        let parentSelector = current.tagName.toLowerCase();
        if (current.id) {
          parentSelector = `#${current.id}`;
        } else if (current.getAttribute('data-testid')) {
          parentSelector += `[data-testid="${current.getAttribute('data-testid')}"]`;
        }
        path.unshift(parentSelector);
        break;
      }
    }

    return path.slice(-5).join(' > '); // Keep last 5 levels only
  };

  // Kayıtlı selector var mı?
  try {
    const data = await browser.storage.sync.get(domain);
    const saved = data[domain];
    if (saved?.selector) {
      const el = document.querySelector(saved.selector);
      if (el?.textContent.trim()) {
        const text = el.textContent.trim();
        const price = text.match(/[\d.,]+/)?.[0].replace(/[.,]/g, "") || null;
        browser.runtime.sendMessage({
          action: "manualPriceSelected",
          data: { text, price, url: location.href }
        });
        console.log("Otomatik fiyat bulundu:", text);
        return; // Picker açma
      }
    }
  } catch (e) { console.log("Storage okuma hatası, manuel devam:", e); }

  // ---------- MANUEL PICKER BAŞLAT ----------
  const style = document.createElement("style");
  style.textContent = `
    .selo-overlay{position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.4);backdrop-filter:blur(3px);z-index:2147483646;cursor:crosshair;}
    .selo-hl{outline:4px solid #6366f1 !important;background:rgba(99,102,241,0.2)!important;position:relative !important;}
    .selo-tip{position:fixed;background:#6366f1;color:#fff;padding:10px 16px;border-radius:10px;font:13px system-ui;z-index:2147483647;pointer-events:none;box-shadow:0 6px 20px rgba(0,0,0,0.4);max-width:300px;word-wrap:break-word;}
    .selo-hint{position:fixed;top:20px;left:50%;transform:translateX(-50%);background:#6366f1;color:#fff;padding:16px 32px;border-radius:12px;font:15px system-ui;z-index:2147483647;pointer-events:none;}
    .selo-panel{position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);background:#fff;padding:32px;border-radius:20px;box-shadow:0 30px 90px rgba(0,0,0,0.5);z-index:2147483647;min-width:450px;text-align:center;font-family:system-ui;}
    .selo-panel h2{margin:0 0 16px 0;color:#1f2937;font-size:24px;}
    .selo-panel p{margin:0;color:#6b7280;font-size:16px;line-height:1.5;}
  `;
  document.head.appendChild(style);

  const overlay = document.createElement("div");
  overlay.className = "selo-overlay";
  document.body.appendChild(overlay);

  const tooltip = document.createElement("div");
  tooltip.className = "selo-tip";
  document.body.appendChild(tooltip);

  const hint = document.createElement("div");
  hint.className = "selo-hint";
  hint.textContent = "Fiyat etiketini seç • ESC iptal";
  document.body.appendChild(hint);
  setTimeout(() => hint.remove(), 4000);

  const move = e => {
    tooltip.style.display = "none";
    const el = document.elementFromPoint(e.clientX, e.clientY);
    
    if (!el || el === overlay || el === tooltip || el === hint) {
      tooltip.style.display = "none";
      return;
    }
    
    if (currentHighlight && currentHighlight !== el) {
      currentHighlight.classList.remove("selo-hl");
    }
    
    currentHighlight = el;
    el.classList.add("selo-hl");
    
    const text = el.textContent.trim();
    tooltip.textContent = text.substring(0, 80) + (text.length > 80 ? "..." : "");
    tooltip.style.left = (e.clientX + 15) + "px";
    tooltip.style.top = (e.clientY + 15) + "px";
    tooltip.style.display = "block";
  };

  const click = async e => {
    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();
    
    tooltip.style.display = "none";
    const el = document.elementFromPoint(e.clientX, e.clientY);
    
    if (!el || el === overlay || el === tooltip || el === hint) return;

    selectedEl = el;
    document.querySelectorAll(".selo-hl").forEach(h => h.classList.remove("selo-hl"));

    const selector = getSelector(el);
    const text = el.textContent.trim();
    const price = text.match(/[\d.,]+/)?.[0].replace(/[.,]/g, "") || null;

    console.log("🎯 Generated selector:", selector);
    console.log("📝 Extracted text:", text);
    console.log("💰 Extracted price:", price);

    // Validate selector works
    try {
      const testEl = document.querySelector(selector);
      if (!testEl || testEl !== el) {
        console.warn("⚠️ Selector validation failed, regenerating...");
        selector = buildOptimizedPath(el);
      }
    } catch (err) {
      console.error("❌ Selector error:", err);
      selector = buildOptimizedPath(el);
    }

    // Kaydet
    await browser.storage.sync.set({ 
      [domain]: { 
        selector, 
        exampleText: text, 
        lastSaved: Date.now(),
        elementTag: el.tagName.toLowerCase(),
        hasPrice: !!price
      } 
    });

    // Gönder
    browser.runtime.sendMessage({
      action: "manualPriceSelected",
      data: { text, price, url: location.href, selector }
    });

    // Başarı
    const panel = document.createElement("div");
    panel.className = "selo-panel";
    panel.innerHTML = `
      <h2>✅ Tamamdır Selo!</h2>
      <p>Bu site artık otomatik çekecek.<br>Yenile ve gör.</p>
      <p style="margin-top:12px;font-size:12px;color:#9ca3af;">Selector: ${selector}</p>
    `;
    document.body.appendChild(panel);
    setTimeout(cleanup, 2500);
  };

  const cleanup = () => {
    overlay.removeEventListener("mousemove", move);
    overlay.removeEventListener("click", click, true);
    document.removeEventListener("keydown", esc);
    document.querySelectorAll(".selo-overlay,.selo-tip,.selo-hl,.selo-hint,.selo-panel").forEach(el => el?.remove());
    style.remove();
    window.__SELO_PICKER_ACTIVE__ = false;
  };

  const esc = e => e.key === "Escape" && cleanup();

  overlay.addEventListener("mousemove", move, false);
  overlay.addEventListener("click", click, true);
  document.addEventListener("keydown", esc);
})();