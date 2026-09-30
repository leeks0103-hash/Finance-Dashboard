# 기술교육실 프로젝트 재무 대시보드

기술교육실 프로젝트의 경영실적·재무데이터·KPI를 한 화면에서 모니터링하는 내부용 대시보드입니다.
필터·정렬·드릴다운(산출 근거 조회)에 더해, PPT 원본 데이터를 대시보드 안에서 직접 재추출하고,
AI(H-Chat/Claude)가 수치를 해석해 코멘트로 요약해주는 기능까지 포함합니다.

---

## 목차

1. [화면 구성](#화면-구성)
2. [데이터 흐름 및 계산 방식](#데이터-흐름-및-계산-방식)
3. [데이터 품질 감시](#데이터-품질-감시)
4. [데이터 업데이트 방법](#데이터-업데이트-방법)
5. [다운로드](#다운로드)
6. [추출 스크립트 설정값](#추출-스크립트-설정값)
7. [실행 방법](#실행-방법)
8. [주요 기능](#주요-기능)
9. [API 엔드포인트](#api-엔드포인트)
10. [기술 스택](#기술-스택)
11. [폴더 구조](#폴더-구조)

---

## 화면 구성

대시보드는 오른쪽 사이드 리모컨(탭)으로 화면을 전환합니다. URL(`/#/performance`, `/#/kpi`)이 바뀌므로
새로고침해도 현재 탭이 유지됩니다.

| 탭 | URL | 데이터 출처 | 주요 내용 |
|----|-----|------------|----------|
| **경영실적/재무데이터** | `/#/performance` | `26년 사업계획 통합관리 파일_*.xlsx` (원본 직접 읽기) | KPI 카드, 월별/파트별 차트(클릭 시 산출 근거 드릴다운), 원가구성 도넛, 인사이트(부진·손실 랭킹), 프로젝트 상세 테이블, 재무이력 2뎁스 대조 패널 |
| **KPI/경영현황** | `/#/kpi` | `KPI 지표 데이터 추출.xlsx` | 목표 vs 실적 가로 바 차트(드릴다운 포함), KPI 집계 테이블, 취합 목록/상세(rowspan) 뷰 전환 |

두 탭 모두 상단에 **AI 인사이트 위젯**이 있어 그 탭의 수치를 H-Chat(Claude)이 서술형으로 해석해줍니다.

> **구 "재무 데이터" 탭**(`/#/finance`, `재무관점 필수 데이터 추출.xlsx` 기반)은 경영실적 탭으로 기능이
> 통합되면서 사이드 리모컨에서는 빠졌지만, 라우트와 API(`finance.py`)는 그대로 남아있어 URL로 직접
> 접근할 수 있습니다.
>
> **강사만족도 탭**(`/#/satisfaction`)은 데이터 소스·파이프라인이 아직 정해지지 않아 네비게이션에서
> 잠시 내려둔 상태입니다(`TabNav.tsx`의 주석 한 줄만 풀면 복구).

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

26년 사업계획 통합관리 파일_*.xlsx ──→ Flask /api/performance/* (직접 읽기)

Flask API ──→ TanStack Query ──→ React 대시보드
                   │
                   └── /api/ai/finance, /api/ai/kpi
                         └── ai_insight.py가 Python으로 미리 계산한 수치를
                             H-Chat(Claude)에 넘겨 해석 코멘트만 생성 (계산은 LLM에 맡기지 않음)
                             결과는 data/ai_analysis_cache.json에 원본 mtime 기준 캐시
```

추출 스크립트는 CLI에서 직접 실행할 수도 있고, **Navbar ⚙ → "PPT 데이터 추출"**로 대시보드 안에서
바로 실행할 수도 있습니다 (자세한 내용은 [데이터 업데이트 방법](#데이터-업데이트-방법) 참고).

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
| 미수사유 | PPT 전체 슬라이드에서 "★ 미수 사유" 텍스트박스 파싱 (미수주 프로젝트만) |

#### 집계 API (`/api/summary`) 계산

- **총 매출·지출·이익**: 필터 조건에 해당하는 전체 행의 단순 합계 (`sum`)
- **평균 이익율**: 이익율 컬럼 평균 (`mean`). 단, 이익율 이상값(±100% 초과)은 경상이익/매출로 재계산 보정
- **파트별 집계** (`by_part`): 파트명 기준 `groupby` → 매출·지출·이익·이익율·지출율 + 건수
- **비용 구조** (`cost_breakdown`): 직접원가·인건비·공통원가 전체 합계
- **TOP5** (`/api/insights`): 이익율 기준 상위 5개 프로젝트 (`nlargest(5, 'profit_rate')`)
- **리스크**: 경상이익 < 0인 프로젝트 (`operating_profit < 0`)
- **산출 근거 드릴다운** (`/api/summary/breakdown`): 차트 막대/조각을 클릭하면 그 값이 어떤
  프로젝트 행들을 합산한 것인지 원본 필드 그대로 보여줌 — 집계 로직과 동일한 필터·컬럼을 재사용하므로
  드릴다운 표의 합계가 항상 막대 값과 정확히 일치

#### 프로젝트 중복 처리

같은 (코드·연도·파트·구분) 키가 여러 PPT에 존재하면 **나중에 처리된 파일이 앞 파일의 행을 덮어씁니다.**
파일명에서 보고단계 접미사를 뗀 "기준 이름"이 다른데 같은 코드를 쓰는 경우는 `코드충돌` 시트에 기록되어
[데이터 품질 감시](#데이터-품질-감시)에 노출됩니다.

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

1. **프로젝트당 1건만 반영**: 한 프로젝트가 제안·착수·중간·완료를 중복 보고해도, 가장 진행된 단계
   (완료 → 중간 → 착수 → 제안 순 폴백) 1건만 목표·실적 집계에 사용 (`_latest_stage_df()`)
2. **목표(프로젝트)/실적/25년 유사실적**: 위 1건 기준 뷰에서 항목별 집계방식(평균/합계/카운트)으로 계산
3. **유효값 판별**: `N`, `TBD`, `-`, 빈칸은 제외. `86점` 같은 한글 단위는 숫자 부분만 추출
4. **26년 목표(사업계획)**: PPT 원본 오입력이 섞여 있어 시트 값 대신 담당자 지정 고정값 사용
5. **산출 근거 드릴다운** (`/api/kpi/summary/breakdown`): 차트 막대 클릭 → 그 값에 실제로 반영된
   프로젝트 목록

---

### 실적 현황(경영실적) 계산 방식

**원본**: `26년 사업계획 통합관리 파일_*.xlsx` (`data/` 폴더 내 이름에 "사업계획 통합관리 파일"이
들어간 파일 중 **최신 수정본을 자동 선택**, 파일 직접 읽기 — 추출 스크립트 불필요)

#### 주요 집계 (`/api/performance/summary`)

| 항목 | 계산 |
|------|------|
| 계획 | 매출/원가 연간 계획 합계 |
| 누계 실적(1~N월) | 경과월(`chk_m01`~해당월)만 재합산 — 원본 AR열은 이름과 달리 "연간 전체(미래 추정 포함)"라 그대로 쓰면 누계가 부풀려짐 |
| 추정 실적(연간) | 연간 전체 추정 합계 |
| 매출이익 | 매출 − 직접원가 (BA열) |
| 경상손익(당해년도 추정) | 매출이익 − 인건비 − 공통원가 − 관리비 |
| 달성률 | 누계 실적 ÷ 계획 × 100% |
| 파트별 집계 | 파트명 기준 `groupby` → 계획·추정실적·원가율·달성률 |
| 원가구성 | 직접원가·인건비·공통원가·관리비 4분류 (전체 매출행 합산 기준) |

- **인사이트** (`/api/performance/insights`): 목표 대비 부진 프로젝트, 손실/저수익 경고, 코멘트
- **산출 근거 드릴다운** (`/api/performance/summary/breakdown`): 막대·도넛 조각·파트별 달성 현황 행
  클릭 시 그 값에 쓰인 프로젝트별 원본 수치 표 + "이 값이 어떻게 만들어지나" 계산식 설명
- **2뎁스 재무이력 대조**: 실적현황 검색에서 프로젝트를 찾으면, 같은 프로젝트의 재무(`finance.py`)
  단계별 보고 이력을 나란히 대조하는 패널이 슬라이드인

---

## 데이터 품질 감시

추출된 두 데이터(재무·KPI)는 같은 PPT 파일을 각자 독립적으로 스캔하기 때문에, 사람이 PPT에
프로젝트코드를 잘못 입력하면 양쪽이 어긋날 수 있습니다. `GET /api/data-health`가 이를 자동으로
찾아내 Navbar 우측 배지(⚙ 옆 "!" 표시)로 노출합니다.

| 감지 항목 | 내용 |
|-----------|------|
| **코드 불일치** | 같은 파일명인데 재무·KPI가 서로 다른 프로젝트코드 집합을 추출한 경우 (둘 다 placeholder 값끼리만 다른 경우는 제외) |
| **코드충돌** | 서로 다른 PPT가 같은 (코드·연도·단계) 키를 공유해 뒤 파일이 앞 파일 행을 덮어쓴 경우 — 파트·매출 금액이 파일 간 일관되면 `likely_same_project`(단계별 재보고로 추정), 갈리면 `needs_review`로 자동 분류 |
| **완료보고 이상** | "완료" 단계 PPT는 매출·직접원가 외 항목(지출/인건비/공통원가/경상이익/이익율)을 원래 안 채우는 게 정책인데 값이 들어있는 경우 — 오입력 후보로 노출 |

> ⚠️ 파일명 비교만으로는 "한 PPT에 여러 프로젝트가 있고 단계마다 배치 제목만 바뀌는" 케이스를 완전히
> 구분하지 못합니다 — `needs_review`로 뜬 항목은 결국 사람이 파트·금액을 보고 최종 판단해야 합니다.

---

## 데이터 업데이트 방법

### 방법 0: 대시보드 안에서 직접 실행 (Navbar ⚙ → "PPT 데이터 추출")

서버가 켜져 있으면 CLI 없이도 브라우저에서 바로 재무/KPI 추출을 실행·중지할 수 있습니다.

- `.env`의 `EXTRACT_ADMIN_KEY`를 입력해야 동작 (비어있으면 기능 자체가 꺼짐 — 아직 배포 전이라 LAN에
  공유돼도 아무나 못 누르게 하는 접근 제한용, 한 번 입력하면 브라우저 localStorage에 저장됨)
- 재무/KPI 중 대상 선택 + 모드(증분/강제 재추출/완전 초기화) 선택 후 실행 → 백그라운드 스레드로 돌며
  상태 폴링(`/api/extract/status`), 완료 시 자동으로 캐시 갱신
- 동시에 한 사람만 실행 가능 (실행 중이면 누가 돌리고 있는지 메시지로 안내)
- 중지 버튼 있음(`/api/extract/cancel`) — 단, PowerPoint COM이 띄운 `POWERPNT.EXE`는 자식 프로세스라
  100% 즉시 종료가 보장되진 않음(좀비 프로세스 가능성, 상태 메시지로 안내)

---

### 방법 1: CLI로 비교·추출 자동화 (대량 변경 시 권장)

새 PPT 폴더를 받았을 때 **명령 하나**로 비교 → 추출 → 갱신 자동 진행:

```powershell
python scripts/compare_and_update.py "기존폴더경로" "새폴더경로"
```

**동작 순서:**
1. 두 폴더의 PPT 파일 비교 (신규·수정 감지)
2. 변경이 있으면 새 폴더 기준으로 재무 데이터 자동 추출
3. Flask 서버에 캐시 갱신 요청 (`POST /api/reload`)
4. 비교 리포트 Excel 저장 → `data/compare_report.xlsx`
5. 변경이 없으면 추출 생략 후 종료

> **서버가 꺼져 있어도** 추출은 완료됩니다. 서버 재시작 시 자동 반영됩니다.

정기 배치용으로 `dashboard_update.py`(같은 순서를 인수 없이 실행 → 재무 캐시만 자동 갱신)도
있습니다. Windows 작업 스케줄러 등에서 이 스크립트를 직접 호출할 때 사용합니다.

---

### 방법 2: 추출 스크립트 CLI 수동 실행

```powershell
python scripts/extract_kpi_ppt.py        # KPI PPT → data/KPI 지표 데이터 추출.xlsx
python scripts/extract_financial_ppt.py  # 재무 PPT → data/재무관점 필수 데이터 추출.xlsx (증분)
```

실행 후 대시보드에서 **⚙ → 새로고침** 또는 서버 재시작으로 반영됩니다.

**AIP(Azure Information Protection) 암호화 파일 처리**:
- PPT가 민감도 레이블로 암호화된 경우 `win32com`(PowerPoint COM 자동화)으로 자동 우회 처리
- 재무 엑셀 파일이 AIP 암호화된 경우 `win32com`(Excel COM)으로 자동 우회 처리
- 별도 작업 불필요 — PC에 PowerPoint/Excel이 설치되어 있어야 함

---

### 방법 3: 실적 현황 데이터 갱신

실적 현황은 별도 추출 스크립트 없이 엑셀 파일을 직접 교체합니다:

1. 새 `26년 사업계획 통합관리 파일_*.xlsx`를 `data/` 폴더에 저장 (파일명이 이름 패턴에 맞으면 자동으로
   최신 수정본이 선택됨 — 경로 수정 불필요)
2. 새 달에 시트 구조(컬럼 순서)가 바뀌었다면 `scripts/check_perf_headers.py`로 헤더를 대조하고
   `performance.py`의 컬럼맵에 사람이 직접 반영 (자동화하지 않음 — 원본이 매달 컬럼이 밀릴 수 있어서)
3. 대시보드에서 **경영실적/재무데이터 탭 → 새로고침** 또는 `POST /api/performance/reload`

---

## 다운로드

경영실적/재무데이터·KPI 탭 상단 다운로드 버튼(`↓ 재무데이터 다운로드`, `↓ KPI 다운로드` 등)으로
추출·원본 엑셀 파일을 그대로 받을 수 있습니다 (`GET /api/download`, `GET /api/download/<key>`).

- 대상: 재무 추출 결과, KPI 추출 결과, 실적현황 원본
- 요청 시점에 디스크에서 바로 읽어 보내므로 서버 재시작 없이 항상 최신 버전이 나감
- 파일명에 수정 시각이 자동으로 붙어 같은 이름으로 계속 덮어써도 버전 구분 가능

---

## 추출 스크립트 설정값

추출 스크립트(`extract_financial_ppt.py`, `extract_kpi_ppt.py`)는 파일 상단에 동작을 바꾸는
설정값이 여러 개 있습니다. 대부분 "평소엔 기본값 그대로 두고, 특정 상황에서만 잠깐 켰다 끄는" 값이라
따로 정리해둡니다.

### `.env` 환경변수 (경로 설정 — `paths.py` 단일 관리)

| 변수 | 용도 | 없을 때 |
|------|------|---------|
| `EXCEL_PATH` | 재무 추출 결과 엑셀 경로 | `data/재무관점 필수 데이터 추출.xlsx` |
| `KPI_EXCEL_PATH` | KPI 추출 결과 엑셀 경로 | `data/KPI 지표 데이터 추출.xlsx` |
| `PERF_EXCEL_PATH` | 실적(사업계획 통합관리) 엑셀 경로 | `data/` 안에서 이름에 "사업계획 통합관리 파일"이 들어간 파일 중 **최신 수정본 자동 선택** — 매달 새 버전 파일을 `data/`에 넣기만 하면 됨 |
| `PYTHON_EXE` | `dashboard_manager.py`/추출 실행이 사용할 파이썬 경로 | 지금 스크립트를 실행 중인 인터프리터 |
| `EXTRACT_ADMIN_KEY` | Navbar "PPT 데이터 추출" 기능 접근 키 | 비어있으면 기능 자체가 비활성화 |
| `H_CHAT_API_KEY` / `H_CHAT_BASE_URL` / `H_CHAT_API_MODEL` | AI 인사이트(`/api/ai/*`)가 호출하는 사내 H-Chat 게이트웨이 설정 | 키가 없으면 AI 위젯 호출 시 오류 응답 |

전부 `paths.py` 한 곳에서만 읽으므로, 경로가 바뀌면 `.env`만 고치면 되고 코드는 안 건드려도 됩니다.

**PPT 원본 폴더는 `.env`로 설정하지 않습니다** — `paths.py`의 `PPT_SOURCE_DIR`(NAS `\\10.206.32.3\기술교육팀\1. 실 공통\5. 보고서 수집`)로
고정이고, 예전 `EXTRACT_BASE_DIR`/`EXTRACT_KPI_ROOT_DIR`·CLI 폴더 인수는 무시됩니다(2026-09-30).
추출이 "대상 폴더를 찾을 수 없습니다"로 실패하면, 그 PC에서 파일 탐색기로 `\\10.206.32.3`에 접속(로그인)돼 있는지·폴더 권한이 있는지 먼저 확인하세요.

### `extract_financial_ppt.py` (재무 — 증분 처리, 안 바뀐 파일은 스킵)

| 설정 | 기본값 | 의미 |
|------|--------|------|
| `FORCE_REPROCESS` | `False` | `True`면 파일 서명(파일명\|수정시각\|크기) 일치 여부와 무관하게 **대상 폴더 전체를 처음부터 재추출**. 추출 로직 자체를 바꿔서 이미 처리된 파일들을 새 로직으로 다시 평가해야 할 때만 잠깐 켰다가, 끝나면 반드시 `False`로 되돌릴 것 — 안 그러면 이후 모든 실행이 전체 재스캔(느림)이 됨 |
| `RESET_OUTPUT_ON_START` | `False` | `True`면 실행 시작 시 취합·처리이력 시트를 통째로 비우고 시작(완전 초기화) |
| `--retry` | - | AIP 암호화 해제 실패 목록(`data/aip_failed.txt`)에 남은 파일만 재처리 |
| `EXCLUDE_FILENAMES` | `{"테스트 입니다.pptx"}` | 파일명이 일치하면 무조건 건너뜀 |
| `TITLE_KEYWORD` | `"[내부용①] 재무관점 필수 데이터"` | PPT 슬라이드 제목에 이 문자열이 없으면 표를 못 찾은 것으로 보고 추출 안 함(품질 감사 보고서 필터 기준과 동일 — CLAUDE.md 참고) |
| `PLACEHOLDER_CODES` | `{"", "-", "0", "생성예정", "미정", ...}` | 이 값들은 "코드 미배정"으로 간주 — 서로 다른 프로젝트가 같은 값을 써도 파일명까지 키에 포함시켜 충돌(덮어쓰기)이 안 나게 함 |

Navbar 대시보드에서 실행할 때는 위 `FORCE_REPROCESS`/`RESET_OUTPUT_ON_START`를 파일 상단 상수 대신
요청 시 선택한 모드(증분/강제/초기화)에 맞춰 `app.py`가 환경변수로 해당 프로세스에만 덮어씌워 실행합니다.

**`코드충돌` 시트(같은 코드를 다른 파일이 덮어씀 감지)**: 취합 시트의 행 식별 키는 (코드·연도·파트·구분)
뿐이라 보고단계(착수/완료 등)는 안 들어갑니다. 그래서 프로젝트가 착수→완료로 진행되며 재추출되면
최신 단계 파일이 이전 단계 파일의 행을 정상적으로 덮어씁니다 — 이게 "같은 프로젝트의 단계 갱신"인지
"무관한 두 프로젝트가 코드만 우연히 겹침"인지는, 두 파일명에서 보고단계 접미사(`_착수`/`_완료`/`_수정`/
`(수정)` 등)를 뗀 "기준 이름"이 같은지로 판별하는 휴리스틱(`shared.py` `strip_stage_suffix()`)입니다.
기준 이름이 다르면 `코드충돌` 시트에 기록되고, `app.py`가 한 번 더 파트·금액 일관성으로 자동 분류해
Navbar 데이터 이상 배지에 노출합니다(상세는 [데이터 품질 감시](#데이터-품질-감시)).

### `extract_kpi_ppt.py` (KPI — 매 실행 대상 폴더 전체 재처리)

| 설정 | 기본값 | 의미 |
|------|--------|------|
| (`FORCE_REPROCESS` 없음) | - | 재무와 달리 서명 캐시로 건너뛰는 로직 자체가 없어 **매 실행마다 대상 폴더 PPT 전체**를 다시 파싱함 |
| `--retry` | - | AIP 실패 목록(`data/kpi_aip_failed.txt`)만 재처리 |
| `TITLE_KEYWORD` | `"KPI/경영현황"` | 이 문자열이 슬라이드 제목에 없으면 KPI 표를 못 찾은 것으로 보고 건너뜀 |
| `REPORT_STAGE_KEYWORDS` | `[사전검토, 사업계획, 제안, 착수, 중간, 완료, 검토]` | 파일명에서 보고단계를 판별할 때 찾는 키워드 목록 |
| `FOLDER_PART_MAP` | 폴더명 → 파트 매핑 | 파일명에 파트 키워드가 없을 때, 상위 폴더명으로 파트를 판단하는 보조 규칙 |

KPI는 매번 전체를 다시 읽기 때문에 `코드충돌` 시트도 매 실행마다 최신 상태로 재평가됩니다 — 재무처럼
"재평가하려면 `FORCE_REPROCESS`로 강제로 다시 태워야" 하는 문제가 없습니다.

### 품질 감사 스크립트 (`scripts/quality_audit*.py`)

추출과는 별개로, 담당자 요청 기준의 별도 감사 보고서(`data/quality_report.xlsx`)를 만드는 스크립트
묶음입니다(`quality_audit.py`/`quality_audit_full.py`/`quality_audit_collisions.py`/
`quality_audit_placeholders.py`). 최신 PPT 템플릿(`[내부용①] 재무관점 필수 데이터` 키워드) 미반영
파일은 집계에서 제외합니다 — CLAUDE.md 규칙과 동일 기준.

---

## 실행 방법

> **핵심 원칙**: 서버는 `python app.py` **하나만** 실행하면 됩니다.
> 경영실적·KPI·AI 인사이트·다운로드 등 모든 API를 이 서버 하나가 담당합니다.
> 추출 스크립트(`extract_*.py`)는 서버가 아닙니다 — PPT에서 Excel을 만드는 **1회성 변환 도구**입니다.

### 서버 vs 추출 스크립트 구분

```
[추출 스크립트]  PPT 폴더 → (1회 실행) → data/*.xlsx  ← Flask가 읽어서 서빙
[Flask 서버]     python app.py → 경영실적/KPI/AI/다운로드 API 모두 제공
[프론트엔드]     npm run dev   → 브라우저 화면
```

추출 스크립트는 PPT 데이터가 바뀔 때만 다시 실행합니다.
**평상시에는 `python app.py` + `npm run dev` 두 개만 켜면 됩니다.**

### 0. 서버 시작/종료를 한 번에 (선택)

```powershell
python dashboard_manager.py           # 토글: 꺼져있으면 시작, 켜져있으면 종료 (백엔드+프론트 동시)
python dashboard_manager.py --status  # 현재 상태만 확인
```

포트(`:5000`/`:5188`) 실제 응답 여부로 상태를 판단하므로, `npm run dev`가 남긴 orphan 프로세스
문제 없이 안전하게 재시작할 수 있습니다.

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

**3) 재무 데이터 추출** (data/ 폴더에 Excel이 없으면 경영실적 탭 재무 파트가 빈 화면)
```powershell
python scripts/extract_financial_ppt.py
```

**4) 현대 브랜드 폰트 배치** (선택 — 안 넣으면 맑은고딕으로 폴백, 기능은 정상)
- 사내에서 받은 현대 폰트 `.ttf` 10개를 `frontend/public/fonts/` 에 복사
- **파일명이 정확히 일치**해야 함 → 목록·규칙은 [`frontend/public/fonts/README.md`](frontend/public/fonts/README.md) 참고
- 폰트 파일은 라이선스/용량(약 22MB) 때문에 git 에 올리지 않음 (`.gitignore` 처리됨)

> 실적 현황은 엑셀 파일을 직접 읽으므로 추출 스크립트 없음.
> `data/` 폴더에 `26년 사업계획 통합관리 파일_*.xlsx`가 있으면 자동 인식.

**5) `.env` 설정** (선택 — AI 위젯·Navbar 추출 기능을 쓰려면 필요)
```powershell
copy .env.example .env
# EXTRACT_ADMIN_KEY, H_CHAT_API_KEY 등 값 채우기
```

### 2. 매일 사용할 때 (서버 실행)

```powershell
# 터미널 1 — Flask 서버 (경영실적·KPI·AI·다운로드 API 전부 여기서 제공)
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
- **탭 URL 연동**: 새로고침해도 현재 탭 유지 (`/#/performance`, `/#/kpi`, 레거시 `/#/finance`)
- **사이드 리모컨**: 화면 오른쪽 고정 버튼으로 탭 즉시 전환 (스크롤 불필요)
- **다크/라이트 모드**: 상단 Navbar 토글, 현대 브랜드 9색 팔레트 기반(이익=빨강/손실=파랑, 국내 증시 관행)
- **파트·보고단계 필터**: 칩(체크박스) 방식, "전체" 클릭으로 select-all-then-exclude
- **AI 인사이트 위젯**: 탭 상단에서 그 탭의 수치를 H-Chat(Claude)이 해석한 서술형 코멘트 제공. 원본
  mtime 기준 캐시되어 재추출 전까지는 재호출하지 않음
- **차트 클릭 → 산출 근거 드릴다운**: 막대/도넛 조각/파트별 달성 현황 행을 클릭하면 그 값이 어떤
  프로젝트를 합산한 것인지 표로 확인 + CSV 다운로드
- **데이터 이상 배지**: Navbar ⚙ 옆 "!" — 재무↔KPI 코드 불일치, 코드충돌, 완료보고 이상 자동 감지
- **엑셀 다운로드**: 탭별 다운로드 버튼으로 추출·원본 엑셀을 항상 최신 버전으로 다운로드
- **PPT 데이터 추출(관리자)**: Navbar ⚙ → 키 입력 후 재무/KPI 재추출을 대시보드 안에서 직접 실행·중지

### 테이블 공통
- **컬럼 드래그 이동**: 헤더를 드래그하여 컬럼 순서 변경 → 새로고침 후에도 유지
- **컬럼 너비 조정**: 헤더 우측 끝 드래그(더블클릭 시 내용에 맞춰 auto-fit) → 새로고침 후에도 유지
- **컬럼 표시/숨김**: "컬럼 ▾" 버튼으로 토글
- **서버사이드 페이지네이션**: 전체 건수 기준 서버에서 페이지 분할
- **검색**: 프로젝트코드·파트명 등 실시간 검색(매치 텍스트 하이라이트)
- **셀 팝업**: 긴 텍스트 셀 클릭 시 전체 내용 오버레이로 확인 + 복사

### KPI 탭
- **KPI 집계 테이블**: 8개 KPI 항목의 목표 vs 실적 vs 25년 유사실적 비교, 드릴다운 지원
- **취합 목록 뷰**: 1행/프로젝트 플랫 테이블 (컬럼별 KPI 값 확인)
- **취합 KPI 상세 뷰**: 1프로젝트 = 8행 rowspan 구조 (PPT 표와 동일한 형태)
- **뷰 전환**: 툴바의 `목록 | KPI 상세` 토글로 즉시 전환

### 경영실적/재무데이터 탭
- **KPI 카드**: 계획·추정 실적·매출이익·경상손익·누계 실적 — 드래그로 순서 변경(localStorage 저장)
- **파트별 계획 vs 추정 실적 / 파트별 이익율 / 원가구성 도넛 / 파트별 달성 현황**: 전부 클릭 시 드릴다운
- **재무이력 2뎁스 대조**: 프로젝트 검색 시 재무(`finance.py`) 쪽 단계별 이력을 나란히 대조
- **인사이트**: 목표 대비 부진 프로젝트, 손실/저수익 경고 랭킹 + 코멘트

---

## API 엔드포인트

### 경영실적(실적 현황)
| 엔드포인트 | 설명 |
|-----------|------|
| `GET /api/performance/summary` | KPI 카드용 집계 + 파트별 집계 + 월별 실적 배열 |
| `GET /api/performance/summary/breakdown` | 차트 막대/조각 클릭 시 산출 근거 프로젝트 목록 |
| `GET /api/performance/data` | 프로젝트 전체 실적 (페이지네이션·필터) |
| `GET /api/performance/insights` | 목표 대비 부진·손실/저수익 랭킹 + 코멘트 |
| `GET /api/performance/options` | 파트·팀 필터 목록 |
| `POST /api/performance/reload` | 엑셀 캐시 갱신 |

### 재무 데이터 (레거시 `/finance` 탭 + 경영실적 2뎁스 대조에서 사용)
| 엔드포인트 | 설명 |
|-----------|------|
| `GET /api/summary` | 집계 요약 (총매출·이익·파트별) |
| `GET /api/summary/breakdown` | 차트 클릭 시 산출 근거 프로젝트 목록 |
| `GET /api/data` | 프로젝트 목록 (페이지네이션·필터·검색) |
| `GET /api/finance/codes` | 프로젝트코드 목록(2뎁스 대조 검색용) |
| `GET /api/insights` | TOP5·리스크·인사이트 코멘트 |
| `GET /api/export/pdf` | PDF 보고서 다운로드 |
| `POST /api/finance/open-file` | 원본 PPT 파일 열기(NAS 경로, 현재 UI에서는 비노출) |
| `POST /api/reload` | 엑셀 캐시 갱신 |

### KPI
| 엔드포인트 | 설명 |
|-----------|------|
| `GET /api/kpi/summary` | 8개 KPI 항목 목표 vs 실적 집계 |
| `GET /api/kpi/summary/breakdown` | 차트 막대 클릭 시 산출 근거 프로젝트 목록 |
| `GET /api/kpi/data` | 취합 시트 원본 (페이지네이션·검색) |
| `GET /api/kpi/options` | 필터 목록 |
| `POST /api/kpi/open-file` | 원본 PPT 파일 열기(NAS 경로, 현재 UI에서는 비노출) |
| `POST /api/kpi/reload` | 엑셀 캐시 갱신 |

### AI 인사이트
| 엔드포인트 | 설명 |
|-----------|------|
| `GET /api/ai/finance?force=1` | 경영실적 탭 수치 해석 코멘트 (H-Chat/Claude). `force=1`이면 캐시 무시하고 재생성 |
| `GET /api/ai/kpi?force=1` | KPI 탭 수치 해석 코멘트 |

### 다운로드
| 엔드포인트 | 설명 |
|-----------|------|
| `GET /api/download` | 다운로드 가능한 파일 목록 + 최종 수정 시각 |
| `GET /api/download/<key>` | 파일 다운로드 (`finance` / `kpi` / `performance`) |

### PPT 데이터 추출 (관리자, `EXTRACT_ADMIN_KEY` 필요)
| 엔드포인트 | 설명 |
|-----------|------|
| `POST /api/extract/auth` | 관리자 키 확인 |
| `POST /api/extract/run` | 재무/KPI 추출 실행 (증분/강제/초기화 모드) — 백그라운드 스레드 |
| `POST /api/extract/cancel` | 진행 중인 추출 중지 |
| `GET /api/extract/status` | 진행 상태 폴링 |

### 데이터 품질
| 엔드포인트 | 설명 |
|-----------|------|
| `GET /api/data-health` | 재무↔KPI 코드 불일치 + 코드충돌 + 완료보고 이상 종합 |

---

## 기술 스택

| 구분 | 기술 |
|------|------|
| Backend | Python · Flask · pandas · openpyxl · pyxlsb · waitress · httpx(H-Chat 연동) · reportlab(PDF) |
| Frontend | React 19 · TypeScript · Vite · TanStack Query · TanStack Table · Zustand · Chart.js · React Router |
| DnD | @dnd-kit/core · @dnd-kit/sortable (컬럼·카드 순서 드래그) |
| 데이터 추출 | python-pptx · win32com (AIP 암호화·구버전 PPT/Excel 처리) |
| AI | 사내 H-Chat API Gateway를 통한 Claude 호출 (`ai_insight.py`) |
| 운영 | `dashboard_manager.py`(서버 시작/종료 토글) · `dashboard_update.py`(PPT 재추출 배치) |

---

## 폴더 구조

```
dashboard/
├── app.py                    # Flask 앱 생성 + Blueprint 등록 + 데이터 품질 감시 + PPT 추출 관리 API + 서버 실행 (진입점)
├── finance.py                # 재무 API (/api/data, /api/summary, /api/insights, breakdown, open-file 등)
├── performance.py            # 경영실적 API (/api/performance/*)
├── kpi.py                    # KPI API (/api/kpi/*)
├── ai_insight.py             # AI 인사이트 API (/api/ai/*, H-Chat 연동)
├── downloads.py               # 엑셀 다운로드 API (/api/download*)
├── shared.py                  # 공유 유틸 (is_ranked_valid_code, strip_stage_suffix 등)
├── paths.py                   # 데이터/엑셀 경로 단일 관리 (.env 우선)
├── dashboard_manager.py       # 서버(백엔드+프론트) 시작/종료 토글 스크립트
├── dashboard_update.py        # PPT 재추출 + 캐시 갱신 배치 스크립트 (스케줄러용)
├── requirements.txt
├── scripts/
│   ├── extract_financial_ppt.py   # PPT → 재무 엑셀 추출 (증분)
│   ├── extract_kpi_ppt.py         # PPT → KPI 엑셀 추출 (전량)
│   ├── compare_and_update.py      # ★ 비교·추출·갱신 통합 자동화
│   ├── check_perf_headers.py      # 실적 엑셀 새 달 시트 컬럼 확인용
│   ├── quality_audit*.py          # 담당자용 품질 감사 보고서(data/quality_report.xlsx) 생성
│   └── file_compare.py            # PPT 폴더 비교 유틸
├── data/                     # 추출된 엑셀 파일 (git 제외)
│   ├── 재무관점 필수 데이터 추출.xlsx
│   ├── KPI 지표 데이터 추출.xlsx
│   ├── 26년 사업계획 통합관리 파일_*.xlsx
│   └── ai_analysis_cache.json
├── frontend/
│   └── src/
│       ├── App.tsx            # 라우터 + 레이아웃
│       ├── main.tsx           # HashRouter + QueryClient
│       ├── layouts/           # Navbar, FilterBar, TabLayout
│       ├── pages/             # Finance, Kpi, Performance, Satisfaction(숨김)
│       ├── components/
│       │   ├── ui/            # DataTable, KpiCard, Button, TabNav, ChartCard 등
│       │   └── features/      # ProjectTable, KpiRawTable, PerformanceTable, *BreakdownModal, AiInsightWidget 등
│       ├── hooks/viewmodels/  # 데이터 fetch + 가공 로직
│       ├── store/             # Zustand (filter, theme, tab, ui)
│       └── types/             # TypeScript 인터페이스
├── tests/                    # pytest (finance/kpi/performance/shared 단위 테스트)
└── docs/                     # API 스펙, 데이터 스키마, 세션 로그, 알려진 문제
```

---

## Git

```
Remote: https://github.com/leeks0103-hash/Finance-Dashboard.git
Branch: main
```
