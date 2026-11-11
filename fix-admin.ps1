$f = 'app\dashboard\admin.html'
$c = Get-Content $f -Raw

# 1. Remove insertHeaderTitle function definition
$c = $c -replace '(?s)function insertHeaderTitle\(\) \{.*?\n\}', ''

# 2. Remove insertHeaderTitle() call
$c = $c -replace 'insertHeaderTitle\(\);\r?\n', ''

# 3. Add try { after the dashSessionLoaded handler opens
$c = $c -replace 'async function\(\) \{\r?\nvar user = window.dashUser;', 'async function() {' + "`r`n" + 'try {' + "`r`n" + 'var user = window.dashUser;'

# 4. Replace the dashboard-show section with catch/finally
$old = 'updateThemeSwitch();' + "`r`n" + 'document.getElementById("loading").style.display = "none";'
$new = 'updateThemeSwitch();' + "`r`n" + '} catch (e) { console.error("[AdminDashboard] Error:", e); } finally {' + "`r`n" + 'document.getElementById("loading").style.display = "none";'
$c = $c.Replace($old, $new)

# 5. Add closing brace before the }); that ends the event listener
$old2 = '|| "0";' + "`r`n" + '});'
$new2 = '|| "0";' + "`r`n" + '}' + "`r`n" + '});'
$c = $c.Replace($old2, $new2)

# 6. Add fallback timeout before init()
$old3 = '});' + "`r`n" + '}' + "`r`n" + 'init();'
$new3 = '});' + "`r`n" + 'setTimeout(function() { var l = document.getElementById("loading"); var d = document.getElementById("dashboard"); if (l) l.style.display = "none"; if (d) d.style.display = "block"; }, 5000);' + "`r`n" + '}' + "`r`n" + 'init();'
$c = $c.Replace($old3, $new3)

Set-Content $f $c -Encoding UTF8
Write-Host "admin.html fixed - try/finally + fallback timeout added"
