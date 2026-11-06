@echo off
rem Dashboard file-open tool installer (no admin rights needed). Korean messages come from install.ps1.
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0install.ps1"
echo.
pause
