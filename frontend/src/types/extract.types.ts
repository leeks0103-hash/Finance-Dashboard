export type ExtractTarget = 'finance' | 'kpi';

/** incremental=증분(기본, 바뀐 파일만) · force=초기화 없이 전체 재처리 · reset=출력 초기화 후 전체 재구축(파괴적) */
/** failed = 추출 현황에서 '실패'인 파일만 다시(DRM 제외, 2026-10-01) */
export type ExtractMode = 'incremental' | 'force' | 'reset' | 'failed';

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

/** 추출 현황(관리자용 기능 모달) — 원본 폴더의 파일 하나하나가 어떻게 처리됐는지.
 *  extracted=행 있음 / merged=행은 뽑았지만 같은 키를 쓰는 다른 파일 이름으로 남음 / no_table=표 없는 PPT /
 *  failed=열기 실패 / pending=아직 처리 안 됨 */
export type CoverageStatus = 'extracted' | 'merged' | 'no_table' | 'failed' | 'pending';

export interface CoverageItem {
  file:   string;
  status: CoverageStatus;
  /** 취합 시트에서 이 파일 이름으로 남은 행 수 */
  rows:   number;
  reason: string;
  /** 원본 처리 메시지(오류 코드 등) — 실패 항목만, 화면엔 툴팁으로만 */
  detail?: string;
  /** 마지막 처리 시각 */
  at:     string;
}

export interface SourceCoverage {
  label:           string;
  /** 결과 엑셀을 읽었는지 — false면 숫자가 비어 있음(AIP 암호화로 COM까지 실패 등) */
  excel_ok:        boolean;
  /** 원본 폴더에서 이 추출이 대상으로 삼는 PPT 파일 수(스크립트와 같은 규칙) */
  folder_files:    number;
  counts:          Record<CoverageStatus, number>;
  /** 취합 시트 행 수 — 파일 수와 다른 게 정상(한 파일에 여러 행, 같은 키는 덮어씀) */
  rows_total:      number;
  /** 하위 폴더 두 곳 이상에 같은 이름으로 있는 파일 수(결과 엑셀에선 구분 안 됨) */
  duplicate_names: number;
  /** 결과 엑셀엔 있는데 폴더엔 없는 파일 */
  orphans:         string[];
  items:           CoverageItem[];
}

export interface ExtractCoverage {
  ok:          boolean;
  error?:      string;
  folder?:     string;
  scanned_at?: string;
  finance?:    SourceCoverage;
  kpi?:        SourceCoverage;
}
