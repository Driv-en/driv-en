/**
 * translate.js — DRIV-EN Content Translation (v1)
 *
 * Uses Workers AI m2m100-1.2b via /api/translate endpoint.
 * Adds "Translate" buttons to elements with [data-translate] attribute.
 * Original text is always preserved; translation shows in a toggle overlay.
 *
 * Usage in HTML:
 *   <p data-translate data-entity-type="work_order" data-entity-id="123" data-field-name="description">
 *     Some text to translate
 *   </p>
 *
 * Or call manually:
 *   DRIVEN_TRANSLATE.translate(textEl, { entity_type, entity_id, field_name, target_lang })
 *
 * Load after dashboard-common.js:
 *   <script src="/app/shared/translate.js?v=1"></script>
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
    ].join('\n');
    document.head.appendChild(style);
  }

  // -- Default target language (stored per user) --
  function getTargetLang() {
    try {
      var saved = localStorage.getItem('driven-translate-lang');
      if (saved) return saved;
    } catch (e) {}
    return 'es'; // default to Spanish
  }

  function setTargetLang(lang) {
    try { localStorage.setItem('driven-translate-lang', lang); } catch (e) {}
  }

  // -- Translate function --
  async function translate(targetEl, opts) {
    if (!targetEl) return;

    var originalText = targetEl.getAttribute('data-original-text') ||
                       targetEl.textContent || targetEl.innerText || '';
    targetEl.setAttribute('data-original-text', originalText.trim());

    var targetTypeLang = (opts && opts.target_lang) || getTargetLang();
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
          source_lang: 'en',
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

  // -- Add translate button to an element --
  function addTranslateButton(targetEl) {
    if (targetEl.dataset.translateAdded) return;
    targetEl.dataset.translateAdded = '1';

    var text = (targetEl.textContent || '').trim();
    if (!text || text.length < 2) return; // skip empty or very short text

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

  // -- DOM Auto-Init: scan for [data-translate] elements --
  function init() {
    var elements = document.querySelectorAll('[data-translate]');
    for (var i = 0; i < elements.length; i++) {
      addTranslateButton(elements[i]);
    }
  }

  // -- Expose global --
  window.DRIVEN_TRANSLATE = {
    translate: translate,
    addTranslateButton: addTranslateButton,
    init: init,
    getTargetLang: getTargetLang,
    setTargetLang: setTargetLang,
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
    setTimeout(init, 1000);
  });

})();
