[CmdletBinding()]
param(
  [string]$DataSource = 'HEADER',
  [string]$OracleUser,
  [Security.SecureString]$OraclePassword,
  [string]$OutputPath,
  [ValidateRange(10, 500)][int]$MaxCandidates = 150,
  [switch]$ValidateOnly
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

if ([IntPtr]::Size -ne 4) {
  throw 'OraOLEDB is 32-bit. Run with C:\Windows\SysWOW64\WindowsPowerShell\v1.0\powershell.exe.'
}

if ([string]::IsNullOrWhiteSpace($OutputPath)) {
  $timestamp = Get-Date -Format 'yyyyMMdd-HHmmss'
  $OutputPath = Join-Path $PSScriptRoot "..\reports\oracle-schema-discovery-$timestamp.json"
}

function Convert-RecordsetRows {
  param([Parameter(Mandatory = $true)]$Recordset)

  $rows = New-Object System.Collections.Generic.List[object]
  while (-not $Recordset.EOF) {
    $row = [ordered]@{}
    for ($index = 0; $index -lt $Recordset.Fields.Count; $index++) {
      $field = $Recordset.Fields.Item($index)
      $name = ([string]$field.Name).ToLowerInvariant()
      $value = $field.Value
      $row[$name] = if ($null -eq $value -or [Convert]::IsDBNull($value)) { $null } else { $value }
    }
    $rows.Add([pscustomobject]$row)
    $Recordset.MoveNext()
  }
  return @($rows)
}

$providerCheck = New-Object -ComObject ADODB.Connection
$providerCheck.Provider = 'OraOLEDB.Oracle'
$providerCheck.Mode = 1
$providerCheck = $null

if ($ValidateOnly) {
  [pscustomobject]@{
    Provider = 'OraOLEDB.Oracle'
    Architecture = 'x86'
    DataSource = $DataSource
    DatabaseLoginAttempted = $false
    DictionaryQueryAttempted = $false
    OutputWritten = $false
  }
  return
}

if ([string]::IsNullOrWhiteSpace($OracleUser)) {
  $OracleUser = Read-Host 'Oracle read-only username'
}
if ($null -eq $OraclePassword) {
  $OraclePassword = Read-Host 'Oracle password' -AsSecureString
}

$connection = $null
$recordset = $null
$passwordPointer = [IntPtr]::Zero

try {
  $passwordPointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($OraclePassword)
  $plainPassword = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($passwordPointer)

  $connection = New-Object -ComObject ADODB.Connection
  $connection.Provider = 'OraOLEDB.Oracle'
  $connection.Mode = 1
  $connection.Open($DataSource, $OracleUser, $plainPassword)

  $safeLimit = [Math]::Max(10, [Math]::Min(500, $MaxCandidates))
  $query = @"
SELECT *
FROM (
  SELECT
    c.OWNER AS owner_name,
    c.TABLE_NAME AS table_name,
    c.COLUMN_NAME AS column_name,
    c.DATA_TYPE AS data_type,
    c.DATA_LENGTH AS data_length,
    c.NULLABLE AS nullable,
    CASE
      WHEN REGEXP_LIKE(UPPER(c.COLUMN_NAME), '(^|_)(ITEM|PRODUCT|DRUG|MEDICINE)(_)?(ID|CODE|NO|NAME)?($|_)') THEN 'product'
      WHEN REGEXP_LIKE(UPPER(c.COLUMN_NAME), 'BAR.?CODE|EAN|UPC|GTIN') THEN 'barcode'
      WHEN REGEXP_LIKE(UPPER(c.COLUMN_NAME), 'WAREHOUSE|STORE|BRANCH|LOCATION') THEN 'warehouse'
      WHEN REGEXP_LIKE(UPPER(c.COLUMN_NAME), 'BATCH|LOT|EXPIR|VALID') THEN 'batch_expiry'
      WHEN REGEXP_LIKE(UPPER(c.COLUMN_NAME), 'QTY|QUANTITY|BALANCE|ON_HAND|STOCK') THEN 'quantity'
      WHEN REGEXP_LIKE(UPPER(c.COLUMN_NAME), 'PRICE|COST|SELL') THEN 'price'
      WHEN REGEXP_LIKE(UPPER(c.COLUMN_NAME), 'UPDAT|MODIF|CHANG') THEN 'updated_at'
      ELSE 'other'
    END AS semantic_group
  FROM ALL_TAB_COLUMNS c
  WHERE c.OWNER NOT IN ('SYS', 'SYSTEM', 'XDB', 'MDSYS', 'CTXSYS', 'ORDSYS', 'WMSYS')
    AND (
      REGEXP_LIKE(UPPER(c.TABLE_NAME), 'ITEM|PRODUCT|DRUG|MEDICINE|STOCK|INVENT|BATCH|WAREHOUSE|STORE')
      OR REGEXP_LIKE(UPPER(c.COLUMN_NAME), 'ITEM|PRODUCT|DRUG|MEDICINE|BAR.?CODE|EAN|UPC|GTIN|WAREHOUSE|BATCH|LOT|EXPIR|QTY|QUANTITY|STOCK|PRICE|COST')
    )
  ORDER BY
    CASE
      WHEN REGEXP_LIKE(UPPER(c.TABLE_NAME), 'ITEM|PRODUCT|DRUG|MEDICINE') THEN 1
      WHEN REGEXP_LIKE(UPPER(c.TABLE_NAME), 'STOCK|INVENT|BATCH') THEN 2
      ELSE 3
    END,
    c.OWNER,
    c.TABLE_NAME,
    c.COLUMN_ID
)
WHERE ROWNUM <= $safeLimit
"@

  $recordset = $connection.Execute($query)
  $columns = @(Convert-RecordsetRows -Recordset $recordset)
  $recordset.Close()
  $recordset = $null

  $tables = @($columns | Group-Object owner_name, table_name | ForEach-Object {
    $first = $_.Group | Select-Object -First 1
    [pscustomobject]@{
      owner = [string]$first.owner_name
      table = [string]$first.table_name
      score = @($_.Group | Where-Object { $_.semantic_group -ne 'other' }).Count
      groups = @($_.Group.semantic_group | Where-Object { $_ -ne 'other' } | Sort-Object -Unique)
      columns = @($_.Group | Select-Object column_name, data_type, data_length, nullable, semantic_group)
    }
  } | Sort-Object -Property @{ Expression = 'score'; Descending = $true }, owner, table)

  $report = [ordered]@{
    generatedAt = [DateTimeOffset]::UtcNow.ToString('o')
    source = $DataSource
    oracleUser = $OracleUser
    readOnly = $true
    containsRowData = $false
    candidateTableCount = $tables.Count
    candidateColumnCount = $columns.Count
    candidates = $tables
  }

  $resolvedOutput = [IO.Path]::GetFullPath($OutputPath)
  $outputDirectory = Split-Path -Parent $resolvedOutput
  if (-not (Test-Path -LiteralPath $outputDirectory)) {
    New-Item -ItemType Directory -Path $outputDirectory -Force | Out-Null
  }
  $report | ConvertTo-Json -Depth 12 | Set-Content -LiteralPath $resolvedOutput -Encoding UTF8

  [pscustomobject]@{
    DataSource = $DataSource
    OracleUser = $OracleUser
    CandidateTables = $tables.Count
    CandidateColumns = $columns.Count
    ContainsRowData = $false
    OracleWrites = 0
    OutputPath = $resolvedOutput
  }
}
finally {
  if ($recordset -and $recordset.State -eq 1) { $recordset.Close() }
  if ($connection -and $connection.State -eq 1) { $connection.Close() }
  if ($passwordPointer -ne [IntPtr]::Zero) { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($passwordPointer) }
  Remove-Variable plainPassword -ErrorAction SilentlyContinue
}
