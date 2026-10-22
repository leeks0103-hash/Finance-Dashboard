import { useMemo } from 'react';
import { DataTable } from '@/components/ui';
import { useUiStore } from '@/store';
import { buildFinanceColumns } from '@/components/features/PerformanceTable/financeColumns';
import FinancePanelShell from '@/components/features/PerformanceTable/FinancePanelShell';
import type { Project } from '@/types';

interface Props {
  project: Project;
  onClose: () => void;
}

/**
 * 미수주는 실적현황에는 없고 재무(PPT)에만 존재하는 데이터라 교차조회할 대상이 없음 —
 * 이미 fetch된 Project 한 건을 프로젝트 상세의 "재무 이력"(FinanceCrossCheckPanel)과 같은 셸·표·컬럼으로 보여줌
 * (예전 key-value 카드는 모양이 달라 값을 한눈에 보기 힘들었음, 2026-10-22). 별도 API 호출 없음.
 * 미수사유·처리일·반영일은 이 패널 전용 컬럼(`detail`).
 */
const FinanceDetailPanel = ({ project, onClose }: Props) => {
  // 프로젝트코드는 패널 헤더, 파일명은 바로 위 1뎁스 행에 이미 있어 뺌(2026-10-22 요청)
  const columns = useMemo(
    () => buildFinanceColumns('', { detail: true }).filter(c => c.accessorKey !== 'project_code' && c.accessorKey !== 'filename'),
    [],
  );
  const data = useMemo(() => [project], [project]);
  const rawValues = useUiStore(s => s.showRawValues);

  return (
    <FinancePanelShell title="재무 데이터(PPT) 상세" code={project.project_code} onClose={onClose}>
      <DataTable<Project>
        data={data}
        columns={columns as never}
        getRowId={row => String(row._row_num)}
        meta={{ rawValues }}
        defaultPageSize={10}
        pageSizeOptions={[10]}
        minRows={1}
        // 처리일·반영일은 기본 숨김(컬럼 메뉴로 켬)
        initialColumnVisibility={{ processed_at: false, reflected_at: false }}
        emptyIcon="list"
        emptyTitle="재무 데이터 없음"
        emptyDescription="PPT에서 추출된 재무 데이터가 없습니다"
        storageKey="missed-bid-finance-detail"
        scrollable={false}
      />
    </FinancePanelShell>
  );
};

export default FinanceDetailPanel;
