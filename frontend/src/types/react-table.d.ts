import '@tanstack/react-table';

declare module '@tanstack/react-table' {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  interface TableMeta<TData> {
    /** 현재 검색어 — 셀 렌더러에서 매치 텍스트 하이라이트용 */
    searchQuery?: string;
  }
}
