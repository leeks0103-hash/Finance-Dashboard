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
    /**
     * 제공 시, 이 컬럼의 셀(20자 이상 자동 팝업)이 열릴 때 팝업에 "↗ 바로가기" 버튼이
     * 추가로 뜬다 — 파일명처럼 원본을 직접 열어야 하는 컬럼용 (예: 재무 PPT 파일명)
     */
    onOpenFile?: (value: string) => void;
    /**
     * 제공 시, <td>의 title(마우스오버 툴팁)을 원본 raw 값 대신 이 함수의 결과로 대체.
     * 셀이 raw 값을 그대로 안 보여주고 가공(억/만 단위 축약 등)해서 보여주는 컬럼에서,
     * <td> 기본 title(raw 그대로)과 셀 안 커스텀 title이 따로 붙어 호버 위치에 따라
     * 다른 값이 보이던 문제 방지 — title은 반드시 <td> 하나에만 있어야 함
     */
    formatTitle?: (value: unknown) => string | undefined;
  }
}
