(function () {
  try {
    // Temporary debug log — remove after you confirm it runs
    console.log('footer-year.js running');
    var el = document.getElementById('drivenCopyrightYear');
    if (el) el.textContent = new Date().getFullYear();
  } catch (e) {
    // fail silently
  }
})();
