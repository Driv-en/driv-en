/* ==========================================================================
   DRIV-EN GLOBAL ERROR HANDLER
   ==========================================================================
   PURPOSE: Catches all unhandled errors on every page and:
     1. Shows a user-friendly message ("DRIV-EN team is aware and working on it")
     2. Sends the error to the backend (which logs to D1 + emails support@driv-en.com)
     3. Ensures the owner dashboard Error Logs tab gets enough info to diagnose

   USAGE: Include this script on EVERY page (before any other JS):
     <script src="/assets/js/error-handler.js"></script>

   HOW IT WORKS:
     - window.onerror catches synchronous errors
     - window.onunhandledrejection catches async/promise errors
     - try/catch wrappers around fetch calls detect API errors
     - Errors are POSTed to /api/error-report (Pages Function) which writes to D1
     - User sees a dismissible banner, never a blank screen or cryptic message
   ========================================================================== */

(function () {
  'use strict';

  var ERROR_REPORT_ENDPOINT = '/api/error-report';
  var MAX_BANNER_WIDTH = '500px';
  var BANNER_ZINDEX = 999999;

  var recentErrors = {};
  var DEDUP_WINDOW_MS = 5000;

  function showErrorBanner(message) {
    var existing = document.getElementById('driv-en-error-banner');
    if (existing) return;

    var banner = document.createElement('div');
    banner.id = 'driv-en-error-banner';
    banner.style.cssText = [
      'position:fixed', 'top:20px', 'left:50%', 'transform:translateX(-50%)',
      'max-width:' + MAX_BANNER_WIDTH, 'width:calc(100% - 40px)',
      'background:#fff', 'border:2px solid #cc0000', 'border-radius:10px',
      'padding:16px 20px', 'box-shadow:0 4px 20px rgba(0,0,0,0.15)',
      'z-index:' + BANNER_ZINDEX, 'font-family:Arial,sans-serif',
      'font-size:14px', 'color:#333', 'line-height:1.5'
    ].join(';');

    var icon = '<div style="float:left;margin-right:12px;font-size:24px;">⚠️</div>';
    var title = '<strong style="display:block;margin-bottom:4px;color:#cc0000;font-size:15px;">Something went wrong</strong>';
    var body = '<span style="display:block;margin-bottom:8px;">' +
      (message || 'An unexpected error occurred. The DRIV-EN team has been notified and is aware of the issue. ' +
      'We apologize for the inconvenience. If you don\'t hear from us within 24 hours, ' +
      'please contact <a href="mailto:support@driv-en.com" style="color:#00b140;">support@driv-en.com</a>.') +
      '</span>';
    var closeBtn = '<button onclick="this.parentElement.parentElement.remove()" ' +
      'style="float:right;background:none;border:none;font-size:18px;cursor:pointer;color:#999;padding:0 4px;line-height:1;">×</button>';

    banner.innerHTML = closeBtn + icon + title + body;
    document.body.appendChild(banner);

    setTimeout(function () {
      if (banner.parentElement) banner.remove();
    }, 15000);
  }

  function reportError(errorInfo) {
    var dedupKey = errorInfo.message + '|' + errorInfo.source;
    var now = Date.now();
    if (recentErrors[dedupKey] && (now - recentErrors[dedupKey] < DEDUP_WINDOW_MS)) {
      return;
    }
    recentErrors[dedupKey] = now;

    var report = {
      message: errorInfo.message || 'Unknown error',
      source: errorInfo.source || 'client-side',
      stack: errorInfo.stack || null,
      filename: errorInfo.filename || null,
      lineno: errorInfo.lineno || null,
      colno: errorInfo.colno || null,
      url: window.location.href,
      userAgent: navigator.userAgent,
      timestamp: new Date().toISOString(),
      page: window.location.pathname
    };

    try {
      fetch(ERROR_REPORT_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(report),
        credentials: 'include'
      }).catch(function () {
        console.error('[DRIV-EN] Failed to report error to backend:', report);
      });
    } catch (e) {
      console.error('[DRIV-EN] Error reporting failed:', e);
    }
  }

  window.addEventListener('error', function (event) {
    if (event.message && event.message.indexOf('Error loading script') !== -1) {
      return;
    }
    var errorInfo = {
      message: event.message || 'Unhandled error',
      filename: event.filename,
      lineno: event.lineno,
      colno: event.colno,
      stack: event.error && event.error.stack ? event.error.stack : null,
      source: 'window.onerror'
    };
    reportError(errorInfo);
    showErrorBanner();
  });

  window.addEventListener('unhandledrejection', function (event) {
    var reason = event.reason;
    var errorInfo = {
      message: (reason && reason.message) ? reason.message : String(reason || 'Unhandled promise rejection'),
      stack: reason && reason.stack ? reason.stack : null,
      source: 'unhandledrejection'
    };
    reportError(errorInfo);
    showErrorBanner();
  });

  var originalFetch = window.fetch;
  window.fetch = function () {
    var args = arguments;
    return originalFetch.apply(this, args).then(function (response) {
      if (response.status >= 500) {
        var cloned = response.clone();
        cloned.json().then(function (data) {
          var msg = (data && data.error) ? data.error : null;
          showErrorBanner(msg);
          reportError({
            message: 'API returned ' + response.status + ': ' + (msg || 'Server error'),
            source: 'fetch-wrapper',
            stack: 'URL: ' + (args[0] && args[0].url ? args[0].url : args[0])
          });
        }).catch(function () {
          showErrorBanner();
        });
      }
      return response;
    }).catch(function (err) {
      reportError({
        message: 'Network error: ' + (err.message || 'fetch failed'),
        source: 'fetch-network-error',
        stack: err.stack
      });
      showErrorBanner('A network error occurred. The DRIV-EN team has been notified. Please check your internet connection and try again.');
      throw err;
    });
  };

  window.DRIVENErrorHandler = {
    wrap: function (fn) {
      return function () {
        try {
          return fn.apply(this, arguments);
        } catch (err) {
          reportError({
            message: err.message || 'Wrapped function error',
            source: 'DRIVENErrorHandler.wrap',
            stack: err.stack
          });
          showErrorBanner();
          throw err;
        }
      };
    },
    report: function (message, source, stack) {
      reportError({
        message: message,
        source: source || 'manual',
        stack: stack
      });
      showErrorBanner(message);
    },
    showBanner: function (message) {
      showErrorBanner(message);
    }
  };

  console.log('[DRIV-EN] Error handler initialized');
})();
