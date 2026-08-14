# 기술교육실 프로젝트 재무 대시보드

기술교육실 프로젝트의 재무 현황·KPI·사업 실적을 한 화면에서 모니터링하는 내부용 대시보드입니다.

---

## 목차

1. [화면 구성](#화면-구성)
2. [데이터 흐름 및 계산 방식](#데이터-흐름-및-계산-방식)
3. [데이터 업데이트 방법](#데이터-업데이트-방법)
4. [실행 방법](#실행-방법)
5. [주요 기능](#주요-기능)
6. [API 엔드포인트](#api-엔드포인트)
7. [기술 스택](#기술-스택)
8. [폴더 구조](#폴더-구조)

---

## 화면 구성

대시보드는 오른쪽 사이드 리모컨으로 탭을 전환합니다. URL(`/#/finance`, `/#/kpi`, `/#/performance`)이 변경되므로 새로고침해도 현재 탭이 유지됩니다.

| 탭 | URL | 데이터 출처 | 주요 내용 |
|----|-----|------------|----------|
| **재무 데이터** | `/#/finance` | `재무관점 필수 데이터 추출.xlsx` | KPI 카드, 파트별·연도별 차트, TOP5·리스크 인사이트, 프로젝트 재무 상세 테이블 |
| **KPI** | `/#/kpi` | `KPI 지표 데이터 추출.xlsx` | 목표 vs 실적 가로 바 차트, KPI 집계 테이블, 취합 상세 테이블 |
| **실적 현황** | `/#/performance` | `26년 사업계획 통합관리 파일.xlsx` | KPI 카드, 월별 실적 바 차트, 파트별 실적, 프로젝트 상세 테이블 |

---

## 데이터 흐름 및 계산 방식

### 전체 파이프라인

```
PPT 보고서 파일
      │
      ├── extract_financial_ppt.py ──→ 재무관점 필수 데이터 추출.xlsx
      │                                  └── Flask /api/reload 캐시 갱신
      │
      └── extract_kpi_ppt.py       ──→ KPI 지표 데이터 추출.xlsx
                                         └── Flask /api/kpi/reload 캐시 갱신

26년 사업계획 통합관리 파일.xlsx ──→ Flask /api/performance/* (직접 읽기)

Flask API ──→ TanStack Query ──→ React 대시보드
```

---

### 재무 데이터 계산 방식

**원본**: 각 프로젝트 PPT 보고서의 재무관점 표 → `extract_financial_ppt.py`가 파싱 → `재무관점 필수 데이터 추출.xlsx` (`취합` 시트)

#### 추출 컬럼

| 컬럼 | 설명 |
|------|------|
| 프로젝트코드 | PPT 1열 (예: E012600126010001) |
| 수행연도 | PPT 기준 연도 |
| 파트명 | 파일명에서 파트 키워드 추출 (AI교육, SW교육, 전차, 미모 등) |
| 보고단계 | 파일명에서 추출 (제안/착수/중간/완료) |
| 매출 | PPT 재무관점 표 매출 셀 |
| 지출 | PPT 재무관점 표 지출 셀 |
| 직접원가 | 직접원가 항목 |
| 인건비 | 직접인건비 항목 |
| 공통원가 | 공통원가/관리비 항목 |
| 경상이익 | 매출 − 지출 (또는 PPT 기재값) |
| 이익율 | 경상이익 ÷ 매출 × 100 (%) |

#### 집계 API (`/api/summary`) 계산

- **총 매출·지출·이익**: 필터 조건에 해당하는 전체 행의 단순 합계 (`sum`)
- **평균 이익율**: 이익율 컬럼 평균 (`mean`). 단, 이익율 이상값(±100% 초과)은 경상이익/매출로 재계산 보정
- **파트별 집계** (`by_part`): 파트명 기준 `groupby` → 매출·지출·이익 합계 + 건수
- **연도별 집계** (`by_year`): 수행연도 기준 동일 방식
- **비용 구조** (`cost_breakdown`): 직접원가·인건비·공통원가 전체 합계
- **TOP5** (`/api/insights`): 이익율 기준 상위 5개 프로젝트 (`nlargest(5, 'profit_rate')`)
- **리스크**: 경상이익 < 0인 프로젝트 (`operating_profit < 0`)

#### 프로젝트 중복 처리

같은 프로젝트코드 + 보고단계가 여러 PPT에 존재하면 **파일 수정일 기준 최신 파일이 최종 적용**됩니다. (`compare_and_update.py`가 신규·수정 파일만 재추출)

---

### KPI 데이터 계산 방식

**원본**: 각 프로젝트 PPT의 "KPI/경영현황" 슬라이드 표 → `extract_kpi_ppt.py`가 파싱 → `KPI 지표 데이터 추출.xlsx`

#### PPT KPI 표 구조

각 PPT의 KPI 표는 8행(KPI 항목) × 8열(항목값) 구조입니다:

| 열 | 내용 | 저장 위치 |
|----|------|----------|
| 1 | 프로젝트코드 | 취합 시트 키 |
| 2 | 수행연도 | 취합 시트 키 |
| 3 | 구분(KPI 항목명) | kpi 집계 시트 C열 |
| 4 | 26년 목표(사업계획) | 취합 시트 `*_사업계획` 컬럼 |
| 5 | 26년 목표(프로젝트) | 취합 시트 `*_PJ목표` 컬럼 |
| 6 | 26년 실적(프로젝트) | 취합 시트 `*_PJ실적` 컬럼 |
| 7 | 25년 실적(유사 프로젝트) | 취합 시트 `*_PJ유사` 컬럼 |
| 8 | 비고 | 저장만, 집계 제외 |

#### 8개 KPI 항목 (행 순서 고정)

| 순서 | KPI 항목 | 집계 방식 |
|------|---------|---------|
| 1 | 교육 만족도 (NPS) | **평균** |
| 2 | 그룹 연구개발 2030 전략기술 관련 과정 개발 (과정 건수) | **합계** |
| 3 | 그룹 연구개발 2030 전략기술 관련 과정 개발 (교육 내용 구성 적절성) | **평균** |
| 4 | 본부별/그룹사별 특화 교육체계 구축 (프로젝트 건수) | **합계** |
| 5 | 그룹 내 AI 교육 확대 (고객사 건수) | **합계** |
| 6 | 그룹 내 AI 교육 확대 (교육 내용 구성 적절성) | **평균** |
| 7 | 정부지원 사업 및 신사업 확대 (매출액, 단위: 억) | **합계** |
| 8 | 정부지원 사업 및 신사업 확대 (신규/기존 사업 건수) | **신규:N건/기존:N건 카운트** |

#### 집계 방식 (`kpi 집계` 시트 → `/api/kpi/summary`)

1. **목표(프로젝트)**: 각 프로젝트의 `*_PJ목표` 컬럼을 KPI 항목별 집계방식으로 계산
   - 숫자 필드(NPS·적절성·매출): 유효 숫자 값의 **평균**
   - 건수 필드: 유효 숫자 값의 **합계**
   - 신규/기존: `신규:N건/기존:N건` 텍스트에서 신규·기존 각각 **카운트 합산**

2. **실적**: 각 프로젝트의 `*_PJ실적` 컬럼 동일 방식 집계

3. **25년 유사실적**: 각 프로젝트의 `*_PJ유사` 컬럼 동일 방식 집계

4. **프로젝트 간 upsert 처리**: 같은 프로젝트가 여러 보고서(착수→중간→완료)에 있으면 **오래된 파일부터 처리 후 최신 파일이 덮어씀** → 완료 보고서의 실적값이 최종 보존

5. **유효값 판별**: `N`, `TBD`, `-`, 빈칸은 제외. `86점` 같은 한글 단위는 숫자 부분만 추출

---

### 실적 현황 계산 방식

**원본**: `26년 사업계획 통합관리 파일.xlsx` (파일 직접 읽기, 추출 스크립트 불필요)

#### 주요 집계 (`/api/performance/summary`)

| 항목 | 계산 |
|------|------|
| 사업계획(최초) | `chk_m01`~`chk_m12` 월별 계획 합계 × 1.0 |
| 6월 실적 누계 | `actual_m01`~`actual_m06` 실적 합계 |
| 매출 계획 | `revenue` 컬럼 |
| 달성률 | 실적 누계 ÷ 사업계획(최초) × 100% |
| 월별 집계 | `chk_m01`~`chk_m12`, `actual_m01`~`actual_m12` 전체 합계 (시트 기준) |
| 파트별 집계 | 파트명 기준 `groupby` → 계획·실적·달성률 |

---

## 데이터 업데이트 방법

### 방법 1: 자동 비교·추출 (권장)

새 PPT 폴더를 받았을 때 **명령 하나**로 비교 → 추출 → 갱신 자동 진행:

```powershell
python scripts/compare_and_update.py "기존폴더경로" "새폴더경로"
```

**예시:**
```powershell
python scripts/compare_and_update.py `
  "C:\Users\aaa\Desktop\기술교육실_프로젝트 보고서 수집" `
  "C:\Users\aaa\Desktop\기술교육실_프로젝트 보고서 수집 NEW"
```

**동작 순서:**
1. 두 폴더의 PPT 파일 비교 (신규·수정 감지)
2. 변경이 있으면 새 폴더 기준으로 재무 데이터 자동 추출
3. Flask 서버에 캐시 갱신 요청 (`POST /api/reload`)
4. 비교 리포트 Excel 저장 → `data/compare_report.xlsx`
5. 변경이 없으면 추출 생략 후 종료

> **서버가 꺼져 있어도** 추출은 완료됩니다. 서버 재시작 시 자동 반영됩니다.

---

### 방법 2: KPI 데이터 수동 추출

KPI PPT 보고서가 갱신되었을 때:

```powershell
python scripts/extract_kpi_ppt.py
```

- PPT 탐색 경로: `C:\Users\aaa\Desktop\기술교육실_프로젝트 보고서 수집 NEW`
- 출력: `data/KPI 지표 데이터 추출.xlsx`
- 실행 후 대시보드에서 **KPI 탭 → 새로고침** 또는 서버 재시작

**AIP(Azure Information Protection) 암호화 파일 처리**:
- PPT가 민감도 레이블로 암호화된 경우 `win32com`(PowerPoint COM 자동화)으로 자동 우회 처리
- 재무 엑셀 파일이 AIP 암호화된 경우 `win32com`(Excel COM)으로 자동 우회 처리
- 별도 작업 불필요 — PC에 PowerPoint/Excel이 설치되어 있어야 함

---

### 방법 3: 실적 현황 데이터 갱신

실적 현황은 별도 추출 스크립트 없이 엑셀 파일을 직접 교체합니다:

1. 새 `26년 사업계획 통합관리 파일_*.xlsx`를 `data/` 폴더에 저장
2. `app.py`의 `PERF_EXCEL_PATH` 경로 수정 (파일명이 바뀐 경우)
3. 대시보드에서 **실적 현황 탭 → 서버 재시작** 또는 환경변수 재설정

---

## 실행 방법

> **핵심 원칙**: 서버는 `python app.py` **하나만** 실행하면 됩니다.
> 재무·KPI·실적 현황 3탭 모두 이 서버 하나가 담당합니다.
> 추출 스크립트(`extract_*.py`)는 서버가 아닙니다 — PPT에서 Excel을 만드는 **1회성 변환 도구**입니다.

### 서버 vs 추출 스크립트 구분

```
[추출 스크립트]  PPT 폴더 → (1회 실행) → data/*.xlsx  ← Flask가 읽어서 서빙
[Flask 서버]     python app.py → 재무/KPI/실적 API 모두 제공
[프론트엔드]     npm run dev   → 브라우저 화면
```

추출 스크립트는 PPT 데이터가 바뀔 때만 다시 실행합니다.  
**평상시에는 `python app.py` + `npm run dev` 두 개만 켜면 됩니다.**

---

### 1. 최초 실행 시 (처음 세팅할 때만)

**1) 의존성 설치**
```powershell
pip install -r requirements.txt
```
```powershell
cd frontend && npm install && cd ..
```

**2) KPI 데이터 추출** (data/ 폴더에 Excel이 없으면 KPI 탭이 빈 화면)
```powershell
python scripts/extract_kpi_ppt.py
```

**3) 재무 데이터 추출** (data/ 폴더에 Excel이 없으면 재무 탭이 빈 화면)
```powershell
python scripts/extract_financial_ppt.py
```

> 실적 현황은 엑셀 파일을 직접 읽으므로 추출 스크립트 없음.  
> `data/` 폴더에 `26년 사업계획 통합관리 파일_*.xlsx`가 있으면 자동 인식.

### 2. 매일 사용할 때 (서버 실행)

```powershell
# 터미널 1 — Flask 서버 (재무·KPI·실적 API 전부 여기서 제공)
python app.py

# 터미널 2 — 프론트엔드
cd frontend && npm run dev
```

브라우저 `http://localhost:5188` 접속

### 3. 데이터 파일 경로 재정의 (경로가 다를 경우)

```powershell
$env:EXCEL_PATH      = "data/재무관점 필수 데이터 추출.xlsx"
$env:PERF_EXCEL_PATH = "data/26년 사업계획 통합관리 파일.xlsx"
$env:KPI_EXCEL_PATH  = "data/KPI 지표 데이터 추출.xlsx"
python app.py
```

### 4. KPI 데이터가 안 보일 때

```powershell
# data/ 폴더 확인
ls data/

# Excel 파일이 없으면 추출 실행
python scripts/extract_kpi_ppt.py

# 서버가 이미 켜져 있으면 재시작 없이 캐시만 갱신
Invoke-RestMethod http://localhost:5000/api/kpi/reload -Method POST
```

---

## 주요 기능

### 공통
- **탭 URL 연동**: 새로고침해도 현재 탭 유지 (`/#/finance`, `/#/kpi`, `/#/performance`)
- **사이드 리모컨**: 화면 오른쪽 고정 버튼으로 탭 즉시 전환 (스크롤 불필요)
- **다크/라이트 모드**: 상단 Navbar 토글
- **연도·파트·보고단계 필터**: 재무 탭 전용 (상단 FilterBar)

### 테이블 공통
- **컬럼 드래그 이동**: 헤더를 드래그하여 컬럼 순서 변경 → 새로고침 후에도 유지
- **컬럼 너비 조정**: 헤더 우측 끝 드래그 → 새로고침 후에도 유지
- **컬럼 표시/숨김**: "컬럼 ▾" 버튼으로 토글
- **서버사이드 페이지네이션**: 전체 건수 기준 서버에서 페이지 분할
- **검색**: 프로젝트코드·파트명 등 실시간 검색

### KPI 탭
- **KPI 집계 테이블**: 8개 KPI 항목의 목표 vs 실적 vs 25년 유사실적 비교
- **취합 목록 뷰**: 1행/프로젝트 플랫 테이블 (컬럼별 KPI 값 확인)
- **취합 KPI 상세 뷰**: 1프로젝트 = 8행 rowspan 구조 (PPT 표와 동일한 형태)
- **뷰 전환**: 툴바의 `목록 | KPI 상세` 토글로 즉시 전환

---

## API 엔드포인트

### 재무 데이터
| 엔드포인트 | 설명 |
|-----------|------|
| `GET /api/summary` | 집계 요약 (총매출·이익·파트별·연도별) |
| `GET /api/data` | 프로젝트 목록 (페이지네이션·필터·검색) |
| `GET /api/insights` | TOP5·리스크·인사이트 코멘트 |
| `GET /api/export/pdf` | PDF 보고서 다운로드 |
| `POST /api/reload` | 엑셀 캐시 갱신 |
| `GET /api/options` | 연도·파트·보고단계 필터 목록 |

### 실적 현황
| 엔드포인트 | 설명 |
|-----------|------|
| `GET /api/performance/summary` | 파트별 집계 + 월별 실적 배열 |
| `GET /api/performance/data` | 프로젝트 전체 실적 (페이지네이션) |
| `GET /api/performance/options` | 파트·팀 필터 목록 |
| `POST /api/performance/reload` | 엑셀 캐시 갱신 |

### KPI
| 엔드포인트 | 설명 |
|-----------|------|
| `GET /api/kpi/summary` | 8개 KPI 항목 목표 vs 실적 집계 |
| `GET /api/kpi/data` | 취합 시트 원본 (페이지네이션·검색) |
| `POST /api/kpi/reload` | 엑셀 캐시 갱신 |

---

## 기술 스택

| 구분 | 기술 |
|------|------|
| Backend | Python · Flask · pandas · openpyxl · waitress |
| Frontend | React 19 · TypeScript · Vite · TanStack Query · TanStack Table · Zustand · Chart.js · React Router |
| DnD | @dnd-kit/core · @dnd-kit/sortable (컬럼 순서 드래그) |
| 데이터 추출 | python-pptx · win32com (AIP 암호화·구버전 PPT 처리) |

---

## 폴더 구조

```
dashboard/
├── app.py                    # Flask 백엔드 (API + 정적 파일 서빙)
├── requirements.txt
├── scripts/
│   ├── extract_financial_ppt.py   # PPT → 재무 엑셀 추출
│   ├── extract_kpi_ppt.py         # PPT → KPI 엑셀 추출
│   ├── compare_and_update.py      # ★ 비교·추출·갱신 통합 자동화
│   └── file_compare.py            # PPT 폴더 비교 유틸
├── data/                     # 추출된 엑셀 파일 (git 제외)
│   ├── 재무관점 필수 데이터 추출.xlsx
│   ├── KPI 지표 데이터 추출.xlsx
│   └── 26년 사업계획 통합관리 파일_*.xlsx
├── frontend/
│   └── src/
│       ├── App.tsx            # 라우터 + 레이아웃
│       ├── main.tsx           # HashRouter + QueryClient
│       ├── layouts/           # Navbar, FilterBar, TabLayout
│       ├── pages/             # Finance, Kpi, Performance
│       ├── components/
│       │   ├── ui/            # DataTable, KpiCard, Button, TabRemote 등
│       │   └── features/      # ProjectTable, KpiRawTable, PerformanceTable
│       ├── hooks/viewmodels/  # 데이터 fetch + 가공 로직
│       ├── store/             # Zustand (filter, theme, tab)
│       └── types/             # TypeScript 인터페이스
└── docs/                     # API 스펙, 데이터 스키마, 세션 로그
```

---

## Git

```
Remote: https://github.com/ghtjd1358/Finance-Dashboard.git
Branch: main
```
