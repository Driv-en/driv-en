$utf8 = New-Object System.Text.UTF8Encoding $false
$f = "app\dashboard\admin.js"
$c = [System.IO.File]::ReadAllText((Resolve-Path $f), $utf8)

# Fix 1: Remove comment remnant after "} finally {"
$c = $c -replace '\} finally \{[^\r\n]*blank page', '} finally {'

# Fix 2: Add fallback timeout before init() if not already there
if ($c -notmatch '5000') {
  $c = $c.Replace("init();", "setTimeout(function() { if (!adminAppStarted) { var l = document.getElementById('loading'); var d = document.getElementById('dashboard'); if (l) l.style.display = 'none'; if (d) d.style.display = 'block'; } }, 5000);`r`ninit();")
}

[System.IO.File]::WriteAllText((Resolve-Path $f), $c, $utf8)
Write-Host "Done"
