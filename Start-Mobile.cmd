@echo off
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\Start-Local.ps1" -NoBrowser -RequireLan %*
if errorlevel 1 (
  pause
  exit /b 1
)
