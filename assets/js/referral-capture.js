/**
 * Referral Code Capture Script
 * 
 * Purpose: This script runs on the home page (index.html). When a visitor
 * arrives with ?ref=DRV-CODE in the URL, this script:
 * 1. Extracts the referral code from the URL
 * 2. Stores it in localStorage (persists indefinitely)
 * 3. Stores it in a cookie with 1-year expiry (backup method)
 * 4. Fires a silent tracking call to /referral/track (records the visit)
 * 5. Cleans the URL (removes ?ref= so it doesn't get accidentally shared)
 * 
 * If no referral code is present, nothing happens — the visitor browses normally.
 * 
 * This script is designed to NEVER block or interrupt the visitor's experience.
 * All operations are silent and fail gracefully.
 * 
 * Last updated: 2026-09-04
 */

(function() {
  'use strict';

  try {
    // Get the referral code from the URL query string
    const urlParams = new URLSearchParams(window.location.search);
    const refCode = urlParams.get('ref');

    // No referral code? Do nothing — visitor browses normally
    if (!refCode) {
      return;
    }

    // Sanitize — referral codes are alphanumeric with dashes, max 20 chars
    const cleanCode = refCode.replace(/[^A-Za-z0-9-]/g, '').substring(0, 20);

    if (!cleanCode) {
      return;
    }

    // Store in localStorage (persists indefinitely until manually cleared)
    try {
      localStorage.setItem('driv_en_referral_code', cleanCode);
    } catch (e) {
      // localStorage might be disabled (private browsing) — fail silently
    }

    // Store in a cookie with 1-year expiry (backup method)
    // Cookies survive longer and are harder to accidentally clear
    try {
      const expiryDate = new Date();
      expiryDate.setFullYear(expiryDate.getFullYear() + 1);
      document.cookie = 'driv_en_referral_code=' + encodeURIComponent(cleanCode) + 
        '; expires=' + expiryDate.toUTCString() + 
        '; path=/; SameSite=Lax; Secure';
    } catch (e) {
      // Cookie might be blocked — fail silently
    }

    // Fire a silent tracking call to record the visit
    // This updates the referrer's dashboard with a "Visited" lead
    // Using navigator.sendBeacon so it works even if the page is closed quickly
    try {
      if (navigator.sendBeacon) {
        const payload = JSON.stringify({ referralCode: cleanCode });
        navigator.sendBeacon('/referral/track', new Blob([payload], { type: 'application/json' }));
      } else {
        // Fallback to fetch if sendBeacon is not available
        fetch('/referral/track', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ referralCode: cleanCode }),
          keepalive: true,
        }).catch(function() { /* fail silently */ });
      }
    } catch (e) {
      // Tracking failed — fail silently, visitor browses normally
    }

    // Clean the URL — remove ?ref= parameter so it doesn't get accidentally shared
    // This replaces the URL in the browser without reloading the page
    try {
      const cleanUrl = window.location.pathname + window.location.hash;
      window.history.replaceState({}, document.title, cleanUrl);
    } catch (e) {
      // URL cleaning failed — not critical, fail silently
    }

  } catch (error) {
    // Any unexpected error — fail silently, never interrupt the visitor
  }
})();
