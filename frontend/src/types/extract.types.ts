export type ExtractTarget = 'finance' | 'kpi';

/** incremental=증분(기본, 바뀐 파일만) · force=초기화 없이 전체 재처리 · reset=출력 초기화 후 전체 재구축(파괴적) */
export type ExtractMode = 'incremental' | 'force' | 'reset';

export interface ExtractStatus {
  running:     boolean;
  targets:     ExtractTarget[];
  mode:        ExtractMode | null;
  started_by:  string | null;
  started_at:  string | null;
  finished_at: string | null;
  ok:          boolean | null;
  message:     string;
  cancelled:   boolean;
}
