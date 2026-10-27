/** 화면 공개 범위 — all 전체 / admin 관리자 인증한 브라우저만 / none 아무도 */
export type Visibility = 'all' | 'admin' | 'none';

/** 서버(data/visibility.json)에 저장되는 기능별 공개 범위 — 모든 화면이 같은 값을 읽음 */
export interface VisibilitySettings {
  /** 파일 바로가기(↗) 버튼 */
  fileOpen: Visibility;
  /** 폴더 바로가기(파일이 든 폴더 열기) — ↗와 따로(2026-10-20) */
  folderOpen: Visibility;
  /** 파트별 계획 vs 실적의 달성률 — 전체/관리자/숨김(2026-10-14 '전체' 추가, 기본 숨김) */
  achieveRate: Visibility;
  /** AI 인사이트 버튼 — 관리자 기능 토글(켬 = all / 끔 = none, 2026-10-20) */
  aiInsight: Visibility;
  /** 업데이트(재추출) 요청 버튼 — 전체/관리자/숨김(2026-10-22) */
  extractRequest: Visibility;
}

/** 실적 탭 필터바 오른쪽 "경영실적 현황 업데이트" 칸 — 서버(data/perf_update.json) 저장, 관리자만 고침 */
export interface PerfUpdateNote {
  label: string;
  note: string;
}

/** 파트별 인원 — 서버(data/headcount.json), 관리자가 수기 입력. 키는 원문자 접두 뗀 파트명, 미입력 파트는 키 없음(2026-10-23).
 *  parts = 현재 인원. plan_parts(계획 인원)는 2026-10-27 주석 처리 — 서버 응답엔 아직 있을 수 있음 */
export interface HeadcountSettings {
  parts:      Record<string, number>;
  // plan_parts: Record<string, number>;   // 계획 인원 주석 처리(2026-10-27)
  updated_at: string;
  updated_by: string;
}
