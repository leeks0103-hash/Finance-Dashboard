# 기술교육실 프로젝트 재무 대시보드

기술교육실 프로젝트의 재무 현황·KPI·사업 실적을 한 화면에서 모니터링하는 내부용 대시보드입니다.

---

## 데이터 흐름

```
┌─────────────────────────────────────────────────────────────┐
│                     데이터 업데이트 흐름                       │
└─────────────────────────────────────────────────────────────┘

  [기존 PPT 폴더]        [새 PPT 폴더]
        │                      │
        └──────────┬───────────┘
                   ▼
     compare_and_update.py   ← 명령 하나로 전체 자동화
                   │
          ┌────────┴────────┐
          │   파일 비교      │  file_compare.py
          │  (신규·수정 감지) │
          └────────┬────────┘
                   │
         변경 있음? ├── 없음 → "변경 없음" 종료
                   │
                   ▼
     extract_financial_ppt.py  (새 폴더 기준 재추출)
                   │
                   ▼
          data/재무관점 필수 데이터 추출.xlsx
                   │
                   ▼
          POST /api/reload  (Flask 캐시 자동 갱신)
                   │
                   ▼
           React 대시보드  (최신 데이터 반영)
```

---

## PPT 데이터 업데이트 방법 (가장 빠른 방법)

새 PPT 폴더를 받았을 때 **명령 하나**로 비교 → 추출 → 갱신이 자동으로 진행됩니다.

```powershell
python scripts/compare_and_update.py "기존폴더경로" "새폴더경로"
```

**예시:**
```powershell
python scripts/compare_and_update.py `
  "C:\Users\aaa\Desktop\기술교육실_프로젝트 보고서 수집" `
  "C:\Users\aaa\Desktop\기술교육실_프로젝트 보고서 수집 NEW"
```

**스크립트 동작:**
1. 두 폴더의 PPT 파일 비교 (신규·수정 감지)
2. 변경이 있으면 새 폴더 기준으로 재무 데이터 자동 추출
3. Flask 서버에 캐시 갱신 요청 (`/api/reload`)
4. 비교 리포트 Excel 저장 → `data/compare_report.xlsx`
5. 변경이 없으면 추출 생략 (빠르게 종료)

> **참고**: Flask 서버(`python app.py`)가 실행 중이어야 캐시 갱신이 자동으로 됩니다.
> 서버가 꺼져 있으면 추출만 완료되고, 서버 재시작 시 자동 반영됩니다.

---

---

## 탭 구성

| 탭 | 데이터 출처 | 주요 내용 |
|----|------------|----------|
| **재무 데이터** | `재무관점 필수 데이터 추출.xlsx` | KPI 카드, 파트별·연도별 차트, TOP5·리스크 인사이트, 프로젝트 상세 테이블 |
| **실적 현황** | `26년 사업계획 통합관리 파일.xlsx` | KPI 카드, 월별 실적 차트, 파트별 실적, 프로젝트 상세 테이블 |
| **KPI** | `KPI 지표 데이터 추출.xlsx` | KPI 목표 vs 실적 차트, 집계 카드, 취합 테이블 |

---

## 기술 스택

| 구분 | 기술 |
|------|------|
| Backend | Python · Flask · pandas · openpyxl · reportlab · waitress |
| Frontend | React 19 · TypeScript · TanStack Query · TanStack Table · Zustand · Chart.js · Vite |
| 데이터 추출 | python-pptx (KPI) · win32com (재무, .ppt/.pptx 모두 지원) |

---

## 폴더 구조

```
dashboard/
├── app.py                    # Flask 백엔드 (API 서버)
├── scripts/                  # 데이터 추출 스크립트
│   ├── extract_financial_ppt.py   # PPT → 재무 엑셀 추출
│   ├── extract_kpi_ppt.py         # PPT → KPI 엑셀 추출
│   ├── compare_and_update.py      # ★ 비교 → 추출 → 갱신 통합 자동화
│   ├── file_compare.py            # PPT 폴더 비교 (compare_and_update 내부 사용)
│   └── README.md
├── data/                     # 추출된 엑셀 파일 (git 제외)
│   ├── 재무관점 필수 데이터 추출.xlsx
│   ├── KPI 지표 데이터 추출.xlsx
│   └── 26년 사업계획 통합관리 파일_ver7.7_260709_6월 실적 집계.xlsx
├── frontend/                 # React 대시보드
│   └── src/
│       ├── layouts/          # Navbar, FilterBar, TabLayout, PerformanceFilterBar
│       ├── pages/            # Finance, Kpi, Performance 페이지
│       ├── components/       # DataTable, Chart, 공통 UI
│       ├── hooks/            # TanStack Query 훅 + ViewModel
│       └── store/            # Zustand 상태 관리
└── docs/                     # 문서 (API 스펙, 데이터 스키마, 세션 로그)
```

---

## 실행 방법

### 1. 데이터 업데이트 (권장)

새 PPT 폴더가 생겼을 때 → 비교·추출·갱신 한 번에:

```powershell
python scripts/compare_and_update.py "기존폴더" "새폴더"
```

### 1-1. 개별 추출 (필요 시)

```powershell
# 재무 데이터 추출 (win32com, PowerPoint 필요)
python scripts/extract_financial_ppt.py

# KPI 데이터 추출 (python-pptx)
python scripts/extract_kpi_ppt.py
```

### 2. 백엔드 서버 실행

```powershell
# 의존성 설치
pip install -r requirements.txt

# 서버 시작 (기본 포트 5000)
python app.py
```

데이터 파일 경로는 환경변수로 재정의 가능합니다:

```powershell
$env:EXCEL_PATH      = "data/재무관점 필수 데이터 추출.xlsx"
$env:PERF_EXCEL_PATH = "data/26년 사업계획 통합관리 파일.xlsx"
$env:KPI_EXCEL_PATH  = "data/KPI 지표 데이터 추출.xlsx"
python app.py
```

### 3. 프론트엔드 개발 서버

```powershell
cd frontend
npm install
npm run dev
```

브라우저에서 `http://localhost:5173` 접속

---

## API 엔드포인트

### 재무 데이터
| 엔드포인트 | 설명 |
|-----------|------|
| `GET /api/summary` | 집계 요약 (총매출, 이익, 파트별, 연도별) |
| `GET /api/data` | 프로젝트 전체 목록 |
| `GET /api/insights` | TOP5·리스크·인사이트 코멘트 |
| `GET /api/export/pdf` | PDF 보고서 다운로드 |
| `POST /api/reload` | 엑셀 캐시 갱신 |

### 실적 현황
| 엔드포인트 | 설명 |
|-----------|------|
| `GET /api/performance/summary` | 파트별 집계 + 월별 실적 |
| `GET /api/performance/data` | 프로젝트 전체 실적 |
| `GET /api/performance/options` | 파트·팀 필터 목록 |
| `POST /api/performance/reload` | 엑셀 캐시 갱신 |

### KPI
| 엔드포인트 | 설명 |
|-----------|------|
| `GET /api/kpi/summary` | 8개 KPI 항목 목표 vs 실적 |
| `GET /api/kpi/data` | 취합 시트 원본 데이터 |
| `POST /api/kpi/reload` | 엑셀 캐시 갱신 |

---

## 알려진 이슈 / 다음 과제

- `extract_kpi_ppt.py` — `ROOT_DIR` 하드코딩, PPT 파일 경로 맞춰야 함
- `vite.config.ts` — 프록시 포트 하드코딩 (환경변수로 개선 예정)
- 실적 현황 탭 — 인사이트 섹션 미구현 (목표 대비 부진 파트, 손실 경고)
- KPI 실적 — PPT 데이터 미추출 시 전체 0으로 표시

---

## Git

```
Remote: https://github.com/ghtjd1358/Finance-Dashboard.git
Branch: main
```
