@echo off
REM ============================================================
REM  Almosly Pharmacy - Oracle inventory sync launcher
REM  Run this file on the pharmacy computer that can reach Oracle.
REM  It never writes to Oracle: read-only SELECT queries only.
REM ============================================================
chcp 65001 >nul
setlocal

set "SCRIPT_DIR=%~dp0"
set "PS32=%SystemRoot%\SysWOW64\WindowsPowerShell\v1.0\powershell.exe"
if not exist "%PS32%" set "PS32=powershell.exe"

echo.
echo  === مزامنة مخزون صيدلية المصلي ===
echo.
echo  [1] فحص الاتصال فقط (بدون إرسال بيانات)
echo  [2] مزامنة فعلية (إرسال الكميات والأسعار إلى الموقع)
echo.
set /p CHOICE=اختر رقم العملية ثم اضغط Enter:

if "%CHOICE%"=="1" (
  "%PS32%" -NoProfile -ExecutionPolicy Bypass -File "%SCRIPT_DIR%oracle-supabase-sync.ps1" -ValidateOnly
) else (
  "%PS32%" -NoProfile -ExecutionPolicy Bypass -File "%SCRIPT_DIR%oracle-supabase-sync.ps1" -Apply
)

echo.
echo  انتهت العملية. اضغط أي زر للإغلاق.
pause >nul
endlocal
