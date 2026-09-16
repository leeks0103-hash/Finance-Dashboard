@echo off
chcp 65001 > nul
setlocal
set ROOT=C:\Users\aaa\coding\dashboard
set PYTHON=C:\Python314\python.exe

REM PPT 폴더 인수를 넘기지 않음 — 각 스크립트가 .env(EXTRACT_BASE_DIR/EXTRACT_KPI_ROOT_DIR)를
REM 직접 읽도록 함. 여기서 하드코딩하면 .env를 바꿔도 무시됨(2026-09-16 버그)
echo [1/3] 재무 데이터 추출...
"%PYTHON%" "%ROOT%\scripts\extract_financial_ppt.py"
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] 재무 추출 실패
    exit /b 1
)

echo [2/3] KPI 데이터 추출...
"%PYTHON%" "%ROOT%\scripts\extract_kpi_ppt.py"
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] KPI 추출 실패
    exit /b 1
)

echo [3/3] API 캐시 갱신...
curl -s -X POST http://localhost:5000/api/reload
echo.
echo [OK] 대시보드 업데이트 완료
endlocal & exit /b 0
