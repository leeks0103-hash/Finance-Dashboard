# 기술교육실 프로젝트 재무 대시보드

기술교육실 프로젝트의 재무 현황·KPI·사업 실적을 한 화면에서 모니터링하는 내부용 대시보드입니다.

---

## 데이터 흐름

```
PPT 보고서
  ↓ scripts/extract_financial_ppt.py  (재무 데이터 추출)
  ↓ scripts/extract_kpi_ppt.py        (KPI 데이터 추출)
data/*.xlsx  (추출된 엑셀 파일)
  ↓ app.py  (Flask API — 엑셀 파싱 후 REST 제공)
frontend/   (React 대시보드)
  ↓
사용자
```

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
│   ├── file_compare.py            # NAS ↔ 로컬 파일 비교
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

### 1. 데이터 추출 (PPT → 엑셀)

```powershell
# 재무 데이터 추출 (win32com, PowerPoint 필요)
python scripts/extract_financial_ppt.py

# KPI 데이터 추출
python scripts/extract_kpi_ppt.py
```

> **주의**: `extract_kpi_ppt.py`의 `ROOT_DIR`을 PPT 파일 위치로 맞춰야 합니다.
> `extract_financial_ppt.py`도 `BASE_DIR`을 실제 경로로 확인하세요.

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
