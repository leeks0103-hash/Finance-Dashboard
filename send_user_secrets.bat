@echo off
setlocal
REM Dashboard secret key mail - menu is in scripts\send_user_secrets.py (Outlook must be running)
set "ROOT=%~dp0"
set PYTHON=
if exist "%ROOT%.env" for /f "usebackq tokens=1,* delims==" %%A in ("%ROOT%.env") do if /i "%%A"=="PYTHON_EXE" set "PYTHON=%%B"
if not defined PYTHON if exist "C:\Python314\python.exe" set "PYTHON=C:\Python314\python.exe"
if not defined PYTHON set "PYTHON=python"
cd /d "%ROOT%"
set PYTHONIOENCODING=utf-8
"%PYTHON%" scripts\send_user_secrets.py --menu
pause
endlocal
