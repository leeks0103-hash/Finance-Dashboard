@echo off
set PYTHONUTF8=1
set PYTHONIOENCODING=utf-8

powershell -ExecutionPolicy Bypass -File "D:\ngv_dashbord\Finance-Dashboard\scripts\scan_manual_folder.ps1"
python "D:\ngv_dashbord\Finance-Dashboard\scripts\make_manual_map.py"
