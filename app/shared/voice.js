/**
 * voice.js -- DRIV-EN Voice & Hands-Free (Minimal v1)
 *
 * Pure browser APIs -- no worker changes, no backend needed.
 *   - Dictation: Web Speech API (SpeechRecognition)
 *   - Read Aloud: SpeechSynthesis API
 *
 * Exposes global DRIVEN_VOICE object. Auto-scans DOM for:
 *   [data-voice-input]  -- adds a mic button next to the text field for dictation
 *   [data-voice-read]   -- adds a "Read Aloud" button that speaks the element's text
 *
 * Manual API:
 *   DRIVEN_VOICE.startDictation(inputElement)
 *   DRIVEN_VOICE.stopDictation()
 *   DRIVEN_VOICE.speak(text)
 *   DRIVEN_VOICE.stopSpeaking()
 *   DRIVEN_VOICE.isDictationSupported()
 *   DRIVEN_VOICE.isTTSSupported()
 *
 * Load after dashboard-common.js, before page JS:
 *   <script src="/app/shared/voice.js?v=1"></script>
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
      '.driven-voice-read-btn {',
      '  display: inline-flex; align-items: center; gap: 4px;',
      '  padding: 4px 12px; margin: 4px 0;',
      '  border: 2px solid var(--success, #16a34a); border-radius: 6px;',
      '  background: var(--bg-card, #fff); color: var(--success, #16a34a);',
      '  cursor: pointer; font-size: 13px;',
      '  transition: background 150ms ease, color 150ms ease;',
      '}',
      '.driven-voice-read-btn:hover { background: var(--success, #16a34a); color: #fff; }',
      '.driven-voice-read-btn.speaking { background: var(--success, #16a34a); color: #fff; }',
      '.driven-voice-read-btn:disabled { opacity: 0.4; cursor: not-allowed; }',
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
      });
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
    recognition.lang = 'en-US';

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
      if (event.error === 'no-speech') return; // normal, keep going
      if (event.error === 'aborted') return;
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

  // -- Text-to-Speech (SpeechSynthesis) --

  function isTTSSupported() {
    return 'speechSynthesis' in window;
  }

  var currentUtterance = null;

  function speak(text, opts) {
    if (!isTTSSupported()) {
      alert('Text-to-speech is not supported in this browser.');
      return;
    }
    stopSpeaking();

    var utter = new SpeechSynthesisUtterance(text);
    utter.rate = (opts && opts.rate) || 1.0;
    utter.pitch = (opts && opts.pitch) || 1.0;
    utter.volume = (opts && opts.volume) || 1.0;
    utter.lang = 'en-US';

    utter.onstart = function() {
      currentUtterance = utter;
      updateReadButtons(true);
    };
    utter.onend = function() {
      currentUtterance = null;
      updateReadButtons(false);
    };
    utter.onerror = function(e) {
      currentUtterance = null;
      updateReadButtons(false);
      if (e.error !== 'interrupted' && e.error !== 'canceled') {
        reportError('speak', new Error(e.error || 'TTS error'));
      }
    };

    window.speechSynthesis.speak(utter);
  }

  function stopSpeaking() {
    if (isTTSSupported()) {
      window.speechSynthesis.cancel();
    }
    currentUtterance = null;
    updateReadButtons(false);
  }

  function isSpeaking() {
    return isTTSSupported() && window.speechSynthesis.speaking;
  }

  function updateReadButtons(speaking) {
    var btns = document.querySelectorAll('.driven-voice-read-btn');
    for (var i = 0; i < btns.length; i++) {
      if (speaking) {
        btns[i].classList.add('speaking');
        btns[i].innerHTML = '&#x23F9; Stop Reading';
      } else {
        btns[i].classList.remove('speaking');
        btns[i].innerHTML = '&#x1F50A; Read Aloud';
      }
    }
  }

  // -- DOM Auto-Init: scan for data-voice-input and data-voice-read --

  function init() {
    // Add mic buttons to [data-voice-input] elements
    var inputs = document.querySelectorAll('[data-voice-input]');
    for (var i = 0; i < inputs.length; i++) {
      addMicButton(inputs[i]);
    }

    // Add Read Aloud buttons to [data-voice-read] elements
    var readers = document.querySelectorAll('[data-voice-read]');
    for (var j = 0; j < readers.length; j++) {
      addReadAloudButton(readers[j]);
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

  function addReadAloudButton(targetEl) {
    if (targetEl.dataset.voiceReadAdded) return;
    targetEl.dataset.voiceReadAdded = '1';

    if (!isTTSSupported()) return;

    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'driven-voice-read-btn';
    btn.innerHTML = '&#x1F50A; Read Aloud';
    btn.setAttribute('aria-label', 'Read aloud');

    btn.addEventListener('click', function(e) {
      e.preventDefault();
      if (isSpeaking()) {
        stopSpeaking();
      } else {
        var text = targetEl.textContent || targetEl.innerText || '';
        // Get text from child elements if target is a container
        if (targetEl.dataset.voiceReadTarget) {
          var target = document.querySelector(targetEl.dataset.voiceReadTarget);
          if (target) text = target.textContent || target.innerText || '';
        }
        text = text.trim();
        if (text) speak(text);
      }
    });

    // Insert before the target element
    if (targetEl.parentNode) {
      targetEl.parentNode.insertBefore(btn, targetEl);
    }
  }

  // -- Expose global --
  window.DRIVEN_VOICE = {
    isDictationSupported: isDictationSupported,
    isTTSSupported: isTTSSupported,
    startDictation: startDictation,
    stopDictation: stopDictation,
    isListening: isListening,
    speak: speak,
    stopSpeaking: stopSpeaking,
    isSpeaking: isSpeaking,
    init: init,
    addMicButton: addMicButton,
    addReadAloudButton: addReadAloudButton
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

  // Stop everything when page unloads
  window.addEventListener('beforeunload', function() {
    stopDictation();
    stopSpeaking();
  });

})();
