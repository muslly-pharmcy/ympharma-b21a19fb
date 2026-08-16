[CmdletBinding()]
param(
  [string]$DataSource = 'HEADER',
  [string]$OracleUser,
  [Security.SecureString]$OraclePassword,
  [string]$MappingPath,
  [string]$EndpointUrl,
  [Security.SecureString]$SyncSecret,
  [ValidateRange(1, 500)][int]$BatchSize = 200,
  [switch]$Apply,
  [switch]$ValidateOnly
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

if ([string]::IsNullOrWhiteSpace($MappingPath)) {
  $MappingPath = Join-Path $PSScriptRoot '..\config\oracle-sync.mapping.example.json'
}

function Test-ReadOnlyQuery {
  param([Parameter(Mandatory = $true)][string]$Query)

  if ($Query -notmatch '^\s*SELECT\b') {
    throw 'Every Oracle mapping query must begin with SELECT.'
  }
  if ($Query -match '\b(INSERT|UPDATE|DELETE|MERGE|ALTER|DROP|TRUNCATE|GRANT|REVOKE|EXECUTE|BEGIN|COMMIT|ROLLBACK)\b') {
    throw 'A mapping query contains a prohibited write or control keyword.'
  }
}

function Get-Sha256Hex {
  param([Parameter(Mandatory = $true)][string]$Value)

  $sha = [Security.Cryptography.SHA256]::Create()
  try {
    $bytes = [Text.Encoding]::UTF8.GetBytes($Value)
    return ([BitConverter]::ToString($sha.ComputeHash($bytes))).Replace('-', '').ToLowerInvariant()
  }
  finally {
    $sha.Dispose()
  }
}

function Get-HmacHex {
  param(
    [Parameter(Mandatory = $true)][byte[]]$SecretBytes,
    [Parameter(Mandatory = $true)][string]$Value
  )

  $hmac = New-Object Security.Cryptography.HMACSHA256
  try {
    $hmac.Key = $SecretBytes
    $valueBytes = [Text.Encoding]::UTF8.GetBytes($Value)
    return ([BitConverter]::ToString($hmac.ComputeHash($valueBytes))).Replace('-', '').ToLowerInvariant()
  }
  finally {
    $hmac.Dispose()
  }
}

function Convert-RecordsetRows {
  param(
    [Parameter(Mandatory = $true)]$Recordset,
    [Parameter(Mandatory = $true)][int]$MaxRows
  )

  $rows = New-Object System.Collections.Generic.List[object]
  while (-not $Recordset.EOF -and $rows.Count -lt $MaxRows) {
    $row = [ordered]@{}
    for ($index = 0; $index -lt $Recordset.Fields.Count; $index++) {
      $field = $Recordset.Fields.Item($index)
      $name = ([string]$field.Name).ToLowerInvariant()
      $value = $field.Value
      if ($null -eq $value -or [Convert]::IsDBNull($value)) {
        $row[$name] = $null
      }
      elseif ($value -is [DateTime]) {
        $row[$name] = ([DateTime]$value).ToUniversalTime().ToString('o')
      }
      else {
        $row[$name] = $value
      }
    }
    $rows.Add([pscustomobject]$row)
    $Recordset.MoveNext()
  }
  return @($rows)
}

if ([IntPtr]::Size -ne 4) {
  throw 'OraOLEDB is 32-bit. Run with C:\Windows\SysWOW64\WindowsPowerShell\v1.0\powershell.exe.'
}

$resolvedMappingPath = (Resolve-Path -LiteralPath $MappingPath).Path
$mapping = Get-Content -LiteralPath $resolvedMappingPath -Raw | ConvertFrom-Json
if ($mapping.version -ne 1 -or [string]::IsNullOrWhiteSpace([string]$mapping.sourceSystem)) {
  throw 'Unsupported or invalid Oracle mapping file.'
}

$enabledEntities = @($mapping.entities | Where-Object { $_.enabled -eq $true })
foreach ($entity in @($mapping.entities)) {
  if (@('product', 'barcode', 'warehouse', 'stock_batch') -notcontains [string]$entity.entityType) {
    throw "Unsupported entity type: $($entity.entityType)"
  }
  Test-ReadOnlyQuery -Query ([string]$entity.query)
}

$providerCheck = New-Object -ComObject ADODB.Connection
$providerCheck.Provider = 'OraOLEDB.Oracle'
$providerCheck.Mode = 1
$providerCheck = $null

if ($ValidateOnly) {
  [pscustomobject]@{
    Provider = 'OraOLEDB.Oracle'
    Architecture = 'x86'
    MappingVersion = [int]$mapping.version
    SourceSystem = [string]$mapping.sourceSystem
    ConfiguredEntities = @($mapping.entities).Count
    EnabledEntities = $enabledEntities.Count
    DatabaseLoginAttempted = $false
    NetworkRequestAttempted = $false
  }
  return
}

if ($enabledEntities.Count -eq 0) {
  throw 'No mapping entities are enabled. Discover the Oracle views, update the mapping, and set enabled=true.'
}
if ([string]::IsNullOrWhiteSpace($EndpointUrl) -or $EndpointUrl -notmatch '^https://') {
  throw 'EndpointUrl must be the HTTPS URL of the oracle-sync-ingest Edge Function.'
}
if ([string]::IsNullOrWhiteSpace($OracleUser)) {
  $OracleUser = Read-Host 'Oracle read-only username'
}
if ($null -eq $OraclePassword) {
  $OraclePassword = Read-Host 'Oracle password' -AsSecureString
}
if ($null -eq $SyncSecret) {
  $SyncSecret = Read-Host 'Oracle sync HMAC secret' -AsSecureString
}

$connection = $null
$recordset = $null
$passwordPointer = [IntPtr]::Zero
$secretPointer = [IntPtr]::Zero
$secretBytes = $null

try {
  $passwordPointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($OraclePassword)
  $plainPassword = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($passwordPointer)
  $secretPointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($SyncSecret)
  $plainSecret = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($secretPointer)
  $secretBytes = [Text.Encoding]::UTF8.GetBytes($plainSecret)

  $connection = New-Object -ComObject ADODB.Connection
  $connection.Provider = 'OraOLEDB.Oracle'
  $connection.Mode = 1
  $connection.Open($DataSource, $OracleUser, $plainPassword)

  $mode = if ($Apply) { 'apply' } else { 'dry-run' }
  $totalRead = 0
  $totalSent = 0
  $batchNumber = 0
  $runId = [Guid]::NewGuid().ToString('N')

  foreach ($entity in $enabledEntities) {
    $recordset = $connection.Execute([string]$entity.query)
    $maxRows = if ($entity.maxRows) { [int]$entity.maxRows } else { 5000 }
    $rows = @(Convert-RecordsetRows -Recordset $recordset -MaxRows $maxRows)
    $recordset.Close()
    $recordset = $null
    $totalRead += $rows.Count

    for ($offset = 0; $offset -lt $rows.Count; $offset += $BatchSize) {
      $last = [Math]::Min($offset + $BatchSize - 1, $rows.Count - 1)
      $chunk = @($rows[$offset..$last])
      $syncRows = New-Object System.Collections.Generic.List[object]

      foreach ($row in $chunk) {
        $payload = [ordered]@{}
        foreach ($property in $row.PSObject.Properties) {
          $payload[$property.Name.ToLowerInvariant()] = $property.Value
        }
        $sourceKeyColumn = ([string]$entity.sourceKeyColumn).ToLowerInvariant()
        $sourceKey = [string]$payload[$sourceKeyColumn]
        if ([string]::IsNullOrWhiteSpace($sourceKey)) {
          throw "Oracle row is missing source key column '$sourceKeyColumn' for $($entity.entityType)."
        }

        $sourceUpdatedAt = $null
        if ($entity.sourceUpdatedAtColumn) {
          $sourceUpdatedAt = $payload[([string]$entity.sourceUpdatedAtColumn).ToLowerInvariant()]
        }
        $payloadJson = $payload | ConvertTo-Json -Depth 12 -Compress
        $idempotencyMaterial = '{0}|{1}|{2}|{3}' -f $mapping.sourceSystem, $entity.entityType, $sourceKey, $payloadJson
        $syncRows.Add([pscustomobject]@{
          entityType = [string]$entity.entityType
          sourceKey = $sourceKey
          sourceUpdatedAt = $sourceUpdatedAt
          idempotencyKey = Get-Sha256Hex -Value $idempotencyMaterial
          payload = $payload
        })
      }

      $batchNumber++
      $batchId = '{0}-{1:d5}' -f $runId, $batchNumber
      $body = [ordered]@{
        batchId = $batchId
        sourceSystem = [string]$mapping.sourceSystem
        mode = $mode
        rows = @($syncRows)
      } | ConvertTo-Json -Depth 16 -Compress

      $timestamp = [DateTimeOffset]::UtcNow.ToUnixTimeSeconds().ToString()
      $signature = Get-HmacHex -SecretBytes $secretBytes -Value ($timestamp + '.' + $body)
      $headers = @{
        'x-sync-timestamp' = $timestamp
        'x-sync-signature' = $signature
      }
      $bodyBytes = [Text.Encoding]::UTF8.GetBytes($body)
      $response = Invoke-WebRequest -Uri $EndpointUrl -Method Post -Headers $headers -ContentType 'application/json; charset=utf-8' -Body $bodyBytes -UseBasicParsing
      $result = $response.Content | ConvertFrom-Json
      $totalSent += $syncRows.Count

      [pscustomobject]@{
        BatchId = $batchId
        EntityType = [string]$entity.entityType
        Mode = $mode
        Sent = $syncRows.Count
        Applied = [int]$result.applied
        StagedOnly = if ($null -ne $result.stagedOnly) { [int]$result.stagedOnly } else { $syncRows.Count }
      }
    }
  }

  [pscustomobject]@{
    SourceSystem = [string]$mapping.sourceSystem
    Mode = $mode
    RowsRead = $totalRead
    RowsSent = $totalSent
    Batches = $batchNumber
    OracleWrites = 0
  }
}
finally {
  if ($recordset -and $recordset.State -eq 1) { $recordset.Close() }
  if ($connection -and $connection.State -eq 1) { $connection.Close() }
  if ($secretBytes) { [Array]::Clear($secretBytes, 0, $secretBytes.Length) }
  if ($passwordPointer -ne [IntPtr]::Zero) { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($passwordPointer) }
  if ($secretPointer -ne [IntPtr]::Zero) { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($secretPointer) }
  Remove-Variable plainPassword, plainSecret -ErrorAction SilentlyContinue
}
