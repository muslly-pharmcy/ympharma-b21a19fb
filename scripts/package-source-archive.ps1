param(
  [string]$ArchiveName = "ympharma-android-build-source-v13-2026-08-16.zip"
)

$ErrorActionPreference = "Stop"
$workspaceRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$artifactDirectory = Join-Path $workspaceRoot "artifacts"
$zipTarget = Join-Path $artifactDirectory $ArchiveName

New-Item -ItemType Directory -Force -Path $artifactDirectory | Out-Null
if (Test-Path -LiteralPath $zipTarget) {
  Remove-Item -LiteralPath $zipTarget -Force
}

Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem

$archiveStream = [System.IO.File]::Open($zipTarget, [System.IO.FileMode]::CreateNew)
$archive = [System.IO.Compression.ZipArchive]::new(
  $archiveStream,
  [System.IO.Compression.ZipArchiveMode]::Create,
  $false,
  [System.Text.Encoding]::UTF8
)

try {
  $allFiles = Get-ChildItem -LiteralPath $workspaceRoot -Recurse -File -Force
  foreach ($file in $allFiles) {
    $relativePath = [System.IO.Path]::GetRelativePath($workspaceRoot, $file.FullName).Replace("\", "/")

    if ($relativePath -match "^(node_modules|\.git|\.output|dist|artifacts)/") { continue }
    if ($relativePath -match "^android/(\.gradle|build|app/build)/") { continue }
    if ($relativePath -in @(".env", ".env.local")) { continue }
    if ($relativePath -match "(^|/)(work-log|build-log|test-log)(\.|$)") { continue }

    [System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile(
      $archive,
      $file.FullName,
      $relativePath,
      [System.IO.Compression.CompressionLevel]::Optimal
    ) | Out-Null
  }
}
finally {
  $archive.Dispose()
  $archiveStream.Dispose()
}

$zip = [System.IO.Compression.ZipFile]::OpenRead($zipTarget)
try {
  $names = @($zip.Entries | ForEach-Object FullName)
  [ordered]@{
    Path = $zipTarget
    Size = (Get-Item -LiteralPath $zipTarget).Length
    SHA256 = (Get-FileHash -Algorithm SHA256 -LiteralPath $zipTarget).Hash
    Entries = $names.Count
    HasArabicNames = [bool]($names | Where-Object { $_ -match "[\u0600-\u06FF]" } | Select-Object -First 1)
    HasEnv = [bool]($names -contains ".env")
    HasEnvLocal = [bool]($names -contains ".env.local")
    HasEnvExample = [bool]($names -contains ".env.example")
    HasNodeModules = [bool]($names | Where-Object { $_ -like "node_modules/*" } | Select-Object -First 1)
    HasAndroidIndex = [bool]($names -contains "android/app/src/main/assets/public/index.html")
  } | ConvertTo-Json -Compress
}
finally {
  $zip.Dispose()
}
