$utf8 = New-Object System.Text.UTF8Encoding $false
$f = "app\dashboard\admin.html"
$c = [System.IO.File]::ReadAllText((Resolve-Path $f), $utf8)

# Fix 1: Add closing brace before });
$old1 = 'driven_client_count") || "0";' + "`r`n" + '});'
$new1 = 'driven_client_count") || "0";' + "`r`n" + '}' + "`r`n" + '});'
$c = $c.Replace($old1, $new1)

# Fix 2: Add fallback timeout before init()
$old2 = '});' + "`r`n" + '}' + "`r`n" + 'init();'
$new2 = '});' + "`r`n" + 'setTimeout(function() { var l = document.getElementById("loading"); var d = document.getElementById("dashboard"); if (l) l.style.display = "none"; if (d) d.style.display = "block"; }, 5000);' + "`r`n" + '}' + "`r`n" + 'init();'
$c = $c.Replace($old2, $new2)

[System.IO.File]::WriteAllText((Resolve-Path $f), $c, $utf8)
Write-Host "Done - brace and timeout added"
