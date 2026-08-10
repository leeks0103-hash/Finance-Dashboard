$env:PYTHONUTF8 = '1'
$base = 'Y:\!★ 신규 폴더 구조\1. 실 공통\2. 매뉴얼'
$out  = 'D:\ngv_dashbord\Finance-Dashboard\data\manual_tree.csv'

Get-ChildItem -Path $base -Recurse |
    Select-Object @{N='유형';E={if($_.PSIsContainer){'폴더'}else{'파일'}}},
                  @{N='깊이';E={($_.FullName -replace [regex]::Escape($base),'').Split('\').Count - 1}},
                  Name, Extension,
                  @{N='크기(KB)';E={if($_.PSIsContainer){'-'}else{[math]::Round($_.Length/1KB,1)}}},
                  FullName |
    Export-Csv -Path $out -Encoding UTF8 -NoTypeInformation

Write-Host '스캔 완료'