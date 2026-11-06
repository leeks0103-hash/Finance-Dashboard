# 대시보드 "파일 열기 도구" 설치/제거 — 관리자 권한 필요 없음(현재 사용자 설정 HKCU에만 등록).
# 하는 일: ① %LOCALAPPDATA%\HmcOpen 에 파일 복사 ② hmcopen:// 주소를 launch.vbs에 연결(레지스트리) ③ 동작 확인
#         ④ 확인되면 대시보드를 열어 "이 브라우저에서 설치됨"을 표시(url.txt가 있을 때) — 그러면 파일·폴더 바로가기 버튼이 보임
# 이 파일은 UTF-8(BOM)으로 저장돼 있어야 한글 메시지가 안 깨진다.
param([switch]$Uninstall)

$ErrorActionPreference = 'Stop'
$target = Join-Path $env:LOCALAPPDATA 'HmcOpen'
$key = 'HKCU:\Software\Classes\hmcopen'

if ($Uninstall) {
    Remove-Item -LiteralPath $key -Recurse -Force -ErrorAction SilentlyContinue
    Remove-Item -LiteralPath $target -Recurse -Force -ErrorAction SilentlyContinue
    Write-Host '파일 열기 도구를 제거했습니다.'
    exit 0
}

try {
    $src = Split-Path -Parent $MyInvocation.MyCommand.Path
    foreach ($f in 'open.ps1', 'launch.vbs', 'root.txt') {
        if (-not (Test-Path -LiteralPath (Join-Path $src $f))) {
            throw "설치 파일이 빠져 있습니다: $f  (zip을 풀지 않고 실행했거나 일부만 복사하지 않았는지 확인해 주세요)"
        }
    }

    New-Item -ItemType Directory -Force -Path $target | Out-Null
    foreach ($f in 'open.ps1', 'launch.vbs', 'root.txt') {
        Copy-Item -LiteralPath (Join-Path $src $f) -Destination $target -Force
    }
    Get-ChildItem -LiteralPath $target | Unblock-File -ErrorAction SilentlyContinue   # 인터넷에서 받은 파일 표시 제거

    New-Item -Path $key -Force | Out-Null
    Set-ItemProperty -Path $key -Name '(default)' -Value 'URL:Dashboard File Open'
    Set-ItemProperty -Path $key -Name 'URL Protocol' -Value ''
    New-Item -Path "$key\shell\open\command" -Force | Out-Null
    Set-ItemProperty -Path "$key\shell\open\command" -Name '(default)' `
        -Value ('wscript.exe //B //Nologo "' + (Join-Path $target 'launch.vbs') + '" "%1"')

    # 실제 등록된 명령 그대로 한 번 돌려 봄 — 회사 보안 정책이 스크립트 실행을 막으면 여기서 걸림
    $p = Start-Process -FilePath 'wscript.exe' -Wait -PassThru `
        -ArgumentList '//B', '//Nologo', ('"' + (Join-Path $target 'launch.vbs') + '"'), 'hmcopen://ping'
    if ($p.ExitCode -ne 0) {
        throw "설치는 됐지만 동작 확인에 실패했습니다(코드 $($p.ExitCode)). 회사 보안 정책이 스크립트 실행을 막고 있을 수 있어요 — IT 담당자에게 문의해 주세요."
    }

    Write-Host ''
    Write-Host '설치가 끝났습니다. 대시보드에서 파일·폴더 바로가기를 쓸 수 있어요.'
    Write-Host '(처음 열 때 브라우저가 "열도록 허용할까요?"라고 물으면 "항상 허용"을 선택하세요.)'

    # 대시보드 화면에 "설치됨"을 알림 — 브라우저는 PC 설치 여부를 직접 볼 수 없어서, 설치가 끝났다는 표시를 이 주소로 남김
    $urlFile = Join-Path $src 'url.txt'
    if (Test-Path -LiteralPath $urlFile) {
        $dash = (Get-Content -LiteralPath $urlFile -Encoding UTF8 -TotalCount 1).Trim()
        if ($dash -match '^https?://[^\s?#]+$') {
            Start-Process ($dash.TrimEnd('/') + '/?opentool=1')
        }
    }
    exit 0
} catch {
    Write-Host ''
    Write-Host ('설치하지 못했습니다: ' + $_.Exception.Message) -ForegroundColor Red
    exit 1
}
