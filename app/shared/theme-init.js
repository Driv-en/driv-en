(function() {
  var savedTheme = localStorage.getItem("driven-theme") || "light";
  document.documentElement.setAttribute("data-theme", savedTheme);
})();
