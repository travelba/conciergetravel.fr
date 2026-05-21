# Downloads each screen's screenshot.png + screen.html via get_screen,
# then builds gallery.html — 4 directions side by side for visual comparison.
#
# Run AFTER the generate script has finished (screens-mapping.json must exist
# with status=OK for all 4 entries).
#
# Usage:
#   pwsh -File download-and-build-gallery.ps1

$ErrorActionPreference = "Stop"
# Stitch API key — never hard-code. Export `STITCH_API_KEY` before running.
# See `.cursor/skills/stitch-mcp-pipeline/SKILL.md` for retrieval steps.
$apiKey = $env:STITCH_API_KEY
if (-not $apiKey) {
    throw "STITCH_API_KEY is not set. `$env:STITCH_API_KEY = '<key>'` before running."
}
$projectId = $env:STITCH_PROJECT_ID
$endpoint = "https://stitch.googleapis.com/mcp"
$baseDir = "C:\Users\Benjamin\Desktop\Conciergetravel.fr\docs\design\stitch-screens\00-ds-comparison"

$screens = Get-Content -Raw "$baseDir\screens-mapping.json" | ConvertFrom-Json
$dsMapping = Get-Content -Raw "$baseDir\ds-mapping.json" | ConvertFrom-Json

function Invoke-StitchTool {
    param([string]$toolName, [hashtable]$arguments)
    $rpc = @{
        jsonrpc = "2.0"
        id = [int]([math]::Floor((Get-Random -Minimum 1000 -Maximum 9999)))
        method = "tools/call"
        params = @{ name = $toolName; arguments = $arguments }
    }
    $payload = $rpc | ConvertTo-Json -Depth 20 -Compress
    $tmp = [System.IO.Path]::GetTempFileName()
    [System.IO.File]::WriteAllText($tmp, $payload, (New-Object System.Text.UTF8Encoding $false))
    $response = & curl.exe -s --max-time 60 -X POST -H "Content-Type: application/json" -H "Accept: application/json, text/event-stream" -H "X-Goog-Api-Key: $apiKey" --data-binary "@$tmp" $endpoint
    Remove-Item $tmp
    return $response | ConvertFrom-Json
}

foreach ($s in $screens) {
    if ($s.status -ne "OK") {
        Write-Host "[$($s.key)] SKIP - status=$($s.status)" -ForegroundColor Yellow
        continue
    }
    $key = $s.key
    $dirOut = "$baseDir\$key"
    if (-not (Test-Path $dirOut)) { New-Item -ItemType Directory -Path $dirOut -Force | Out-Null }

    Write-Host "[$key] Fetching screen $($s.screenName)..." -NoNewline
    $resp = Invoke-StitchTool -toolName "get_screen" -arguments @{ name = $s.screenName }
    if ($resp.error) {
        Write-Host " FAILED: $($resp.error.message)" -ForegroundColor Red
        continue
    }
    $textContent = $resp.result.content[0].text
    $textContent | Out-File -FilePath "$dirOut\get_screen-response.txt" -Encoding utf8

    # Extract download URLs (screenshot + html)
    $screenshotUrl = $null
    $htmlUrl = $null
    if ($textContent -match '"screenshot"\s*:\s*\{[^}]*"downloadUrl"\s*:\s*"([^"]+)"') {
        $screenshotUrl = $matches[1] -replace '\\u003d', '=' -replace '\\u0026', '&'
    }
    if ($textContent -match '"htmlCode"\s*:\s*\{[^}]*"downloadUrl"\s*:\s*"([^"]+)"') {
        $htmlUrl = $matches[1] -replace '\\u003d', '=' -replace '\\u0026', '&'
    }

    if ($screenshotUrl) {
        Write-Host "`n  -> downloading screenshot..." -NoNewline
        & curl.exe -s --max-time 60 -L -o "$dirOut\screenshot.png" $screenshotUrl
        Write-Host " OK" -ForegroundColor Green
    } else {
        Write-Host "`n  -> NO screenshot URL found" -ForegroundColor Yellow
    }
    if ($htmlUrl) {
        Write-Host "  -> downloading html..." -NoNewline
        & curl.exe -s --max-time 60 -L -o "$dirOut\screen.html" $htmlUrl
        Write-Host " OK" -ForegroundColor Green
    } else {
        Write-Host "  -> NO html URL found" -ForegroundColor Yellow
    }
}

# Build gallery.html
$canvasUrl = "https://stitch.withgoogle.com/projects/$projectId"

$cards = ""
foreach ($s in $screens) {
    $ds = $dsMapping | Where-Object { $_.key -eq $s.key } | Select-Object -First 1
    if ($s.status -ne "OK") {
        $cards += "<article class='card card--err'><h2>[$($s.key)] $($ds.displayName)</h2><p class='err'>Generation status: $($s.status)</p></article>`n"
        continue
    }
    $screenshotPath = "$($s.key)/screenshot.png"
    $htmlPath = "$($s.key)/screen.html"
    # Replace em-dash with HTML entity in displayName so it survives PS 5.1 CP1252 read
    $displayNameSafe = $ds.displayName -replace [char]0x2014, '&mdash;' -replace [char]0x2013, '&ndash;'
    $taglineSafe = if ($ds.moodTagline) { $ds.moodTagline -replace [char]0x2014, '&mdash;' -replace [char]0x2013, '&ndash;' -replace [char]0x00d7, '&times;' } else { '' }
    $cards += @"
<article class='card'>
  <header>
    <span class='badge'>$($s.key)</span>
    <h2>$displayNameSafe</h2>
  </header>
  <a href='$screenshotPath' target='_blank' class='shot'>
    <img src='$screenshotPath' alt='$displayNameSafe preview'>
  </a>
  <p class='tagline'>$taglineSafe</p>
  <ul class='meta'>
    <li><strong>Headline:</strong> $($ds.headlineFont)</li>
    <li><strong>Body:</strong> $($ds.bodyFont)</li>
    <li><strong>Color seed:</strong> <span class='swatch' style='background:$($ds.customColor)'></span> $($ds.customColor)</li>
    <li><strong>Secondary:</strong> <span class='swatch' style='background:$($ds.overrideSecondaryColor)'></span> $($ds.overrideSecondaryColor)</li>
    <li><strong>Roundness:</strong> $($ds.roundness)</li>
    <li><strong>Mode:</strong> $($ds.colorMode)</li>
  </ul>
  <footer>
    <a href='$htmlPath' target='_blank'>screen.html</a>
    <span>&middot;</span>
    <a href='$canvasUrl/screens/$($s.screenId)' target='_blank'>open on Stitch canvas</a>
    <span>&middot;</span>
    <span class='id'>$($s.screenId.Substring(0,8))&hellip;</span>
  </footer>
</article>
"@
}

$gallery = @"
<!doctype html>
<html lang='fr'>
<head>
<meta charset='utf-8'>
<title>MCH — DS Comparison · HotelHeader · Le Bristol Paris</title>
<style>
  *{box-sizing:border-box}
  body{font:14px/1.5 system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial; margin:0; background:#f5f3ef; color:#1a1a1a}
  header.top{padding:24px 32px; background:#1a1a1a; color:#f5f3ef; border-bottom:3px solid #8b6f3f}
  header.top h1{margin:0; font-size:20px; font-weight:600}
  header.top p{margin:4px 0 0; opacity:.7}
  main{padding:32px; max-width:2400px; margin:0 auto}
  .grid{display:grid; grid-template-columns:repeat(auto-fit, minmax(520px, 1fr)); gap:24px}
  .card{background:#fff; border:1px solid #e0dccf; border-radius:6px; overflow:hidden; display:flex; flex-direction:column}
  .card header{padding:14px 18px; border-bottom:1px solid #e0dccf; display:flex; align-items:center; gap:12px}
  .card header h2{margin:0; font-size:16px; font-weight:600}
  .badge{display:inline-block; min-width:28px; height:28px; line-height:28px; text-align:center; background:#1a1a1a; color:#f5f3ef; font-weight:700; border-radius:4px; font-size:12px; padding:0 8px}
  .shot{display:block; background:#000}
  .shot img{display:block; width:100%; height:auto; max-height:600px; object-fit:cover; object-position:top}
  .meta{list-style:none; padding:14px 18px; margin:0; display:grid; grid-template-columns:repeat(2, 1fr); gap:6px 18px; font-size:12px; color:#444; border-top:1px solid #f5f3ef}
  .meta li{display:flex; align-items:center; gap:6px}
  .tagline{margin:0; padding:14px 18px 0; font-size:13px; line-height:1.5; color:#555; font-style:italic; border-top:1px solid #f5f3ef}
  .swatch{display:inline-block; width:14px; height:14px; border-radius:3px; border:1px solid rgba(0,0,0,.1); vertical-align:middle}
  .card footer{padding:10px 18px; border-top:1px solid #f5f3ef; font-size:12px; color:#666; display:flex; gap:8px; align-items:center}
  .card footer a{color:#8b6f3f; text-decoration:none}
  .card footer a:hover{text-decoration:underline}
  .card footer .id{font-family:ui-monospace, monospace; font-size:11px; opacity:.6; margin-left:auto}
  .card--err{padding:24px; color:#a00}
</style>
</head>
<body>
<header class='top'>
  <h1>MyConciergeHotel.com &mdash; Comparaison de directions DS</h1>
  <p>Bloc 1 HotelHeader &middot; Le Bristol Paris &middot; m&ecirc;me prompt, 4 design systems Stitch &middot; g&eacute;n&eacute;r&eacute; $(Get-Date -Format 'yyyy-MM-dd HH:mm')</p>
</header>
<main>
  <div class='grid'>
$cards
  </div>
</main>
</body>
</html>
"@

# Write UTF-8 without BOM via .NET (Out-File -Encoding utf8 in PS 5.1 prefixes a BOM,
# which some browsers / strict parsers mishandle. See windows-dev-environment SKILL §Rule 11)
[System.IO.File]::WriteAllText("$baseDir\gallery.html", $gallery, (New-Object System.Text.UTF8Encoding $false))
Write-Host "`nGallery built: $baseDir\gallery.html" -ForegroundColor Cyan
Write-Host "Open it with: ii '$baseDir\gallery.html'"
