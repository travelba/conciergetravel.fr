# Watch the 3 pipelines that block Track C (drafts promotion).
# Emits "PIPELINES_CLEAR" once all three are dead so the chat agent
# can resume safely without publishing half-enriched fiches.
$blockers = @{
  'humanizer-faq'     = 27668;
  'enrich-signatures' = 26600;
  'enrich-policies'   = 25300;
}

Write-Output "[watch] starting - polling every 120s"
Write-Output ("[watch] blockers: " + ($blockers.Keys -join ', '))

while ($true) {
  $alive = @()
  foreach ($k in $blockers.Keys) {
    $p = Get-Process -Id $blockers[$k] -ErrorAction SilentlyContinue
    if ($p) { $alive += $k }
  }
  $ts = Get-Date -Format 'HH:mm:ss'
  if ($alive.Count -eq 0) {
    Write-Output ("[watch] " + $ts + " PIPELINES_CLEAR - all 3 blockers terminated, safe to launch Track C.")
    break
  }
  $aliveStr = $alive -join ', '
  $line = "[watch] " + $ts + " still running: " + $aliveStr + " (" + $alive.Count + "/3)"
  Write-Output $line
  Start-Sleep -Seconds 120
}
