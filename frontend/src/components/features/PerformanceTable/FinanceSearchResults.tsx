import { useMemo, type ReactNode } from 'react';
import { DataTable, Button } from '@/components/ui';
import { useUiStore } from '@/store';
import type { Project } from '@/types/finance.types';
import { buildFinanceColumns, downloadFinanceCsv } from './financeColumns';
import styles from './FinanceSearchResults.module.css';

interface Props {
  results:    Project[];
  searchTerm: string;
  info?:      ReactNode;
}

const FinanceSearchResults = ({ results, searchTerm, info }: Props) => {
  const handleCsv = () => downloadFinanceCsv(`재무데이터검색결과_${searchTerm}`, results);
  const columns = useMemo(() => buildFinanceColumns(searchTerm), [searchTerm]);
  const rawValues = useUiStore(s => s.showRawValues);

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
        meta={{ rawValues }}
        defaultPageSize={10}
        pageSizeOptions={[10, 20]}
        // minRows 기본값(5) 사용 — 8로 고정해뒀던 게 검색 결과 1~2건일 때 필요 이상으로
        // 빈 공간을 넓게 예약해 테이블이 커 보이던 원인(2026-09-22 피드백)
        emptyIcon="🔍"
        emptyTitle="재무 데이터 없음"
        emptyDescription={`"${searchTerm}"에 해당하는 재무 데이터가 없습니다.`}
        storageKey="perf-finance-2depth"
        // 매출/지출/직접원가 등 재무 컬럼을 새로 추가하면서 기본 폭을 좁게(60~90px) 잡았는데,
        // localStorage에 이전(컬럼 추가 전) 리사이즈 값이 남아있으면 그게 우선 적용돼 새
        // 기본값이 무시됨 — 저장된 폭 1회 무효화(2026-09-22, 가로스크롤 원인)
        sizeVersion={2}
        // 페이지 안에 짧게 끼워 넣는 검색 결과 패널이라 자체 스크롤 영역이 불필요 — 내용
        // 높이만큼만 자연스럽게 렌더(2026-09-22)
        scrollable={false}
      />
    </div>
  );
};

export default FinanceSearchResults;
