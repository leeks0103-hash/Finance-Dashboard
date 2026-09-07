# 현대 브랜드 폰트 배치

`frontend/src/index.css` 의 `@font-face` 가 이 폴더의 `.ttf` 파일을 **아래 파일명 그대로** 참조합니다.
폰트 파일은 라이선스/용량(약 22MB) 때문에 git 에 올리지 않습니다 — 각자 사내에서 받은 파일을
이 폴더(`frontend/public/fonts/`)에 아래 이름으로 복사하세요.

## 필요한 파일 (10개, 파일명 정확히 일치해야 함)

| 파일명 | 용도 |
|---|---|
| `HyundaiSansTextKRRegular.ttf` | 본문 (weight 400) |
| `HyundaiSansTextKRMedium.ttf`  | 본문 (weight 500) |
| `HyundaiSansTextKRBold.ttf`    | 본문 (weight 700) |
| `HyundaiSansHeadKRLight.ttf`   | 제목 (weight 300) |
| `HyundaiSansHeadKRRegular.ttf` | 제목 (weight 400) |
| `HyundaiSansHeadKRMedium.ttf`  | 제목 (weight 500) |
| `HyundaiSansHeadKRBold.ttf`    | 제목 (weight 700) |
| `HyundaiHarmony-Light.ttf`     | KPI 대형 수치 (weight 300) |
| `HyundaiHarmony-Medium.ttf`    | KPI 대형 수치 (weight 500) |
| `HyundaiHarmony-Bold.ttf`      | KPI 대형 수치 (weight 700) |

받은 파일 이름이 다르면(예: `HyundaiSansText-Regular.ttf`, `.otf`) **위 이름으로 rename** 하거나
`index.css` 의 `src: url(...)` 경로를 실제 파일명에 맞게 고치세요.

## 폰트를 안 넣으면?

`index.css` 폴백 체인(`'Malgun Gothic', 'Apple SD Gothic Neo', sans-serif`)으로 표시됩니다 —
대시보드 기능은 정상 동작하고 서체만 맑은고딕으로 보입니다. (dev/build 에러 아님)

## 배치 후

`npm run dev` / `npm run build` 재시작하면 바로 반영됩니다 (Vite `public/` 은 그대로 서빙).
