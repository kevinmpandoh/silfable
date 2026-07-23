param(
  [Parameter(Mandatory = $true)]
  [string]$Executable
)

$ErrorActionPreference = "Stop"
$resolvedExecutable = (Resolve-Path -LiteralPath $Executable).Path
$listener = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Loopback, 0)
$listener.Start()
$port = ([System.Net.IPEndPoint]$listener.LocalEndpoint).Port
$listener.Stop()
$profile = Join-Path $env:RUNNER_TEMP ("silfable-win-smoke-" + [guid]::NewGuid().ToString("N"))
$stdout = Join-Path $profile "stdout.log"
$stderr = Join-Path $profile "stderr.log"
New-Item -ItemType Directory -Path $profile | Out-Null

$process = $null
try {
  $arguments = @(
    "--user-data-dir=$profile",
    "--remote-debugging-address=127.0.0.1",
    "--remote-debugging-port=$port"
  )
  $process = Start-Process -FilePath $resolvedExecutable -ArgumentList $arguments -PassThru -WindowStyle Hidden -RedirectStandardOutput $stdout -RedirectStandardError $stderr
  node scripts/assert-electron-renderer.mjs "http://127.0.0.1:$port"
  if ($process.HasExited) { throw "Packaged Electron process exited during smoke QA." }
  Write-Host "Windows packaged renderer and secure preload bridge passed smoke QA."
}
finally {
  if ($null -ne $process -and -not $process.HasExited) {
    Stop-Process -Id $process.Id -Force
    $process.WaitForExit()
  }
  if (Test-Path -LiteralPath $stderr) {
    Get-Content -LiteralPath $stderr | Write-Host
  }
}
