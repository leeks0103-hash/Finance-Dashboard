import { useMemo } from 'react';
import { DataTable, Spinner } from '@/components/ui';
import { useFinanceCrossCheckViewModel } from '@/hooks/viewmodels';
import { useUiStore } from '@/store';
import type { Project } from '@/types/finance.types';
// downloadFinanceCsv — 재무 이력 CSV 버튼 주석 처리로 미사용(2026-09-28). 복구 시 버튼과 함께 해제
import { buildFinanceColumns /*, downloadFinanceCsv */ } from './financeColumns';
import FinancePanelShell from './FinancePanelShell';
import styles from './FinanceCrossCheckPanel.module.css';

interface Props {
  projectCode: string;
  onClose:     () => void;
}

// 재무 이력 2뎁스 패널 — 표는 "재무 데이터 검색 결과"(FinanceSearchResults)와 같은 DataTable·컬럼 정의 사용
// (예전 자체 <table> 구현을 걷어내고 통일, 2026-09-28). 프로젝트코드는 패널 헤더에 있고 모든 행이
// 같은 값이라 컬럼에서만 뺀다
const FinanceCrossCheckPanel = ({ projectCode, onClose }: Props) => {
  const { isLoading, isAmbiguous, fileCount, sorted } = useFinanceCrossCheckViewModel(projectCode);
  const columns = useMemo(() => buildFinanceColumns('').filter(c => c.accessorKey !== 'project_code'), []);
  const rawValues = useUiStore(s => s.showRawValues);

  return (
    <FinancePanelShell title="재무 이력" code={projectCode} onClose={onClose}>
      {/* CSV 다운로드 — 일단 주석 처리(2026-09-28 요청). 복구 시 위 downloadFinanceCsv import도 해제하고 셸 헤더에 버튼 슬롯 필요
          <Button variant="success" size="sm" onClick={() => downloadFinanceCsv(`재무이력_${projectCode}`, sorted)} disabled={isLoading || isAmbiguous || sorted.length === 0}>↓ CSV</Button> */}
      {isLoading ? (
        <div className={styles.center}><Spinner size="sm" fullPage={false} label="" /></div>
      ) : isAmbiguous ? (
        <div className={styles.emptyBox}>
          <span className={styles.emptyIcon}>⚠️</span>
          <strong className={styles.emptyTitle}>특정 불가</strong>
          <span className={styles.emptySub}>이 코드를 {fileCount}개 파일이 공유합니다</span>
        </div>
      ) : (
        // 데이터 도착 후 표가 한 번에 튀어나오지 않게 — 위에서 아래로 펼치며 페이드인(2026-09-30)
        <div className={styles.reveal}><div className={styles.revealInner}>
        <DataTable<Project>
          data={sorted}
          columns={columns as never}
          getRowId={row => String(row._row_num)}
          meta={{ rawValues }}
          defaultPageSize={10}
          // 행 수 선택 셀렉트 숨김(2026-09-29 요청) — 옵션이 1개면 DataTable이 셀렉트를 안 그림.
          // 복구 시 아래 줄로 교체: pageSizeOptions={[10, 20]}
          pageSizeOptions={[10]}
          emptyIcon="list"
          emptyTitle="재무 데이터 없음"
          emptyDescription="PPT에서 추출된 재무 이력이 없습니다"
          storageKey="perf-finance-cross-check"
          scrollable={false}
        />
        </div></div>
      )}
    </FinancePanelShell>
  );
};

export default FinanceCrossCheckPanel;
