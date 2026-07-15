@echo off
chcp 65001 > nul
echo ====================================
echo  재무 대시보드 서버 시작
echo ====================================

:: 방화벽 규칙 추가 (이미 있으면 무시)
netsh advfirewall firewall add rule name="Dashboard_5000" dir=in action=allow protocol=TCP localport=5000 > nul 2>&1

echo.
echo [접속 주소]
echo  - 이 PC: http://localhost:5000
echo  - 사내 직원 접속용 IP:
for /f "tokens=2 delims=:" %%a in ('ipconfig ^| findstr "IPv4"') do (
    echo    http://%%a:5000
)
echo.
echo 서버를 시작합니다... (종료하려면 이 창을 닫으세요)
echo.

cd /d "D:\dashboard"
python app.py
pause
