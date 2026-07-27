param(
  [string]$Executable = "apps/desktop/release/win-unpacked/silfable.exe",
  [string]$EvidenceDirectory = ""
)

$ErrorActionPreference = "Stop"
$repoRoot = (Resolve-Path -LiteralPath ".").Path
$resolvedExecutable = (Resolve-Path -LiteralPath $Executable).Path
$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"

if ([string]::IsNullOrWhiteSpace($EvidenceDirectory)) {
  $EvidenceDirectory = Join-Path $repoRoot "artifacts/p2-windows/$timestamp"
}
elseif (-not [System.IO.Path]::IsPathRooted($EvidenceDirectory)) {
  $EvidenceDirectory = Join-Path $repoRoot $EvidenceDirectory
}

$evidencePath = [System.IO.Path]::GetFullPath($EvidenceDirectory)
$profilePath = Join-Path $evidencePath "isolated-profile"
New-Item -ItemType Directory -Path $profilePath -Force | Out-Null

$installer = Get-ChildItem -LiteralPath (Join-Path $repoRoot "apps/desktop/release") `
  -Filter "Silfable-*-windows-x64-setup.exe" -File -ErrorAction SilentlyContinue |
  Where-Object { $_.Length -gt 50000000 } |
  Select-Object -First 1
$authenticode = Get-AuthenticodeSignature -LiteralPath $resolvedExecutable
$manifest = [ordered]@{
  schemaVersion = 1
  startedAt = (Get-Date).ToUniversalTime().ToString("o")
  machine = $env:COMPUTERNAME
  executable = $resolvedExecutable
  executableSha256 = (Get-FileHash -LiteralPath $resolvedExecutable -Algorithm SHA256).Hash
  authenticodeStatus = [string]$authenticode.Status
  authenticodeSubject = if ($null -eq $authenticode.SignerCertificate) { $null } else { $authenticode.SignerCertificate.Subject }
  installer = if ($null -eq $installer) { $null } else { $installer.FullName }
  installerSha256 = if ($null -eq $installer) { $null } else { (Get-FileHash -LiteralPath $installer.FullName -Algorithm SHA256).Hash }
  isolatedProfile = $profilePath
  processId = $null
  checklist = "docs/desktop/P2_WINDOWS_ACCEPTANCE.md"
}

$arguments = @("--user-data-dir=$profilePath")
$process = Start-Process -FilePath $resolvedExecutable -ArgumentList $arguments -PassThru
$manifest.processId = $process.Id
$manifest | ConvertTo-Json -Depth 4 |
  Set-Content -LiteralPath (Join-Path $evidencePath "manifest.json") -Encoding utf8

@"
Silfable Windows P2 QA

Evidence folder: $evidencePath
Isolated profile: $profilePath
Process ID: $($process.Id)

Follow docs/desktop/P2_WINDOWS_ACCEPTANCE.md.
Never paste a seed phrase, private key, API key, or master password into this folder.
The launcher does not execute or approve a transaction.
"@ | Set-Content -LiteralPath (Join-Path $evidencePath "README.txt") -Encoding utf8

Write-Host "Silfable P2 QA launched with an isolated profile."
Write-Host "Evidence: $evidencePath"
Write-Host "Checklist: docs/desktop/P2_WINDOWS_ACCEPTANCE.md"
Write-Host "Authenticode: $($authenticode.Status)"
