# 세션 진행 기록

## [2026-08-05] 데이터 추출 재실행 + 필터 완화 + 파일 비교

**완료된 작업**
- 재무 데이터 재추출 (143개 PPT → 131행 → API 127건)
- KPI 데이터 재추출 (143개 PPT → 138행 → API 35건)
- Flask 서버 재시작 및 `/api/reload`, `/api/kpi/reload` 적용
- `app.py` `_is_valid_code` 필터 완화 — 빈 코드/"0"만 제외, 숫자코드·예정/미정/신규 허용 (99건 → 127건)
- `DataTable` DndContext를 `<thead>` 밖으로 이동 — DOM 중첩 오류 수정
- `file_compare.py` 경로 업데이트 — NAS(`X:`), 로컬(`D:\24...`), 결과(`data/compare_report.xlsx`)
- NAS vs 로컬 PPT 파일 비교 실행 → 143개 파일 완전 동일 확인

**다음 세션 과제**
- KPI AI교육 적절성 사업계획 PPT 원본 오입력 직접 수정 필요 (추출 스크립트 문제 아님)
- 실적 현황 탭 인사이트 섹션 미구현
- vite.config.ts 프록시 포트 환경변수화

---

## [2026-08-04] 추출 스크립트 증분 업데이트 + 에러 분석

**분석한 에러 (11234.png)**
1. **KPI AI교육 적절성 사업계획 이상값** — PPT 원본 오입력 문제 (코드 버그 아님). D7=3869.06은 '26년 목표(사업계획) 셀에 적절성 점수 대신 인원수가 입력된 결과
2. **재무 Excel 135건 vs API 108건** — 프로젝트코드 없음/매출 0 행 27건 Flask 자동 필터링 (정상 동작)
3. **재무 파트명 '-' 인식 실패** — 파일명에 키워드 없는 파일들 → 폴더명 기반 추출로 해결

**완료된 작업**
- `extract_financial_ppt.py`: `RESET_OUTPUT_ON_START=False`, `FORCE_REPROCESS=False` — 기존 데이터 보존, 증분 업데이트 전환
- `extract_kpi_ppt.py`: ROOT_DIR 기본값 오타 수정 (`수집 NEW` → `수집`)
- 두 스크립트: `FOLDER_PART_MAP` 추가 — 폴더명으로 파트명 우선 판단
  - `AI교육파트`→AI, `SW교육파트`→SW, `교육사업PM파트`→PM
  - `신사업기획파트`→신사업, `미래모빌리티교육파트`→미모
  - `전동화&차량개발교육파트`→전차, `K뉴딜 아카데미 TF`→K뉴딜TF
- 두 스크립트: CLI 인수 지원 — `python script.py "C:\새폴더"` 로 새 배치 폴더 처리 가능

**다음 세션 과제**
- KPI AI교육 적절성 사업계획 PPT 원본 오입력 직접 수정 필요 (추출 스크립트 문제 아님)
- 재무 데이터 새 폴더 기준 재추출 실행 (스크립트 실행)
- 실적 현황 탭 인사이트 섹션 미구현
- vite.config.ts 프록시 포트 환경변수화

---

## [2026-08-03] UI 개선 및 버그 수정 세션 (오후)

**완료된 작업**
- 컬럼 드롭박스 외부 클릭 시 자동 닫힘 (useRef + mousedown)
- 다크모드 배경/텍스트 밝기 개선 (surface #182E48, text #F0F8FF)
- 다크모드 탭 리모컨 글씨 색상 수정 (rgba(180,230,255,0.85))
- 다크모드 차트 에메랄드 계열 색상 적용 (rgba(52,211,153))
- KPI 집계 D열(사업계획) update_summary_sheet 추가
- KPI 취합 검색 시 page 1 리셋 누락 버그 수정
- PPT 파일 비교 분석 (기술교육실_프로젝트 보고서 수집 vs Excel 확인본)
- 데이터 검증: KPI AI적절성 사업계획 이상값(14157) 확인 → PPT 원본 데이터 문제
- README 실행 방법 명확화 (서버 vs 추출 스크립트 구분)
- 차트 글로우 효과 시도 후 가독성 문제로 비활성화

**다음 세션 과제**
- KPI AI교육 적절성 사업계획 PPT 원본 데이터 오입력 확인 및 수정
- 재무 데이터 새 폴더 기준 재추출 필요 (extract_financial_ppt.py)
- 실적 현황 탭 인사이트 섹션 미구현
- vite.config.ts 프록시 포트 환경변수화

---

## [2026-08-03] 대규모 개선 세션

**목표**: KPI 상세 뷰 구현, URL 탭 유지, 컬럼 DnD/리사이즈, 코드 리뷰 수정

**완료된 작업**

### 백엔드 (app.py)
- KPI 사업계획 컬럼 추출: extract_kpi_ppt.py에 PPT col 4('26년 목표 사업계획) 파싱 추가
- kpi 집계 시트 D열 사업계획 집계 추가, 헤더 구분 명확화 (`'26년 목표(사업계획)` / `'26년 목표(프로젝트)`)
- 신규/기존 건수 행: 26년 실적·25년 유사실적도 `신규:N건/기존:N건` 형식으로 반환
- KPI 프로젝트코드 필터 regex: `str.match` → `str.fullmatch` ($ 앵커 누락 수정)
- 차트 actual_2026 type 가드: 문자열 값이 Chart.js에 NaN으로 전달되던 문제 수정
- AIP 암호화 Excel/PPT win32com 자동 우회 처리 (기존 세션에서 이미 구현)

### 프론트엔드
- **React Router(HashRouter) 도입**: 탭 URL 연동 (`/#/finance·kpi·performance`), 새로고침 후 탭 유지
- **TabRemote(사이드 리모컨)**: 화면 오른쪽 고정, 스크롤 없이 탭 전환
- **DataTable 컬럼 DnD + 리사이즈**: localStorage 저장, 새로고침 유지. DraggableTh 모듈 스코프 이동(hooks 규칙 준수)
- **KpiRawTable(rowspan 뷰)**: 프로젝트 1개 = KPI 8행, PPT 표 형태 재현. 컬럼 DnD + 리사이즈 지원
- **KPI 취합 뷰 토글**: 목록(플랫) ↔ KPI 상세(rowspan) 툴바 내 전환
- **KPI 집계 테이블**: 검색·정렬 활성화 (hideToolbar 제거)
- **KPI 집계 KPI 상세 뷰**: 툴바에 toolbarExtra prop으로 통합
- 테이블 고정 높이 560px: 마지막 페이지 데이터 적어도 크기 유지
- 테이블 하단 border 추가: 가로스크롤 없어도 하단 선 표시
- 비고 컬럼 → '노트' 텍스트 변경, filename 기본 숨김 복구
- KpiRawTable raw `<button>` → `<Button>` 컴포넌트 교체 (CLAUDE.md 준수)

### 문서
- README 전면 개정: 재무·KPI·실적 계산 방식, 신규 기능 사용법, 데이터 파이프라인

**다음 세션 과제**
- KPI 집계 시트 D열(사업계획) 추출 스크립트 재실행 필요 (서버 재시작 + extract_kpi_ppt.py 실행)
- 실적 현황 탭 인사이트 섹션 미구현 (목표 대비 부진 파트, 손실 경고)
- vite.config.ts 프록시 포트 환경변수화

---

## [2026-07-30] 3탭 대시보드 구축 세션

**목표**: 재무·KPI·실적 현황 3탭 구조 + 공통 컴포넌트 아키텍처 정비

**완료된 작업**

### 백엔드 (app.py)
- 엑셀 컬럼 구조 수정: 13컬럼 → 15컬럼(year·part 포함), `EXCEL_PATH` 로컬 경로 수정
- 실적 API 추가: `/api/performance/*` (data, summary, options, reload) — 사업계획 통합관리 파일 연동
- KPI API 추가: `/api/kpi/*` (data, summary, reload) — KPI 지표 추출 파일 연동
- KPI 집계 로직: 취합 시트 기준 건수→합계/나머지→평균 계산
- NaN JSON 직렬화 수정 (브라우저 파싱 오류 해결)
- 월별 실적 집계: chk_m01~m12 합계 → `/api/performance/summary`에 monthly 추가

### 프론트엔드
- 3탭 네비게이션: `tab.store.ts` + `TabNav` + `TabLayout` (sticky)
- `PerformanceFilterBar` — FilterBar와 동일 레벨로 sticky 고정
- 공통 `DataTable` (TanStack Table 기반): 세로 컬럼 선, 정렬·검색·페이지네이션, 컬럼 숨김, 합계 행, 스켈레톤, 셀 클릭 팝업
- `FinancePage` 분리 (`pages/Finance/`) — App 구조 정비
- `PerformancePage`: 월별 바 차트 + 파트별 실적(compact DataTable) + 프로젝트 상세
- `KpiPage`: 목표 vs 실적 가로 바 차트 + KPI 집계 카드 리스트 + 취합 DataTable
- `PERF_HIDEABLE_COLS` + `perfColumns` 동일 파일(`PerformanceTable/columns.tsx`) 관리
- `utils/format.ts`에 `formatEok`, `formatPctRaw`, `formatNum` 추가
- 프로젝트코드 첫 번째 컬럼 이동 + CopyText 적용
- `DataTable` compact 모드 추가 (파트별 실적 등 고정 소규모 테이블)

**다음 세션 과제**
- `extract_kpi_ppt.py` ROOT_DIR 경로 수정 (PPT 파일 0개 검색 문제)
- `vite.config.ts` 프록시 포트 하드코딩 → 환경변수로 개선
- 파이썬 추출 로직 수정 (PPT → 엑셀 파이프라인 안정화)

---

## [2026-07-20] pandas 도입 + PDF 내보내기 세션

**목표**: 백엔드 리팩토링 + PDF 보고서 기능 추가

**완료된 작업**
- `app.py` pandas 전면 도입: `load_excel` → `pd.read_excel`, 집계 루프 → `groupby/agg/nlargest`
- `profit_rate` 이중 파싱 문제 해결 (known-issues 해소)
- `GET /api/export/pdf` 엔드포인트 추가: 필터 연동, 한글 폰트(맑은고딕), 요약·파트별·TOP5·리스크 섹션
- 대시보드 UI에 PDF 버튼 추가 (필터 상태 유지하여 다운로드)
- `requirements.txt`에 pandas, reportlab 추가

**다음 세션 과제**
- TypeScript 아키텍처 설계 (사용자 주도)
- GitHub MCP 연결 확인 (재시작 후)

---

## [2026-07-20] 초기 구축 세션

**목표**: 재무 대시보드 Flask 앱 초기 구축 + GitHub 업로드 + Claude 자동화 설정

**완료된 작업**
- Flask 앱(`app.py`) 구현: 엑셀 로드, 필터링, 집계, 인사이트 API
- `index.html` 대시보드 UI (연도·파트·보고단계 필터, 차트, 인사이트 카드)
- `style.css` 커스텀 스타일
- Git 초기화 및 GitHub push (`https://github.com/ghtjd1358/Finance-Dashboard.git`)
- CLAUDE.md, `docs/` 문서, `settings.json` 훅, `/deploy` 스킬 구성

**다음 세션 과제**
- EXCEL_PATH 환경 이식성 개선 (다른 PC에서 사용 시 경로 수정 안내 문구 추가 검토)
- 데이터 자동 갱신 주기 검토
- 배포 환경 구성 검토
