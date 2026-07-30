# 세션 진행 기록

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
