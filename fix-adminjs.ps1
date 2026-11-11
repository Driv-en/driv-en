$utf8 = New-Object System.Text.UTF8Encoding $false

# Fix admin.js - add try/finally + fallback timeout
$f = "app\dashboard\admin.js"
$c = [System.IO.File]::ReadAllText((Resolve-Path $f), $utf8)

if ($c -notmatch 'startAdminApp-outer') {
  # 1. Add try { after adminAppStarted = true
  $c = $c.Replace("adminAppStarted = true;`r`n", "adminAppStarted = true;`r`n  try {`r`n")

  # 2. Replace the show dashboard comment with catch/finally
  $c = $c.Replace("// Show dashboard even if init had errors", "} catch (e2) { reportError('startAdminApp-outer', e2); } finally {")

  # 3. Add closing brace at end of startAdminApp function
  # The function ends with: }, 1000);\n}
  $c = $c.Replace("}, 1000);`r`n}`r`n`r`nasync function init", "}, 1000);`r`n  }`r`n}`r`n`r`nasync function init")

  # 4. Add fallback timeout before init()
  $c = $c.Replace("init();`r`n", "setTimeout(function() { if (!adminAppStarted) { var l = document.getElementById('loading'); var d = document.getElementById('dashboard'); if (l) l.style.display = 'none'; if (d) d.style.display = 'block'; } }, 5000);`r`ninit();`r`n")

  [System.IO.File]::WriteAllText((Resolve-Path $f), $c, $utf8)
  Write-Host "admin.js fixed"
} else {
  Write-Host "admin.js already fixed"
}

# Bump admin.js version in admin.html
$f2 = "app\dashboard\admin.html"
$c2 = [System.IO.File]::ReadAllText((Resolve-Path $f2), $utf8)
$c2 = $c2 -replace 'admin\.js\?v=\d+', 'admin.js?v=15'
[System.IO.File]::WriteAllText((Resolve-Path $f2), $c2, $utf8)
Write-Host "admin.html version bumped"
Write-Host "=== DONE ==="
