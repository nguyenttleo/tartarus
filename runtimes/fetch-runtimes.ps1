# Download the WASI interpreter runtimes listed in runtimes.lock.
# Usage: pwsh runtimes/fetch-runtimes.ps1   (or)   powershell -File runtimes\fetch-runtimes.ps1
$ErrorActionPreference = 'Stop'

$here = Split-Path -Parent $MyInvocation.MyCommand.Path
$lock = Join-Path $here 'runtimes.lock'
if (-not (Test-Path $lock)) { throw "missing $lock" }

Get-Content $lock | ForEach-Object {
    $line = $_.Trim()
    if ($line -eq '' -or $line.StartsWith('#')) { return }

    $parts = $line.Split('|')
    $name = $parts[0].Trim()
    $url  = $parts[1].Trim()
    $want = if ($parts.Count -ge 3) { $parts[2].Trim() } else { 'AUTO' }

    $dest = Join-Path $here $name
    if (Test-Path $dest) {
        Write-Host "✓ $name already present"
    } else {
        Write-Host "↓ $name <- $url"
        Invoke-WebRequest -Uri $url -OutFile $dest
    }

    $got = (Get-FileHash -Algorithm SHA256 $dest).Hash.ToLower()
    if ($want -eq 'AUTO' -or $want -eq '') {
        Write-Host "  sha256=$got  (paste into runtimes.lock to pin)"
    } elseif ($got -ne $want.ToLower()) {
        throw "checksum mismatch for $name: got $got, want $want"
    } else {
        Write-Host "  ✓ checksum verified"
    }
}

Write-Host "runtimes ready in $here"
