(function () {
  try {
    var el = document.getElementById('drivenCopyrightYear');
    if (el) el.textContent = new Date().getFullYear();
  } catch (e) {
    // fail silently
  }
})();
