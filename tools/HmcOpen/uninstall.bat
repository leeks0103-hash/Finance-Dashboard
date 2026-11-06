@echo off
rem Removes the dashboard file-open tool (current user only).
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0install.ps1" -Uninstall
echo.
pause
