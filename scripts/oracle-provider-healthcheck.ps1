[CmdletBinding()]
param(
  [string]$DataSource = 'HEADER',
  [string]$OracleUser,
  [Security.SecureString]$OraclePassword,
  [switch]$ProviderOnly
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

if ([IntPtr]::Size -ne 4) {
  throw 'OraOLEDB is installed as 32-bit. Run this script with C:\Windows\SysWOW64\WindowsPowerShell\v1.0\powershell.exe.'
}

$connection = $null
$recordset = $null
$passwordPointer = [IntPtr]::Zero

try {
  $connection = New-Object -ComObject ADODB.Connection
  $connection.Provider = 'OraOLEDB.Oracle'
  $connection.Mode = 1 # adModeRead

  if ($ProviderOnly) {
    [pscustomobject]@{
      Provider = 'OraOLEDB.Oracle'
      Architecture = 'x86'
      ProviderAvailable = $true
      DatabaseLoginAttempted = $false
    }
    return
  }

  if ([string]::IsNullOrWhiteSpace($OracleUser)) {
    $OracleUser = Read-Host 'Oracle read-only username'
  }
  if ($null -eq $OraclePassword) {
    $OraclePassword = Read-Host 'Oracle password' -AsSecureString
  }

  $passwordPointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($OraclePassword)
  $plainPassword = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($passwordPointer)

  # Open(data source, user, password) avoids persisting a connection string.
  $connection.Open($DataSource, $OracleUser, $plainPassword)
  $recordset = $connection.Execute('SELECT 1 AS HEALTHCHECK FROM DUAL')
  $healthValue = [int]$recordset.Fields.Item('HEALTHCHECK').Value

  [pscustomobject]@{
    Provider = 'OraOLEDB.Oracle'
    Architecture = 'x86'
    DataSource = $DataSource
    Connected = ($connection.State -eq 1)
    ReadOnlyQuerySucceeded = ($healthValue -eq 1)
  }
}
catch {
  $message = [string]$_.Exception.Message
  $oracleCode = $null
  if ($message -match '(ORA|TNS)-\d+') {
    $oracleCode = $Matches[0]
  }

  [pscustomobject]@{
    Provider = 'OraOLEDB.Oracle'
    Architecture = 'x86'
    DataSource = $DataSource
    Connected = $false
    OracleCode = $oracleCode
    Error = if ($oracleCode) { 'Oracle connection failed' } else { 'Provider or connection check failed' }
  }
  exit 1
}
finally {
  if ($recordset -and $recordset.State -eq 1) {
    $recordset.Close()
  }
  if ($connection -and $connection.State -eq 1) {
    $connection.Close()
  }
  if ($passwordPointer -ne [IntPtr]::Zero) {
    [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($passwordPointer)
  }
  Remove-Variable plainPassword -ErrorAction SilentlyContinue
}
