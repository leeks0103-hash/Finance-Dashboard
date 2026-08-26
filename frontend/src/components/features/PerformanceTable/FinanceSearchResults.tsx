import { useMemo } from 'react';
import { createColumnHelper } from '@tanstack/react-table';
import { DataTable, CopyText, HighlightText } from '@/components/ui';
import type { Project } from '@/types/finance.types';
import styles from './FinanceSearchResults.module.css';

const ch = createColumnHelper<Project>();

interface Props {
  results:    Project[];
  searchTerm: string;
}

const FinanceSearchResults = ({ results, searchTerm }: Props) => {
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
      cell: i => {
        const v = i.getValue();
        return v ? <HighlightText text={v} query={searchTerm} /> : <span style={{ color: 'var(--text-muted)' }}>-</span>;
      },
    }),
  ], [searchTerm]);

  return (
    <div className={styles.wrap}>
      <DataTable<Project>
        data={results}
        columns={columns as never}
        getRowId={row => String(row._row_num)}
        title="재무 데이터에서도 발견됨"
        defaultPageSize={10}
        pageSizeOptions={[10, 20]}
        emptyIcon="🔍"
        emptyTitle="재무 데이터 없음"
        emptyDescription={`"${searchTerm}"에 해당하는 재무 데이터가 없습니다.`}
        storageKey="perf-finance-2depth"
      />
    </div>
  );
};

export default FinanceSearchResults;
