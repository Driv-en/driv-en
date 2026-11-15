/**
 * translate.js — DRIV-EN Content Translation (v2)
 *
 * Two translation modes:
 *
 * 1. UI Auto-Translation (data-i18n attribute)
 *    - For static UI text (labels, buttons, headings, nav items)
 *    - Auto-translates on page load if UI language ≠ English
 *    - Text is replaced in-place; original stored in data-original-text
 *    - Uses POST /api/translate/batch for efficiency (one API call for all UI strings)
 *    - Client-side localStorage cache for instant subsequent loads
 *
 * 2. Content Translation (data-translate attribute) — unchanged from v1
 *    - For user-generated content (notes, descriptions)
 *    - Adds "🌐 Translate" button, shows translation in overlay below
 *    - On-demand, per-element
 *
 * Usage in HTML:
 *   UI text:     <span data-i18n>Overview</span>
 *   Content:     <p data-translate data-entity-type="work_order" data-entity-id="123">Note text</p>
 *
 * Load after dashboard-common.js:
 *   <script src="/app/shared/translate.js?v=3"></script>
 */

(function() {
  'use strict';

  var DRIVEN_TRANSLATE = window.DRIVEN_TRANSLATE || {};

  // -- Style injection --
  var styleId = 'driven-translate-styles';
  if (!document.getElementById(styleId)) {
    var style = document.createElement('style');
    style.id = styleId;
    style.textContent = [
      '.driven-translate-btn {',
      '  display: inline-flex; align-items: center; gap: 4px;',
      '  padding: 3px 10px; margin: 4px 0 4px 4px;',
      '  border: 1px solid var(--primary, #0284c7); border-radius: 5px;',
      '  background: var(--bg-card, #fff); color: var(--primary, #0284c7);',
      '  cursor: pointer; font-size: 12px; font-weight: 600;',
      '  transition: background 150ms ease, color 150ms ease;',
      '  vertical-align: middle;',
      '}',
      '.driven-translate-btn:hover { background: var(--primary, #0284c7); color: #fff; }',
      '.driven-translate-btn:disabled { opacity: 0.5; cursor: wait; }',
      '.driven-translate-btn.translated { background: #16a34a; border-color: #15803d; color: #fff; }',
      '',
      '.driven-translate-overlay {',
      '  margin-top: 6px; padding: 8px 12px;',
      '  border-left: 3px solid #16a34a; background: var(--bg-step, #f1f5f9);',
      '  border-radius: 0 6px 6px 0; font-size: 14px; color: var(--text, #0f172a);',
      '  display: none;',
      '}',
      '.driven-translate-overlay.visible { display: block; }',
      '.driven-translate-overlay .translation-label {',
      '  font-size: 11px; font-weight: 700; color: #16a34a; text-transform: uppercase;',
      '  letter-spacing: 0.5px; margin-bottom: 4px;',
      '}',
      '',
      '.driven-translate-lang-select {',
      '  padding: 2px 6px; border: 1px solid var(--border, #cbd5e1); border-radius: 4px;',
      '  background: var(--bg-card, #fff); color: var(--text, #0f172a); font-size: 12px;',
      '  margin-left: 6px;',
      '}',
      '',
      '/* Language toggle for login page */',
      '.driven-lang-toggle {',
      '  display: flex; align-items: center; justify-content: center; gap: 8px;',
      '  margin: 0 auto 20px auto; max-width: 200px;',
      '}',
      '.driven-lang-toggle select {',
      '  padding: 6px 12px; border: 1px solid #cbd5e1; border-radius: 6px;',
      '  font-size: 14px; font-weight: 600; cursor: pointer; background: #fff; color: #1e293b;',
      '  outline: none;',
      '}',
      '.driven-lang-toggle select:focus { border-color: #2563eb; box-shadow: 0 0 0 2px rgba(37,99,235,0.15); }',
      '.driven-lang-toggle-label { font-size: 13px; color: #64748b; font-weight: 600; }',
    ].join('\n');
    document.head.appendChild(style);
  }

  // ===== UI Language (for auto-translating interface text) =====

  function getUILang() {
    try {
      var saved = localStorage.getItem('driven-ui-lang');
      if (saved) return saved;
    } catch (e) {}
    return 'en';
  }

  function setUILang(lang) {
    try { localStorage.setItem('driven-ui-lang', lang); } catch (e) {}
  }

  // ===== Content Translation Language =====
  // Now unified with UI language — the translate button translates content
  // INTO the viewer's UI language. If content is already in that language,
  // no button is shown.

  function getTargetLang() {
    return getUILang();
  }

  // ===== localStorage cache for UI translations =====

  function getUICacheKey(lang) {
    return 'driven-ui-translations-' + lang;
  }

  function getCachedUITranslations(lang) {
    try {
      var raw = localStorage.getItem(getUICacheKey(lang));
      if (raw) return JSON.parse(raw);
    } catch (e) {}
    return {};
  }

  function saveCachedUITranslations(lang, map) {
    try {
      localStorage.setItem(getUICacheKey(lang), JSON.stringify(map));
    } catch (e) {}
  }

  function addCachedUITranslation(lang, source, translated) {
    var cache = getCachedUITranslations(lang);
    cache[source] = translated;
    saveCachedUITranslations(lang, cache);
  }

  // ===== Auto-Translate UI =====

  // Selector for elements that are always UI text (auto-scanned on every page).
  // data-i18n = explicit manual tag; the rest are common HTML/DRIV-EN UI element
  // types that are safe to auto-translate. Use data-no-translate to exclude.
  var UI_TEXT_SELECTOR = [
    '[data-i18n]:not([data-no-translate])',
    // Generic HTML elements that are almost always UI text
    'h1:not([data-no-translate])',
    'h2:not([data-no-translate])',
    'h3:not([data-no-translate])',
    'h4:not([data-no-translate])',
    'h5:not([data-no-translate])',
    'h6:not([data-no-translate])',
    'th:not([data-no-translate])',
    'label:not([data-no-translate])',
    'legend:not([data-no-translate])',
    'option:not([data-no-translate])',
    'button:not([data-no-translate])',
    // Modal content — paragraphs, list items, strong/em inside modals
    '.modal-body p:not([data-no-translate])',
    '.modal-body li:not([data-no-translate])',
    '.modal-body strong:not([data-no-translate])',
    '.modal-body em:not([data-no-translate])',
    '.modal-content p:not([data-no-translate])',
    '.modal-content li:not([data-no-translate])',
    // DRIV-EN dashboard UI classes
    '.admin-tab:not([data-no-translate])',
    '.admin-subtab:not([data-no-translate])',
    '.admin-tab-logout:not([data-no-translate])',
    '.modal-title:not([data-no-translate])',
    '.stat-card h3:not([data-no-translate])',
    '.dash-links-card h3:not([data-no-translate])',
    '.settings-section h3:not([data-no-translate])',
    '.step-toggle-name:not([data-no-translate])',
    '.step-toggle-desc:not([data-no-translate])',
    '.welcome-detail-label:not([data-no-translate])',
    '.dash-theme-label:not([data-no-translate])',
    '.welcome-uom-label:not([data-no-translate])',
    '.btn-save:not([data-no-translate])',
    '.login-button:not([data-no-translate])',
    '.no-account-line:not([data-no-translate])',
    '.no-account-line-2:not([data-no-translate])',
    '.action-col-2:not([data-no-translate])',
    '.progress-text:not([data-no-translate])',
    '.pill-btn:not([data-no-translate])',
    '#welcome-name:not([data-no-translate])',
    '.driven-lang-toggle-label:not([data-no-translate])',
    '.emp-form-card > div:not([data-no-translate])',
    '.welcome-uom-hint:not([data-no-translate])',
    '.um-subtitle:not([data-no-translate])',
    '.form-links-grid .emp-form-card > div:not([data-no-translate])',
    // Common form/page UI classes
    '.form-label:not([data-no-translate])',
    '.form-section-title:not([data-no-translate])',
    '.section-title:not([data-no-translate])',
    '.page-title:not([data-no-translate])',
    '.card-title:not([data-no-translate])',
    '.nav-item:not([data-no-translate])',
    '.tab-label:not([data-no-translate])',
    '.info-label:not([data-no-translate])',
    '.field-label:not([data-no-translate])',
    '.btn:not([data-no-translate])',
    '.toast-message:not([data-no-translate])',
    '.alert:not([data-no-translate])',
    '.banner-text:not([data-no-translate])',
    '.empty-state:not([data-no-translate])',
  ].join(', ');

  var uiTranslateInProgress = false;
  var uiTranslatePending = false;

  // Wrap bare text nodes in <span data-i18n> so they can be selected and translated
  function wrapBareTextNodes(root) {
    if (!root || !root.querySelector) return;
    // Process the entire document — catches all modal types, dynamic content,
    // AJAX-injected panels, etc. The TreeWalker only visits text nodes (fast),
    // and we skip any text node whose ancestor matches the selector (already translated).
    var containers = [root];
    // Also check for modal containers that may have been added dynamically
    var modalContainers = root.querySelectorAll('[class*="modal-body"], [class*="modal-content"], [class*="modal-card"], [class*="modal-dialog"]');
    for (var m = 0; m < modalContainers.length; m++) {
      containers.push(modalContainers[m]);
    }

    for (var c = 0; c < containers.length; c++) {
      var container = containers[c];
      var walker = document.createTreeWalker(
        container,
        NodeFilter.SHOW_TEXT,
        null,
        false
      );

      var textNodes = [];
      while (walker.nextNode()) {
        var node = walker.currentNode;
        var text = node.textContent.trim();
        if (!text) continue;
        // Skip if parent already matches the selector (will be translated as part of parent)
        var parent = node.parentElement;
        if (!parent) continue;
        // Skip if parent is <script> or <style>
        var tag = parent.tagName.toLowerCase();
        if (tag === 'script' || tag === 'style') continue;
        // Skip if parent or ancestor matches the selector AND has no matching descendants
        // (if the ancestor has matching descendants, it will be skipped by autoTranslateUI,
        // so we must wrap the bare text node to translate it)
        var ancestor = parent;
        var skip = false;
        while (ancestor && ancestor !== container) {
          if (ancestor.matches && ancestor.matches(UI_TEXT_SELECTOR)) {
            if (!ancestor.querySelector(UI_TEXT_SELECTOR)) {
              // No matching descendants — this ancestor will be translated as a whole
              skip = true;
              break;
            }
            // Has matching descendants — ancestor will be skipped, continue checking up
          }
          ancestor = ancestor.parentElement;
        }
        if (skip) continue;
        // Skip if already wrapped
        if (parent.tagName === 'SPAN' && parent.hasAttribute('data-i18n')) continue;
        textNodes.push(node);
      }

      for (var t = 0; t < textNodes.length; t++) {
        var textNode = textNodes[t];
        var span = document.createElement('span');
        span.setAttribute('data-i18n', '');
        textNode.parentNode.insertBefore(span, textNode);
        span.appendChild(textNode);
      }
    }
  }

  async function autoTranslateUI(optLang) {
    var lang = optLang || getUILang();

    // If English, restore originals (if previously translated)
    if (lang === 'en') {
      restoreUIOriginals();
      return;
    }

    // If a translation is already in progress, mark pending and return
    if (uiTranslateInProgress) {
      uiTranslatePending = true;
      return;
    }

    uiTranslateInProgress = true;

    try {
      // Wrap bare text nodes in <span data-i18n> so they can be selected and translated
      wrapBareTextNodes(document.body);

      var elements = document.querySelectorAll(UI_TEXT_SELECTOR);
      if (elements.length === 0) return;

      // Collect unique text strings, track which elements need which text
      var textToElements = {}; // "original text" -> [element, element, ...]
      var allTexts = [];

      for (var i = 0; i < elements.length; i++) {
        var el = elements[i];
        // Skip elements inside translate button containers
        if (el.classList && el.classList.contains('driven-translate-btn')) continue;
        // Skip elements already handled by content translation (data-translate)
        if (el.hasAttribute('data-translate')) continue;
        // Skip elements that have descendants matching the selector
        // (e.g. <li> containing <strong> — translate children individually, not the parent)
        if (el.querySelector(UI_TEXT_SELECTOR)) continue;

        // Get original text (from data-original-text if already translated, else current text)
        var text = el.getAttribute('data-original-text');
        if (!text) {
          text = (el.textContent || '').trim();
          if (!text || text.length < 1) continue;
          // Skip pure numbers, dates, currency, or very short codes
          if (/^[\d\s$,.\/\-+%°]+$/.test(text)) continue;
          el.setAttribute('data-original-text', text);
        }

        if (!textToElements[text]) {
          textToElements[text] = [];
          allTexts.push(text);
        }
        textToElements[text].push(el);
      }

      if (allTexts.length === 0) return;

      // Check localStorage cache first
      var localCache = getCachedUITranslations(lang);
      var cached = {};
      var uncached = [];

      allTexts.forEach(function(text) {
        if (localCache[text]) {
          cached[text] = localCache[text];
        } else {
          uncached.push(text);
        }
      });

      // Apply cached translations immediately
      Object.keys(cached).forEach(function(text) {
        var els = textToElements[text];
        for (var j = 0; j < els.length; j++) {
          els[j].textContent = cached[text];
        }
      });

      // Fetch uncached from API
      if (uncached.length > 0) {
        try {
          var resp = await fetch('/api/translate/batch', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({
              items: uncached,
              source_lang: 'en',
              target_lang: lang,
            }),
          });

          if (resp && resp.ok) {
            var data = await resp.json();
            if (data.success && data.results) {
              data.results.forEach(function(r) {
                if (r.translated && r.translated !== r.source) {
                  cached[r.source] = r.translated;
                  addCachedUITranslation(lang, r.source, r.translated);
                  var els = textToElements[r.source];
                  if (els) {
                    for (var k = 0; k < els.length; k++) {
                      els[k].textContent = r.translated;
                    }
                  }
                }
              });
            }
          }
        } catch (apiErr) {
          console.warn('[Translate] Batch API error:', apiErr.message);
          // Fall back to individual translations if batch fails
          await translateUIIndividually(uncached, textToElements, lang, cached);
        }
      }
    } catch (e) {
      console.error('[Translate] autoTranslateUI error:', e.message);
    } finally {
      uiTranslateInProgress = false;
      // If another translate was requested while we were busy, run again
      if (uiTranslatePending) {
        uiTranslatePending = false;
        setTimeout(function() { autoTranslateUI(lang); }, 100);
      }
    }
  }

  // Fallback: translate texts one by one if batch endpoint unavailable
  async function translateUIIndividually(texts, textToElements, lang, cached) {
    for (var i = 0; i < texts.length; i++) {
      var text = texts[i];
      try {
        var resp = await fetch('/api/translate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            text: text,
            source_lang: 'en',
            target_lang: lang,
            entity_type: 'ui',
            entity_id: 'ui',
            field_name: 'ui',
          }),
        });
        if (resp && resp.ok) {
          var data = await resp.json();
          if (data.success && data.translated_text) {
            cached[text] = data.translated_text;
            addCachedUITranslation(lang, text, data.translated_text);
            var els = textToElements[text];
            if (els) {
              for (var j = 0; j < els.length; j++) {
                els[j].textContent = data.translated_text;
              }
            }
          }
        }
      } catch (e) {
        console.warn('[Translate] Individual UI translation failed for "' + text.substring(0, 30) + '":', e.message);
      }
    }
  }

  // Restore original UI text (when switching back to English)
  function restoreUIOriginals() {
    var elements = document.querySelectorAll(UI_TEXT_SELECTOR + ', [data-original-text]');
    var seen = {};
    for (var i = 0; i < elements.length; i++) {
      if (seen[i]) continue;
      seen[i] = true;
      var original = elements[i].getAttribute('data-original-text');
      if (original) elements[i].textContent = original;
    }
  }

  // ===== Content Translation (on-demand, per-element) — from v1 =====

  async function translate(targetEl, opts) {
    if (!targetEl) return;

    var originalText = targetEl.getAttribute('data-original-text') ||
                       targetEl.textContent || targetEl.innerText || '';
    targetEl.setAttribute('data-original-text', originalText.trim());

    var targetTypeLang = (opts && opts.target_lang) || getTargetLang();
    var sourceLang = (opts && opts.source_lang) || targetEl.getAttribute('data-content-lang') || 'en';
    var entityType = (opts && opts.entity_type) || targetEl.getAttribute('data-entity-type') || '';
    var entityId = (opts && opts.entity_id) || targetEl.getAttribute('data-entity-id') || '';
    var fieldName = (opts && opts.field_name) || targetEl.getAttribute('data-field-name') || '';

    // Check if already translated (toggle off)
    var overlay = targetEl.nextElementSibling;
    if (overlay && overlay.classList.contains('driven-translate-overlay') && overlay.classList.contains('visible')) {
      overlay.classList.remove('visible');
      var btn = targetEl.parentNode.querySelector('.driven-translate-btn');
      if (btn) { btn.classList.remove('translated'); btn.innerHTML = '&#x1F310; Translate'; }
      return;
    }

    // Show loading state
    var btn = targetEl.parentNode.querySelector('.driven-translate-btn');
    if (btn) { btn.disabled = true; btn.innerHTML = '&#x23F3; Translating...'; }

    try {
      var resp = await fetch('/api/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
      body: JSON.stringify({
        text: originalText.trim(),
        source_lang: sourceLang,
        target_lang: targetTypeLang,
        entity_type: entityType,
        entity_id: entityId,
        field_name: fieldName,
      }),
      });

      var data = await resp.json();

      if (!data.success) {
        throw new Error(data.error || 'Translation failed');
      }

      // Create or update overlay
      if (!overlay || !overlay.classList.contains('driven-translate-overlay')) {
        overlay = document.createElement('div');
        overlay.className = 'driven-translate-overlay';
        targetEl.parentNode.insertBefore(overlay, targetEl.nextSibling);
      }

      var langNames = {
        es: 'Spanish', fr: 'French', de: 'German', pt: 'Portuguese', it: 'Italian',
        nl: 'Dutch', ru: 'Russian', ar: 'Arabic', zh: 'Chinese', ja: 'Japanese',
        ko: 'Korean', hi: 'Hindi', tr: 'Turkish', pl: 'Polish', vi: 'Vietnamese',
        th: 'Thai', id: 'Indonesian', sv: 'Swedish', el: 'Greek', he: 'Hebrew',
      };

      overlay.innerHTML =
        '<div class="translation-label">Translation (' + (langNames[targetTypeLang] || targetTypeLang) + ')</div>' +
        '<div>' + escHtml(data.translated_text) + '</div>';
      overlay.classList.add('visible');

      if (btn) {
        btn.classList.add('translated');
        btn.disabled = false;
        btn.innerHTML = '&#x2715; Hide Translation';
      }
    } catch (e) {
      console.error('[Translate] Error:', e.message);
      if (btn) { btn.disabled = false; btn.innerHTML = '&#x26A0; Retry'; }
      alert('Translation failed: ' + e.message);
    }
  }

  // -- HTML escape --
  function escHtml(text) {
    var div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  // -- Add translate button to a content element --
  function addTranslateButton(targetEl) {
    if (targetEl.dataset.translateAdded) return;
    targetEl.dataset.translateAdded = '1';

    var text = (targetEl.textContent || '').trim();
    if (!text || text.length < 2) return; // skip empty or very short text

    // Check if content is already in the viewer's language — if so, no button needed
    var contentLang = targetEl.getAttribute('data-content-lang') || 'en'; // default to en for legacy content
    var viewerLang = getUILang();
    if (contentLang === viewerLang) return; // same language, no translation needed

    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'driven-translate-btn';
    btn.innerHTML = '&#x1F310; Translate';
    btn.setAttribute('aria-label', 'Translate text');

    btn.addEventListener('click', function(e) {
      e.preventDefault();
      translate(targetEl);
    });

    // Insert button before the target element
    if (targetEl.parentNode) {
      targetEl.parentNode.insertBefore(btn, targetEl);
    }
  }

  // -- DOM Auto-Init: scan for [data-translate] elements (content translation buttons) --
  function init() {
    var elements = document.querySelectorAll('[data-translate]');
    for (var i = 0; i < elements.length; i++) {
      addTranslateButton(elements[i]);
    }

    // Auto-translate UI if language is not English
    var uiLang = getUILang();
    if (uiLang !== 'en') {
      autoTranslateUI(uiLang);
    }
  }

  // -- Expose global --
  window.DRIVEN_TRANSLATE = {
    translate: translate,
    addTranslateButton: addTranslateButton,
    init: init,
    getTargetLang: getTargetLang,
    getUILang: getUILang,
    setUILang: setUILang,
    autoTranslateUI: autoTranslateUI,
    restoreUIOriginals: restoreUIOriginals,
  };

  // -- Auto-init --
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // Re-init after dashSessionLoaded
  document.addEventListener('dashSessionLoaded', function() {
    setTimeout(init, 200);
    setTimeout(function() {
      var uiLang = getUILang();
      if (uiLang !== 'en') autoTranslateUI(uiLang);
    }, 500);
  });

  // -- MutationObserver: auto-translate dynamically added content (modals, AJAX, etc.) --
  var retranslateTimer = null;
  var observer = new MutationObserver(function(mutations) {
    var uiLang = getUILang();
    if (uiLang === 'en') return; // no translation needed

    var hasNewElements = false;
    for (var i = 0; i < mutations.length; i++) {
      var added = mutations[i].addedNodes;
      for (var j = 0; j < added.length; j++) {
        var node = added[j];
        if (node.nodeType === 1 && !node.dataset && !node.getAttribute) continue;
        if (node.nodeType === 1) {
          // Skip translate buttons and overlays
          if (node.classList && (node.classList.contains('driven-translate-btn') || node.classList.contains('driven-translate-overlay'))) continue;
          hasNewElements = true;
          break;
        }
      }
      if (hasNewElements) break;
    }

    if (hasNewElements) {
      clearTimeout(retranslateTimer);
      retranslateTimer = setTimeout(function() { autoTranslateUI(uiLang); }, 300);
    }
  });

  function startObserver() {
    if (document.body) {
      observer.observe(document.body, { childList: true, subtree: true });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', startObserver);
  } else {
    startObserver();
  }

})();
