/**
 * Site Visitor Tracking Script
 * 
 * Purpose: This script runs on EVERY page of driv-en.com (not just the home page).
 * It silently collects non-PII (non-personally identifiable) data about each
 * visitor and sends it to /referral/track-visitor for storage. This data powers the
 * "Site Visitors" tab on the Owner Dashboard.
 * 
 * What is collected:
 *   - Timestamp of the visit
 *   - Page URL (landing page + path)
 *   - Referral code (if present in URL, localStorage, or cookie)
 *   - Country (from Cloudflare CF-IPCountry header — resolved server-side)
 *   - Device type (phone, tablet, desktop — parsed from User-Agent)
 *   - Browser (Chrome, Safari, Firefox, Edge, etc.)
 *   - OS (iOS, Android, Windows, macOS, Linux, etc.)
 *   - UTM parameters (source, medium, campaign — from URL if present)
 *   - Referrer (the external site they came from, if any)
 * 
 * What is NOT collected:
 *   - IP addresses (never stored)
 *   - Exact location (only country-level, from Cloudflare headers)
 *   - Names, emails, or any personal data
 *   - Cookies or session data
 * 
 * Privacy: This script collects anonymous analytics data only.
 * No personally identifiable information is stored.
 * 
 * This script is designed to NEVER block or interrupt the visitor's experience.
 * All operations are silent and fail gracefully.
 * 
 * Last updated: 2026-09-05
 * CHANGES:
 *   - Changed POST endpoint from /api/track-visitor to /referral/track-visitor
 *     because the Worker route www.driv-en.com/referral/* intercepts all /referral/* paths.
 *     The tracking endpoint now lives in the driven-referral-api Worker.
 */

(function() {
  'use strict';

  try {
    // ===== COLLECT VISITOR DATA =====

    // Get UTM parameters from URL (marketing campaign tracking)
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

    // Device type
    var deviceType = 'desktop';
    if (/iPad|Tablet|PlayBook/i.test(ua)) {
      deviceType = 'tablet';
    } else if (/Mobile|Android|iPhone|iPod|BlackBerry|Opera Mini|IEMobile/i.test(ua)) {
      deviceType = 'phone';
    }

    // Browser
    var browser = 'other';
    if (/Edg\//i.test(ua)) browser = 'edge';
    else if (/OPR\//i.test(ua)) browser = 'opera';
    else if (/Chrome\//i.test(ua)) browser = 'chrome';
    else if (/Firefox\//i.test(ua)) browser = 'firefox';
    else if (/Safari\//i.test(ua)) browser = 'safari';

    // Operating system
    var os = 'other';
    if (/Windows/i.test(ua)) os = 'windows';
    else if (/Android/i.test(ua)) os = 'android';
    else if (/iPhone|iPad|iPod/i.test(ua)) os = 'ios';
    else if (/Mac OS X/i.test(ua)) os = 'macos';
    else if (/Linux/i.test(ua)) os = 'linux';

    // External referrer (which site they came from, if not from driv-en.com)
    var externalReferrer = '';
    if (document.referrer) {
      try {
        var referrerUrl = new URL(document.referrer);
        if (referrerUrl.hostname && !referrerUrl.hostname.includes('driv-en.com')) {
          externalReferrer = referrerUrl.hostname;
        }
      } catch (e) {
        // Invalid referrer URL — ignore
      }
    }

    // Page path (what page they're on)
    var pagePath = window.location.pathname;

    // ===== SEND DATA TO SERVER =====

    var payload = {
      pagePath: pagePath,
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
    // Fallback to fetch with keepalive
    // POST to /referral/track-visitor (handled by the driven-referral-api Worker,
    // which catches all /referral/* paths via the www.driv-en.com/referral/* route)
    try {
      if (navigator.sendBeacon) {
        navigator.sendBeacon('/referral/track-visitor', new Blob([JSON.stringify(payload)], { type: 'application/json' }));
      } else {
        fetch('/referral/track-visitor', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
          keepalive: true
        }).catch(function() { /* fail silently */ });
      }
    } catch (e) {
      // Tracking failed — fail silently, visitor browses normally
    }

  } catch (error) {
    // Any unexpected error — fail silently, never interrupt the visitor
  }
})();
