$base = $PWD.Path
$ErrorActionPreference = 'SilentlyContinue'

# 1. Write new dashboard-header.html
$h = @'
<div class="dash-header">
  <div class="dash-header-row1">
    <div id="dashCustomerLogoArea" class="dash-header-logo-left">
      <div class="dash-customer-logo-placeholder">No logo uploaded</div>
    </div>
    <h1 id="dashPageTitle" class="dash-header-title">Dashboard</h1>
    <div class="dash-header-logo-right">
      <img src="/assets/logo.png?v=2026" class="dash-driven-logo" alt="DRIV-EN Logo">
    </div>
  </div>
</div>
<div class="dash-utility-bar">
  <div class="dash-theme-wrapper" title="Toggle light/dark mode">
    <span class="dash-theme-label" id="dashThemeLabelLight">Light</span>
    <label class="dash-theme-switch">
      <input type="checkbox" id="dashThemeCheckbox">
      <span class="dash-theme-slider"></span>
    </label>
    <span class="dash-theme-label" id="dashThemeLabelDark">Dark</span>
  </div>
  <div id="dashGreetingText" class="dash-greeting"></div>
  <div class="dash-utility-actions">
    <a class="dash-home-btn" id="dashHomeBtn" href="/app/dashboard/admin.html">Dashboard</a>
    <button class="dash-logout" id="dashLogoutBtn">Logout</button>
  </div>
</div>
'@
Set-Content "$base\app\shared\dashboard-header.html" $h -Encoding UTF8
Write-Host "1. dashboard-header.html - OK"

# 2. Fix dashboard-common.js
$f = "$base\app\shared\dashboard-common.js"
$c = Get-Content $f -Raw
if ($c -and ($c -notmatch 'wireHeaderEvents')) {
  $wire = @"

  /* ===== WIRE HEADER EVENT LISTENERS (CSP compliant) ===== */
  function wireHeaderEvents() {
    var checkbox = document.getElementById("dashThemeCheckbox");
    if (checkbox && !checkbox._drivenWired) {
      checkbox.addEventListener("change", window.dashToggleTheme);
      checkbox._drivenWired = true;
    }
    var logoutBtn = document.getElementById("dashLogoutBtn");
    if (logoutBtn && !logoutBtn._drivenWired) {
      logoutBtn.addEventListener("click", window.dashLogout);
      logoutBtn._drivenWired = true;
    }
  }
"@
  $c = $c -replace '(function setPageTitle\(\) \{[^}]+\})', "`$1$wire"
  $c = $c -replace 'setPageTitle\(\);\s*\r?\n\s*// Step 3:', "setPageTitle();`r`n    wireHeaderEvents();`r`n    // Step 3:"
  $c = $c -replace 'dashboard-header\.html"', 'dashboard-header.html?v=2026"'
  Set-Content $f $c -Encoding UTF8
  Write-Host "2. dashboard-common.js - OK"
} else { Write-Host "2. dashboard-common.js - SKIP" }

# 3. Fix dashboard.css - remove sticky from children
$f = "$base\app\shared\dashboard.css"
$c = Get-Content $f -Raw
if ($c) {
  $c = $c -replace 'position:\s*sticky;\s*/\* Sticks to top when scrolling \*/', ''
  $c = $c -replace '(?m)^\s*position:\s*sticky;\r?\n\s*top:\s*0;\r?\n\s*z-index:\s*99;\r?\n', ''
  $c = $c -replace '(?m)^\s*position:\s*sticky;\r?\n\s*top:\s*0;\r?\n\s*z-index:\s*100;\r?\n', ''
  Set-Content $f $c -Encoding UTF8
  Write-Host "3. dashboard.css - OK"
} else { Write-Host "3. dashboard.css - SKIP" }

# 4. Fix admin.js - add fallback timeout + try/finally
$f = "$base\app\dashboard\admin.js"
$c = Get-Content $f -Raw
if ($c -and ($c -notmatch 'Fallback: showing dashboard')) {
  $fallback = @"

  // Fallback: show dashboard after 5s if startAdminApp never ran
  setTimeout(function() {
    if (adminAppStarted) return;
    var u = window.dashUser || window.drivenUser || getUserFromStorage();
    if (u) { startAdminApp(u); }
    else {
      var loadingEl = document.getElementById('loading');
      var dashEl = document.getElementById('dashboard');
      if (loadingEl) loadingEl.style.display = 'none';
      if (dashEl) dashEl.style.display = 'block';
    }
  }, 5000);
"@
  $marker = "window.addEventListener('load', function() { if (!adminAppStarted)"
  if ($c.Contains($marker)) {
    $c = $c.Replace($marker, $fallback + "`n  " + $marker)
  }
  $c = $c -replace '// Show dashboard even if init had errors', "} catch (e2) { reportError('startAdminApp-outer', e2); } finally {`n    // ALWAYS show the dashboard"
  Set-Content $f $c -Encoding UTF8
  Write-Host "4. admin.js - OK"
} else { Write-Host "4. admin.js - SKIP" }

# 5. Fix admin.html
$f = "$base\app\dashboard\admin.html"
$c = Get-Content $f -Raw
if ($c) {
  $c = $c -replace '#dashHeader \.dash-theme-wrapper \{ display:none !important; \}', ''
  $c = $c -replace 'dashboard\.css\?v=\d+', 'dashboard.css?v=12'
  $c = $c -replace 'dashboard-common\.js\?v=\d+', 'dashboard-common.js?v=16'
  $c = $c -replace 'admin\.js\?v=\d+', 'admin.js?v=15'
  Set-Content $f $c -Encoding UTF8
  Write-Host "5. admin.html - OK"
} else { Write-Host "5. admin.html - SKIP" }

# 6. Fix all page files
$pages = @(
  "app\dashboard\admin\users.html","app\dashboard\asset-management.html",
  "app\dashboard\company-management.html","app\dashboard\employee-dashboard.html",
  "app\dashboard\fuel.html","app\dashboard\onboarding-dashboard.html",
  "app\dashboard\project-management.html","app\dashboard\transfers.html",
  "app\dashboard\user-management.html","app\dashboard\work-orders.html",
  "app\forms\fuel-purchase.html","app\forms\fuel-transfer.html",
  "app\forms\transfer-create.html","app\onboarding\asset-types.html",
  "app\onboarding\clients.html","app\onboarding\divisions.html",
  "app\onboarding\employees.html","app\onboarding\equipment.html",
  "app\onboarding\fuel-types.html","app\onboarding\locations.html",
  "app\onboarding\projects.html","app\onboarding\roles-permissions.html",
  "app\onboarding\units-of-measure.html","app\asset\asset-detail.html"
)
$patterns = 'dash-header-row2','dash-header-row3','dash-theme-wrapper','insertHeaderTitle','fixHeaderLayout','header-title'
$count = 0
foreach ($p in $pages) {
  $f = "$base\$p"
  if (-not (Test-Path $f)) { continue }
  $lines = Get-Content $f
  $filtered = $lines | Where-Object { $line = $_; -not ($patterns | Where-Object { $line -match $_ }) }
  $c = $filtered -join "`r`n"
  $c = $c -replace 'dashboard\.css\?v=\d+', 'dashboard.css?v=12'
  $c = $c -replace 'dashboard-common\.js\?v=\d+', 'dashboard-common.js?v=16'
  if ($p -match 'users.html' -and $c -notmatch 'data-page-title') {
    $c = $c -replace '<body>', '<body data-page-title="User Management">'
  }
  Set-Content $f $c -Encoding UTF8
  $count++
}
Write-Host "6. Page files - fixed $count files"
Write-Host ""
Write-Host "=== DONE ==="
