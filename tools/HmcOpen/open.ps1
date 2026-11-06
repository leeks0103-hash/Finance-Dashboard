# 대시보드 "파일 열기 도구" — hmcopen:// 주소를 받아 이 PC에서 NAS 보고서(PPT)나 그 폴더를 연다.
# 브라우저는 웹페이지가 PC 프로그램을 직접 못 열게 막아서, 설치(install.bat) 때 hmcopen:// 주소를 이 스크립트에 연결해 둔다.
#
# ⚠️ 보안: 이 주소는 아무 웹페이지나 만들어 보낼 수 있으므로 **주소 안의 경로를 믿지 않는다.**
#   - 허용 폴더(root.txt — 서버가 zip을 만들 때 NAS 보고서 폴더로 채움) 아래의 PPT 파일만 연다(.exe·스크립트 등 다른 건 거절)
#   - ..·슬래시 섞임은 GetFullPath로 정리한 뒤 허용 폴더 안인지 다시 검사
#   - 파일은 읽기만(열기) 하고 NAS에 쓰지 않는다
# 이 파일은 UTF-8(BOM)으로 저장돼 있어야 한글 메시지가 안 깨진다.
param([string]$Url)

$ErrorActionPreference = 'Stop'
$dir = Split-Path -Parent $MyInvocation.MyCommand.Path

function Show-Msg([string]$text, [int]$icon = 48) {
    if ($env:HMCOPEN_QUIET) { return }   # 자동 테스트용 — 팝업 없이 종료 코드만
    try { (New-Object -ComObject WScript.Shell).Popup($text, 12, '대시보드 파일 열기', $icon) | Out-Null } catch { }
}

try {
    $u = ([string]$Url).Trim().Trim('"')

    # 설치 확인용 — 아무것도 열지 않고 정상 종료(설치 프로그램이 호출)
    if ($u -match '^hmcopen:/*ping/?$') { exit 0 }

    if ($u -notmatch '^hmcopen:/*([fd])/([A-Za-z0-9_-]+)/?$') {
        Show-Msg '알 수 없는 열기 주소입니다.' 16
        exit 2
    }
    $kind = $Matches[1]                    # f = 파일 열기, d = 폴더 열고 파일 선택
    $b64  = $Matches[2].Replace('-', '+').Replace('_', '/')
    switch ($b64.Length % 4) {
        1 { throw '주소가 올바르지 않습니다.' }
        2 { $b64 += '==' }
        3 { $b64 += '=' }
    }
    $path = [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String($b64))
    if ($path -match '[\x00-\x1f]') { Show-Msg '열 수 없는 경로입니다.' 16; exit 2 }

    $rootFile = Join-Path $dir 'root.txt'
    if (-not (Test-Path -LiteralPath $rootFile)) { Show-Msg '설정 파일(root.txt)이 없습니다. 도구를 다시 설치해 주세요.' 16; exit 3 }
    $root = [IO.Path]::GetFullPath((Get-Content -LiteralPath $rootFile -Encoding UTF8 -TotalCount 1).Trim()).TrimEnd('\')

    $full = [IO.Path]::GetFullPath($path)
    if (-not $full.StartsWith($root + '\', [StringComparison]::OrdinalIgnoreCase)) {
        Show-Msg '허용된 보고서 폴더 밖의 파일이라 열지 않았습니다.' 16
        exit 2
    }
    $ext = [IO.Path]::GetExtension($full).ToLowerInvariant()
    if (@('.ppt', '.pptx', '.pptm', '.pps', '.ppsx') -notcontains $ext) {
        Show-Msg '파워포인트 파일만 열 수 있습니다.' 16
        exit 2
    }
    if (-not (Test-Path -LiteralPath $full -PathType Leaf)) {
        Show-Msg ("파일을 찾을 수 없거나 NAS 접근 권한이 없습니다.`n`n" + $full) 48
        exit 4
    }

    if ($kind -eq 'd') {
        Start-Process -FilePath 'explorer.exe' -ArgumentList ('/select,"' + $full + '"')
    } else {
        Start-Process -FilePath $full
    }
    exit 0
} catch {
    Show-Msg ("열지 못했습니다.`n`n" + $_.Exception.Message) 16
    exit 1
}
