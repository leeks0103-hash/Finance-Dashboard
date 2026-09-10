import '@tanstack/react-table';

declare module '@tanstack/react-table' {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  interface TableMeta<TData> {
    /** 현재 검색어 — 셀 렌더러에서 매치 텍스트 하이라이트용 */
    searchQuery?: string;
    /** 재무 PPT 이력이 있는 프로젝트코드 → 건수. 2뎁스 보유 배지 표시용 */
    financeCodes?: Record<string, number>;
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  interface ColumnMeta<TData extends RowData, TValue> {
    /**
     * 필터·기간에 따라 값이 바뀌지 않는 고정 컬럼 — 헤더·셀에 음영을 넣어
     * 변동 컬럼과 시각적으로 구분한다 (예: KPI 집계의 KPI 항목·26년 목표(사업계획))
     */
    staticCol?: boolean;
  }
}
