/** 화면 공개 범위 — all 전체 / admin 관리자 인증한 브라우저만 / none 아무도 */
export type Visibility = 'all' | 'admin' | 'none';

/** 서버(data/visibility.json)에 저장되는 기능별 공개 범위 — 모든 화면이 같은 값을 읽음 */
export interface VisibilitySettings {
  /** 파일 바로가기(↗) 버튼 */
  fileOpen: Visibility;
  /** 파트별 계획 vs 실적의 달성률 — 'all'은 서버가 받지 않음(저조 팀 노출 방지) */
  achieveRate: Visibility;
}
