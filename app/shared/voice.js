/**
 * voice.js -- DRIV-EN Voice & Hands-Free (Minimal v1)
 *
 * Pure browser APIs -- no worker changes, no backend needed.
 *   - Dictation: Web Speech API (SpeechRecognition)
 *
 * Exposes global DRIVEN_VOICE object. Auto-scans DOM for:
 *   [data-voice-input]  -- adds a mic button next to the text field for dictation
 *
 * Manual API:
 *   DRIVEN_VOICE.startDictation(inputElement)
 *   DRIVEN_VOICE.stopDictation()
 *   DRIVEN_VOICE.isDictationSupported()
 *
 * Load after dashboard-common.js, before page JS:
 *   <script src="/app/shared/voice.js?v=3"></script>
 */

(function() {
  'use strict';

  // -- SpeechRecognition cross-browser shim --
  var SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition || null;
  var SpeechGrammarList = window.SpeechGrammarList || window.webkitSpeechGrammarList || null;

  var recognition = null;
  var listening = false;
  var activeInput = null;
  var dictationRestart = false;

  // -- Language detection --
  // Priority: explicit setLang() > localStorage 'driven-voice-lang' > navigator.language > 'en-US'
  var langOverride = null;

  function getLang() {
    if (langOverride) return langOverride;
    var saved = null;
    try { saved = localStorage.getItem('driven-voice-lang'); } catch (e) {}
    if (saved) return saved;
    // navigator.language returns e.g. "en-US", "es-ES", "fr-FR"
    if (navigator.language) return navigator.language;
    if (navigator.userLanguage) return navigator.userLanguage;
    return 'en-US';
  }

  function setLang(lang) {
    langOverride = lang || null;
    if (lang) {
      try { localStorage.setItem('driven-voice-lang', lang); } catch (e) {}
    }
  }

  // -- Style injection (scoped to voice features) --
  var styleId = 'driven-voice-styles';
  if (!document.getElementById(styleId)) {
    var style = document.createElement('style');
    style.id = styleId;
    style.textContent = [
      '.driven-voice-mic-btn {',
      '  display: inline-flex; align-items: center; justify-content: center;',
      '  width: 36px; height: 36px; margin-left: 6px;',
      '  border: 2px solid var(--success, #16a34a); border-radius: 6px;',
      '  background: var(--bg-card, #fff); color: var(--success, #16a34a);',
      '  cursor: pointer; font-size: 16px; vertical-align: middle;',
      '  transition: background 150ms ease, color 150ms ease;',
      '  flex-shrink: 0;',
      '}',
      '.driven-voice-mic-btn:hover { background: var(--success, #16a34a); color: #fff; }',
      '.driven-voice-mic-btn.recording {',
      '  background: #dc2626; border-color: #b91c1c; color: #fff;',
      '  animation: driven-voice-pulse 1.2s infinite;',
      '}',
      '.driven-voice-mic-btn:disabled { opacity: 0.4; cursor: not-allowed; }',
      '.driven-voice-mic-btn unsupported { display: none; }',
      '',
      '.driven-voice-status {',
      '  font-size: 11px; color: var(--text-muted, #6b7280);',
      '  margin-left: 6px; font-style: italic;',
      '}',
      '',
      '@keyframes driven-voice-pulse {',
      '  0%, 100% { opacity: 1; }',
      '  50% { opacity: 0.5; }',
      '}'
    ].join('\n');
    document.head.appendChild(style);
  }

  // -- Error reporting --
  function reportError(source, err) {
    try {
      fetch('/api/error-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          source: 'voice.js:' + source,
          message: err && err.message ? err.message : String(err),
          stack: err && err.stack ? err.stack : '',
          url: window.location.href,
          timestamp: new Date().toISOString()
        })
      }).catch(function() {});
    } catch (e) {}
    console.error('[Voice] ' + source + ':', err);
  }

  // -- Dictation (Speech Recognition) --

  function isDictationSupported() {
    return SpeechRecognition !== null;
  }

  function startDictation(inputEl) {
    if (!SpeechRecognition) {
      alert('Voice dictation is not supported in this browser. Please use Chrome or Edge.');
      return;
    }
    if (listening) stopDictation();

    activeInput = inputEl;
    recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = getLang();

    var finalTranscript = '';
    var baseText = inputEl.value || '';

    recognition.onstart = function() {
      listening = true;
      updateMicButtons(inputEl, true);
    };

    recognition.onresult = function(event) {
      var interim = '';
      for (var i = event.resultIndex; i < event.results.length; i++) {
        var transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalTranscript += transcript;
        } else {
          interim += transcript;
        }
      }
      // Append to existing text with a space if needed
      var prefix = baseText;
      if (prefix && !prefix.endsWith(' ')) prefix += ' ';
      inputEl.value = prefix + finalTranscript + interim;
      inputEl.dispatchEvent(new Event('input', { bubbles: true }));
    };

    recognition.onerror = function(event) {
      if (event.error === 'no-speech' || event.error === 'aborted' || event.error === 'audio-capture' || event.error === 'network' || event.error === 'bad-grammar') return;
      if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
        alert('Microphone access denied. Please allow microphone access in your browser settings.');
        stopDictation();
        return;
      }
      reportError('recognition.onerror', new Error(event.error));
    };

    recognition.onend = function() {
      listening = false;
      updateMicButtons(inputEl, false);
      // Auto-restart if we were intentionally listening and it stopped (Chrome timeout)
      if (dictationRestart) {
        dictationRestart = false;
        try { recognition.start(); } catch (e) {}
      }
    };

    try {
      recognition.start();
    } catch (e) {
      reportError('startDictation', e);
    }
  }

  function stopDictation() {
    dictationRestart = false;
    listening = false;
    if (recognition) {
      try { recognition.stop(); } catch (e) {}
      recognition = null;
    }
    if (activeInput) {
      updateMicButtons(activeInput, false);
      activeInput = null;
    }
  }

  function isListening() {
    return listening;
  }

  function updateMicButtons(inputEl, recording) {
    var btn = document.querySelector('.driven-voice-mic-btn[data-for="' + (inputEl.id || '') + '"]');
    if (!btn) return;
    if (recording) {
      btn.classList.add('recording');
      btn.innerHTML = '&#x23F9;'; // stop symbol
      btn.title = 'Stop dictation';
    } else {
      btn.classList.remove('recording');
      btn.innerHTML = '&#x1F3A4;'; // microphone
      btn.title = 'Start voice dictation';
    }
  }

  // -- DOM Auto-Init: scan for data-voice-input --

  function init() {
    // Add mic buttons to [data-voice-input] elements
    var inputs = document.querySelectorAll('[data-voice-input]');
    for (var i = 0; i < inputs.length; i++) {
      addMicButton(inputs[i]);
    }
  }

  function addMicButton(inputEl) {
    if (inputEl.dataset.voiceAdded) return;
    inputEl.dataset.voiceAdded = '1';

    if (!isDictationSupported()) return; // don't add button if unsupported

    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'driven-voice-mic-btn';
    btn.innerHTML = '&#x1F3A4;';
    btn.title = 'Start voice dictation';
    btn.setAttribute('data-for', inputEl.id || '');
    btn.setAttribute('aria-label', 'Voice dictation');

    btn.addEventListener('click', function(e) {
      e.preventDefault();
      if (listening) {
        stopDictation();
      } else {
        startDictation(inputEl);
      }
    });

    // Insert after the input element
    if (inputEl.parentNode) {
      inputEl.parentNode.insertBefore(btn, inputEl.nextSibling);
    }
  }

  // -- Expose global --
  window.DRIVEN_VOICE = {
    isDictationSupported: isDictationSupported,
    startDictation: startDictation,
    stopDictation: stopDictation,
    isListening: isListening,
    getLang: getLang,
    setLang: setLang,
    init: init,
    addMicButton: addMicButton
  };

  // -- Auto-init on DOMContentLoaded and after dynamic content loads --
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // Re-init after dashSessionLoaded (content may be rendered after session loads)
  document.addEventListener('dashSessionLoaded', function() {
    setTimeout(init, 200);
    setTimeout(init, 1000);
  });

  // Stop dictation when page unloads
  window.addEventListener('beforeunload', function() {
    stopDictation();
  });

})();
