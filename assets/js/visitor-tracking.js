/**
 * Site Visitor Tracking Script
 * 
 * Purpose: This script runs on EVERY page of driv-en.com (not just the home page).
 * It silently collects non-PII (non-personally identifiable) data about each
 * visitor and sends it to /referral/track-visitor for storage. This data powers
 * the "Site Visitors" tab on the Owner Dashboard.
 * 
 * What is collected:
 *   - Timestamp of the visit
 *   - Page URL (landing page + path)
 *   - Session ID (groups page visits by browsing session — resets on tab close)
 *   - Visitor ID (persistent across sessions — stored in localStorage + cookie)
 *   - Time spent on each page (seconds — measured via page unload/visibilitychange)
 *   - Referral code (if present in URL, localStorage, or cookie)
 *   - Country (from Cloudflare CF-IPCountry header — resolved server-side)
 *   - Device type (phone, tablet, desktop — parsed from User-Agent + platform)
 *   - Browser (Chrome, Safari, Firefox, Edge, etc.)
 *   - OS (iOS, Android, Windows, macOS, Linux, etc.)
 *   - UTM parameters (source, medium, campaign — from URL if present)
 *   - Referrer (the external site they came from, if any)
 * 
 * What is NOT collected:
 *   - IP addresses (never stored)
 *   - Exact location (only country-level, from Cloudflare headers)
 *   - Names, emails, or any personal data
 * 
 * Privacy: This script collects anonymous analytics data only.
 * No personally identifiable information is stored.
 * 
 * This script is designed to NEVER block or interrupt the visitor's experience.
 * All operations are silent and fail gracefully.
 * 
 * Last updated: 2026-09-06
 */

(function() {
  'use strict';

  // ===== SESSION ID =====
  // A session ID groups all page visits from a single browsing session.
  // It's stored in sessionStorage (resets when the tab/browser is closed).
  // This lets the Owner Dashboard show which pages each visitor viewed
  // and how much total time they spent on the site.
  var sessionId = '';
  try {
    sessionId = sessionStorage.getItem('driven_visitor_session') || '';
    if (!sessionId) {
      // Generate a new session ID
      sessionId = 'sess_' + Date.now() + '_' + Math.random().toString(36).substring(2, 10);
      sessionStorage.setItem('driven_visitor_session', sessionId);
    }
  } catch (e) {
    // sessionStorage might be blocked — generate a temporary ID
    sessionId = 'sess_' + Date.now() + '_' + Math.random().toString(36).substring(2, 10);
  }

  // ===== VISITOR ID =====
  // A persistent visitor ID that survives across sessions (unlike session_id
  // which resets when the tab closes). Stored in localStorage AND a cookie
  // with a 1-year expiry. This enables true unique visitor counting —
  // the same person visiting on different days counts as one unique visitor.
  var visitorId = '';
  try {
    visitorId = localStorage.getItem('driven_visitor_id') || '';
    if (!visitorId) {
      visitorId = 'vis_' + Date.now() + '_' + Math.random().toString(36).substring(2, 14);
      localStorage.setItem('driven_visitor_id', visitorId);
    }
  } catch (e) {
    // localStorage might be blocked — try cookie fallback
    var visCookieMatch = document.cookie.match(/driven_visitor_id=([^;]+)/);
    if (visCookieMatch) {
      visitorId = decodeURIComponent(visCookieMatch[1]);
    } else {
      visitorId = 'vis_' + Date.now() + '_' + Math.random().toString(36).substring(2, 14);
    }
  }
  // Set/update cookie with 1-year expiry
  try {
    var visExpiry = new Date();
    visExpiry.setFullYear(visExpiry.getFullYear() + 1);
    document.cookie = 'driven_visitor_id=' + encodeURIComponent(visitorId) +
      '; expires=' + visExpiry.toUTCString() + '; path=/; SameSite=Lax';
  } catch (e) {}

  // ===== PAGE LOAD TIME =====
  var pageLoadTime = Date.now();

  // ===== COLLECT VISITOR DATA =====

  try {
    var urlParams = new URLSearchParams(window.location.search);
    var utmSource = urlParams.get('utm_source') || '';
    var utmMedium = urlParams.get('utm_medium') || '';
    var utmCampaign = urlParams.get('utm_campaign') || '';

    // Get referral code from URL, localStorage, or cookie
    var refCode = urlParams.get('ref') || '';
    if (!refCode) {
      try { refCode = localStorage.getItem('driv_en_referral_code') || ''; } catch (e) {}
    }
    if (!refCode) {
      var cookieMatch = document.cookie.match(/driv_en_referral_code=([^;]+)/);
      if (cookieMatch) refCode = decodeURIComponent(cookieMatch[1]);
    }

    // Parse User-Agent to determine device type, browser, and OS
    var ua = navigator.userAgent || '';
    var platform = navigator.platform || '';
    var maxTouchPoints = navigator.maxTouchPoints || 0;
    var screenWidth = window.screen.width || 0;

    // Device type — robust detection that handles iPhone/iPad in "Request Desktop Site" mode
    var deviceType = 'desktop';

    if (/iPad|Tablet|PlayBook/i.test(ua)) {
      deviceType = 'tablet';
    } else if (/Mobile|Android|iPhone|iPod|BlackBerry|Opera Mini|IEMobile/i.test(ua)) {
      deviceType = 'phone';
    } else if (/iPhone|iPod/i.test(platform) && maxTouchPoints > 0) {
      // iPhone in "Request Desktop Site" mode — UA looks like macOS but platform says iPhone
      deviceType = 'phone';
    } else if (/iPad/i.test(platform) && maxTouchPoints > 0) {
      // iPad in "Request Desktop Site" mode
      deviceType = 'tablet';
    } else if (platform === 'MacIntel' && maxTouchPoints > 1) {
      // iPadOS 13+ reports MacIntel platform with touch points > 1
      deviceType = 'tablet';
    } else if (maxTouchPoints > 0 && screenWidth <= 1024 && /Mac/i.test(ua)) {
      // Fallback: touch device with small screen and Mac-like UA
      if (screenWidth <= 500) {
        deviceType = 'phone';
      } else {
        deviceType = 'tablet';
      }
    }

    // Browser detection
    var browser = 'other';
    if (/Edg\//i.test(ua)) browser = 'edge';
    else if (/OPR\//i.test(ua)) browser = 'opera';
    else if (/CriOS/i.test(ua)) browser = 'chrome';      // Chrome on iOS
    else if (/FxiOS/i.test(ua)) browser = 'firefox';     // Firefox on iOS
    else if (/Chrome\//i.test(ua) && !/Edg|OPR/i.test(ua)) browser = 'chrome';
    else if (/Firefox\//i.test(ua)) browser = 'firefox';
    else if (/Safari\//i.test(ua) && !/Chrome/i.test(ua)) browser = 'safari';

    // Operating system detection
    var os = 'other';
    if (/Windows/i.test(ua)) os = 'windows';
    else if (/Android/i.test(ua)) os = 'android';
    else if (/iPhone|iPad|iPod/i.test(ua)) os = 'ios';
    else if (/iPhone|iPod/i.test(platform) && maxTouchPoints > 0) os = 'ios';
    else if (/iPad/i.test(platform) && maxTouchPoints > 0) os = 'ios';
    else if (platform === 'MacIntel' && maxTouchPoints > 1) os = 'ios';
    else if (/Mac OS X/i.test(ua)) os = 'macos';
    else if (/Linux/i.test(ua)) os = 'linux';

    // External referrer
    var externalReferrer = '';
    if (document.referrer) {
      try {
        var referrerUrl = new URL(document.referrer);
        if (referrerUrl.hostname && !referrerUrl.hostname.includes('driv-en.com')) {
          externalReferrer = referrerUrl.hostname;
        }
      } catch (e) {}
    }

    var pagePath = window.location.pathname;

    // ===== SEND PAGE-VISIT DATA TO SERVER =====

    var payload = {
      pagePath: pagePath,
      sessionId: sessionId,
      visitorId: visitorId,
      referralCode: refCode || null,
      deviceType: deviceType,
      browser: browser,
      os: os,
      utmSource: utmSource || null,
      utmMedium: utmMedium || null,
      utmCampaign: utmCampaign || null,
      externalReferrer: externalReferrer || null
    };

    // Use sendBeacon for reliability (works even if page is closed quickly)
    try {
      if (navigator.sendBeacon) {
        navigator.sendBeacon('/referral/track-visitor', new Blob([JSON.stringify(payload)], { type: 'application/json' }));
      } else {
        fetch('/referral/track-visitor', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
          keepalive: true
        }).catch(function() {});
      }
    } catch (e) {}

    // ===== SEND TIME-ON-PAGE BEACON WHEN LEAVING =====
    // When the visitor leaves this page (closes tab, navigates away, or
    // switches to another tab), send a beacon with the time spent on this page.
    function sendTimeOnPage() {
      var timeOnPage = Math.round((Date.now() - pageLoadTime) / 1000); // seconds
      if (timeOnPage < 1) return; // too short to bother

      var exitPayload = {
        pagePath: pagePath,
        sessionId: sessionId,
        visitorId: visitorId,
        timeOnPage: timeOnPage,
        isPageExit: true
      };

      try {
        if (navigator.sendBeacon) {
          navigator.sendBeacon('/referral/track-visitor', new Blob([JSON.stringify(exitPayload)], { type: 'application/json' }));
        } else {
          fetch('/referral/track-visitor', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(exitPayload),
            keepalive: true
          }).catch(function() {});
        }
      } catch (e) {}
    }

    // Send on page unload (tab close, navigate away)
    window.addEventListener('pagehide', sendTimeOnPage);
    window.addEventListener('beforeunload', sendTimeOnPage);

    // Send when tab becomes hidden (user switches to another tab)
    document.addEventListener('visibilitychange', function() {
      if (document.visibilityState === 'hidden') {
        sendTimeOnPage();
      }
    });

  } catch (error) {
    // Any unexpected error — fail silently
  }
})();
