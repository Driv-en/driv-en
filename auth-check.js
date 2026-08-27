// ==========================================
// AUTH CHECK — Shared auth protection script
// ==========================================
// HOW IT WORKS:
//   1. Add this line to any page that needs protection:
//      <script src="/components/auth-check.js"></script>
//   2. Right now this file does NOTHING — pages are open during development.
//   3. When ready to lock down, uncomment the ACTIVE CODE section below.
//      That single change will protect ALL pages that include this file.
// ==========================================

// ==========================================
// INACTIVE CODE — Currently disabled for development
// Uncomment this block when ready to require login on all pages
// ==========================================

/*
(async function() {
  try {
    var response = await fetch("/auth/session");
    var data = await response.json();
    if (!data.authenticated) {
      // Not logged in — redirect to login page
      window.location.href = "/public/login.html";
      return;
    }
    // Optionally store user info globally for other scripts to use
    window.drivenUser = data.user;
  } catch (e) {
    console.error("Auth check error:", e.message);
    // On error, redirect to login (safer to deny than allow)
    window.location.href = "/public/login.html";
  }
})();
*/

// ==========================================
// ACTIVE CODE — Currently does nothing
// Just a placeholder so the file loads without errors
// ==========================================
console.log("Auth check loaded (currently inactive — pages are open during development).");
