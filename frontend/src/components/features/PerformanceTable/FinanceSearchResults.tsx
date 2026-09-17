import { useMemo, type ReactNode } from 'react';
import { createColumnHelper } from '@tanstack/react-table';
import { DataTable, Button, CopyText, HighlightText } from '@/components/ui';
import { openFinanceFile } from '@/api/finance.api';
import { downloadCsvFile } from '@/hooks/useExport';
import type { Project } from '@/types/finance.types';
import styles from './FinanceSearchResults.module.css';

const openFile = (filename: string) => {
  openFinanceFile(filename).then(r => { if (!r.ok) window.alert(r.message ?? '파일을 열 수 없습니다.'); });
};

const ch = createColumnHelper<Project>();

interface Props {
  results:    Project[];
  searchTerm: string;
  info?:      ReactNode;
}

const FinanceSearchResults = ({ results, searchTerm, info }: Props) => {
  // 지금 화면에 뜬 검색 결과(로우데이터)를 그대로 CSV로 — 재무데이터 다운로드(원본 엑셀 전체)와는
  // 별개로, "이 검색 결과만" 받고 싶을 때 쓰는 용도
  const handleCsv = () => {
    downloadCsvFile(
      `재무데이터검색결과_${searchTerm}_${new Date().toISOString().slice(0, 10)}.csv`,
      ['프로젝트코드', '연도', '파트', '보고단계', '비고', '파일명',
       '매출', '지출', '직접원가', '인건비', '공통원가', '경상이익', '이익율'],
      results.map(r => [r.project_code, r.year, r.part, r.stage, r.note, r.filename,
        r.revenue, r.expenditure, r.direct_cost, r.labor_cost, r.overhead, r.operating_profit, r.profit_rate]),
    );
  };

  const columns = useMemo(() => [
    ch.accessor('project_code', {
      header: '프로젝트코드',
      cell: i => <CopyText text={i.getValue()} highlight={searchTerm} />,
    }),
    ch.accessor('part',  { header: '파트',   cell: i => <HighlightText text={i.getValue()} query={searchTerm} /> }),
    ch.accessor('year',  { header: '연도' }),
    ch.accessor('stage', { header: '보고단계' }),
    ch.accessor('note',  {
      header: '비고',
      cell: i => {
        const v = i.getValue();
        return v ? <HighlightText text={v} query={searchTerm} /> : <span style={{ color: 'var(--text-muted)' }}>-</span>;
      },
    }),
    ch.accessor('filename', {
      header: '파일명',
      // 파일명이 길어서(20자↑) 클릭 시 DataTable 기본 팝업(복사 + 이 meta로 "바로가기" 버튼 추가)이 뜬다
      cell: i => {
        const v = i.getValue();
        return v ? <HighlightText text={v} query={searchTerm} /> : <span style={{ color: 'var(--text-muted)' }}>-</span>;
      },
      meta: { onOpenFile: openFile },
    }),
  ], [searchTerm]);

  return (
    <div className={styles.wrap}>
      <DataTable<Project>
        data={results}
        columns={columns as never}
        getRowId={row => String(row._row_num)}
        title="재무 데이터 검색 결과"
        info={info}
        toolbarExtra={
          <Button variant="success" size="sm" onClick={handleCsv} disabled={results.length === 0}>
            ↓ CSV
          </Button>
        }
        defaultPageSize={10}
        pageSizeOptions={[10, 20]}
        // 검색 결과가 1~2건이어도 본문이 너무 작아 보이지 않도록 최소 행 수 확보
        minRows={8}
        emptyIcon="🔍"
        emptyTitle="재무 데이터 없음"
        emptyDescription={`"${searchTerm}"에 해당하는 재무 데이터가 없습니다.`}
        storageKey="perf-finance-2depth"
      />
    </div>
  );
};

export default FinanceSearchResults;
