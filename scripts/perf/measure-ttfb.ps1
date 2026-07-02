# WP-E3 — TTFB / CDN-cache measurement harness (post-audit lane E).
#
# Measures Time-To-First-Byte and the x-vercel-cache verdict on the
# representative URL set, N hits per URL, and writes a CSV next to this
# script (scripts/perf/runs/ttfb-<date>.csv).
#
# Usage:
#   pwsh scripts/perf/measure-ttfb.ps1                 # prod, 3 hits/url
#   pwsh scripts/perf/measure-ttfb.ps1 -BaseUrl http://localhost:3000 -Hits 2
#
# Baseline 2026-07-02 (prod, all MISS): home 2752 ms · fiche 3000-4464 ms ·
# classement 10623 ms · destination 12034-12233 ms.
# Target after the ADR-0031 data-cache work: warm TTFB < 800 ms on the
# editorial routes (the HTML stays force-dynamic — CSP nonce contract — so
# x-vercel-cache stays MISS by design; the win must show up in the ms column).

param(
  [string]$BaseUrl = 'https://myconciergehotel.com',
  [int]$Hits = 3
)

$urls = @(
  '/',
  '/en',
  '/hotel/le-meurice',
  '/hotel/ritz-paris',
  '/en/hotel/le-meurice',
  '/destination/paris',
  '/destination/courchevel',
  '/en/destination/tokyo',
  '/classement/meilleurs-palaces-paris',
  '/classement/hotel-de-luxe-paris',
  '/classements',
  '/lieux',
  '/lieux/paris',
  '/hotels',
  '/hotels/france/paris',
  '/itineraires',
  '/guides',
  '/le-concierge-club',
  '/mentions-legales',
  '/destination'
)

$outDir = Join-Path $PSScriptRoot 'runs'
New-Item -ItemType Directory -Force -Path $outDir | Out-Null
$stamp = Get-Date -Format 'yyyy-MM-dd-HHmm'
$outFile = Join-Path $outDir "ttfb-$stamp.csv"

$rows = New-Object System.Collections.Generic.List[object]

foreach ($u in $urls) {
  $full = "$BaseUrl$u"
  for ($i = 1; $i -le $Hits; $i++) {
    $sw = [System.Diagnostics.Stopwatch]::StartNew()
    try {
      # -Method Head is rejected by some Next routes; GET but discard body.
      $resp = Invoke-WebRequest -Uri $full -UseBasicParsing -TimeoutSec 60
      $sw.Stop()
      $cache = $resp.Headers['x-vercel-cache']
      if ($null -eq $cache) { $cache = '' }
      $status = [int]$resp.StatusCode
    } catch {
      $sw.Stop()
      $cache = 'ERROR'
      $status = 0
    }
    $rows.Add([pscustomobject]@{
      url    = $u
      hit    = $i
      ms     = $sw.ElapsedMilliseconds
      status = $status
      cache  = "$cache"
    })
    Write-Host ("{0,-45} hit {1}  {2,6} ms  {3,-5} {4}" -f $u, $i, $sw.ElapsedMilliseconds, $status, $cache)
  }
}

$rows | Export-Csv -Path $outFile -NoTypeInformation -Encoding UTF8
Write-Host "`nCSV -> $outFile"

# Summary: median per URL (warm hits only, i.e. hit >= 2).
Write-Host "`n=== Median warm TTFB per URL (hits 2..$Hits) ==="
$rows | Where-Object { $_.hit -ge 2 } | Group-Object url | ForEach-Object {
  $sorted = $_.Group | Sort-Object ms
  $median = $sorted[[math]::Floor(($sorted.Count - 1) / 2)].ms
  [pscustomobject]@{ url = $_.Name; median_ms = $median }
} | Sort-Object median_ms -Descending | Format-Table -AutoSize
