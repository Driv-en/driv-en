$base = $PWD.Path
$utf8 = New-Object System.Text.UTF8Encoding $false

# Step 1: Restore all corrupted files from pre-merge remote version
Write-Host "Restoring original files from pre-merge..."
$files = @(
  "app\shared\dashboard-common.js",
  "app\shared\dashboard.css",
  "app\dashboard\admin.html",
  "app\dashboard\employee-dashboard.html",
  "app\dashboard\fuel.html",
  "app\dashboard\onboarding-dashboard.html",
  "app\dashboard\transfers.html",
  "app\dashboard\work-orders.html",
  "app\forms\fuel-purchase.html",
  "app\forms\fuel-transfer.html",
  "app\forms\transfer-create.html",
  "app\onboarding\clients.html",
  "app\onboarding\divisions.html",
  "app\onboarding\employees.html",
  "app\onboarding\equipment.html",
  "app\onboarding\locations.html",
  "app\onboarding\projects.html",
  "app\onboarding\roles-permissions.html"
)
git checkout HEAD^2 -- $files
Write-Host "Restored $($files.Count) files"

# Step 2: Write new dashboard-header.html (ASCII only, no encoding issues)
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
[System.IO.File]::WriteAllText("$base\app\shared\dashboard-header.html", $h, $utf8)
Write-Host "dashboard-header.html written"

# Step 3: Fix dashboard-common.js
$f = "$base\app\shared\dashboard-common.js"
$c = [System.IO.File]::ReadAllText($f, $utf8)
if ($c -and ($c -notmatch 'wireHeaderEvents')) {
  $wire = "`r`n  /* WIRE HEADER EVENTS (CSP) */" + "`r`n"
  $wire += "  function wireHeaderEvents() {" + "`r`n"
  $wire += "    var cb = document.getElementById('dashThemeCheckbox');" + "`r`n"
  $wire += "    if (cb && !cb._drivenWired) { cb.addEventListener('change', window.dashToggleTheme); cb._drivenWired = true; }" + "`r`n"
  $wire += "    var lb = document.getElementById('dashLogoutBtn');" + "`r`n"
  $wire += "    if (lb && !lb._drivenWired) { lb.addEventListener('click', window.dashLogout); lb._drivenWired = true; }" + "`r`n"
  $wire += "  }" + "`r`n"
  $c = $c -replace '(function setPageTitle\(\) \{[^}]+\})', "`$1$wire"
  $c = $c -replace '(setPageTitle\(\);)\s*\r?\n\s*// (Step \d+: Update theme)', "`$1`r`n    wireHeaderEvents();`r`n    // `$2"
  $c = $c -replace 'dashboard-header\.html"', 'dashboard-header.html?v=2026"'
  [System.IO.File]::WriteAllText($f, $c, $utf8)
  Write-Host "dashboard-common.js fixed"
}

# Step 4: Fix dashboard.css - remove sticky from children
$f = "$base\app\shared\dashboard.css"
$c = [System.IO.File]::ReadAllText($f, $utf8)
if ($c) {
  $c = $c -replace 'position:\s*sticky;\s*/\* Sticks to top when scrolling \*/', ''
  $c = $c -replace '(?m)^\s*position:\s*sticky;\r?\n\s*top:\s*0;\r?\n\s*z-index:\s*99;\r?\n', ''
  $c = $c -replace '(?m)^\s*position:\s*sticky;\r?\n\s*top:\s*0;\r?\n\s*z-index:\s*100;\r?\n', ''
  [System.IO.File]::WriteAllText($f, $c, $utf8)
  Write-Host "dashboard.css fixed"
}

# Step 5: Fix admin.html
$f = "$base\app\dashboard\admin.html"
$c = [System.IO.File]::ReadAllText($f, $utf8)
if ($c) {
  # Remove row-hiding CSS
  $c = $c -replace '\.dash-header-row2 \{[^}]*\}', ''
  $c = $c -replace '\.dash-header-row3 \{[^}]*\}', ''
  $c = $c -replace '#dashHeader \.dash-theme-wrapper \{[^}]*\}', ''
  $c = $c -replace '\.dash-header-row1 \{[^}]*\}', ''
  $c = $c -replace '\.admin-header-title \{[^}]*\}', ''
  # Remove insertHeaderTitle function
  $c = $c -replace '(?s)function insertHeaderTitle\(\) \{.*?\n\}', ''
  $c = $c -replace 'insertHeaderTitle\(\);\s*\r?\n', ''
  # Add try { after dashSessionLoaded handler
  $c = $c -replace 'async function\(\) \{\r?\nvar user = window\.dashUser;', "async function() {`r`ntry {`r`nvar user = window.dashUser;"
  # Add catch/finally
  $c = $c -replace 'updateThemeSwitch\(\);\r?\ndocument\.getElementById\("loading"\)\.style', "updateThemeSwitch();`r`} catch (e) { console.error('[AdminDashboard] Error:', e); } finally {`r`ndocument.getElementById(`"loading`").style"
  # Add closing brace before });
  $c = $c -replace 'driven_client_count"\) \|\| "0";\r?\n\}\);', 'driven_client_count") || "0";' + "`r`n}" + "`r`n});"
  # Add fallback timeout before init()
  $c = $c -replace '\}\);\r?\n\}\r?\ninit\(\);', '});' + "`r`n" + 'setTimeout(function() { var l = document.getElementById("loading"); var d = document.getElementById("dashboard"); if (l) l.style.display = "none"; if (d) d.style.display = "block"; }, 5000);' + "`r`n}" + "`r`ninit();"
  # Bump versions
  $c = $c -replace 'dashboard\.css\?v=\d+', 'dashboard.css?v=12'
  $c = $c -replace 'dashboard-common\.js\?v=\d+', 'dashboard-common.js?v=16'
  [System.IO.File]::WriteAllText($f, $c, $utf8)
  Write-Host "admin.html fixed"
}

# Step 6: Fix all page files - remove CSS lines, bump versions
$pages = @(
  "app\dashboard\employee-dashboard.html","app\dashboard\fuel.html",
  "app\dashboard\onboarding-dashboard.html","app\dashboard\transfers.html",
  "app\dashboard\work-orders.html","app\forms\fuel-purchase.html",
  "app\forms\fuel-transfer.html","app\forms\transfer-create.html",
  "app\onboarding\clients.html","app\onboarding\divisions.html",
  "app\onboarding\employees.html","app\onboarding\equipment.html",
  "app\onboarding\locations.html","app\onboarding\projects.html",
  "app\onboarding\roles-permissions.html"
)
$patterns = 'dash-header-row2','dash-header-row3','dash-theme-wrapper','insertHeaderTitle','fixHeaderLayout','header-title'
$count = 0
foreach ($p in $pages) {
  $f = "$base\$p"
  if (-not (Test-Path $f)) { continue }
  $c = [System.IO.File]::ReadAllText($f, $utf8)
  $lines = $c -split "`r`n"
  $filtered = $lines | Where-Object { $line = $_; -not ($patterns | Where-Object { $line -match $_ }) }
  $c = $filtered -join "`r`n"
  $c = $c -replace 'dashboard\.css\?v=\d+', 'dashboard.css?v=12'
  $c = $c -replace 'dashboard-common\.js\?v=\d+', 'dashboard-common.js?v=16'
  [System.IO.File]::WriteAllText($f, $c, $utf8)
  $count++
}
Write-Host "Page files fixed: $count"
Write-Host ""
Write-Host "=== DONE ==="
