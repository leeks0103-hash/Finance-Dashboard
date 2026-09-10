import { useMemo } from 'react';
import { createColumnHelper } from '@tanstack/react-table';
import { usePerformanceInsightViewModel } from '@/hooks/viewmodels';
// 아래 코드 컬럼 cell(주석 처리됨)을 되살릴 때 CopyText 도 다시 import 할 것 —
// 쓰지 않는 import 가 남아 있으면 build(noUnusedLocals)가 실패한다
import { DataTable } from '@/components/ui';
import { useQuickSearchStore } from '@/store/quickSearch.store';
import FinanceDetailPanel from './FinanceDetailPanel';
import type { Project } from '@/types';

const h = createColumnHelper<Project>();

const PerformanceInsightSection = () => {
  const vm = usePerformanceInsightViewModel();
  const setPerfSearch = useQuickSearchStore(s => s.setPerf);

  // 미수주는 실적현황엔 없고 재무(PPT)에만 있는 데이터라 Project 원본으로 직접 컬럼 구성 —
  // 코드 컬럼만 CopyText(클릭 복사/더블클릭 검색) 담당, 나머지 셀 더블클릭은 expandableRow가 담당
  const missedBidColumns = useMemo(() => [
    // h.accessor('project_code', {
    //   header: '코드',
    //   size: 120,
    //   // 여긴 실적현황(다른 데이터셋) 검색창을 채우는 용도라 재무 교차조회(FinanceCrossCheckPanel)와
    //   // 달리 placeholder 코드라도 그냥 검색 시도 — 못 찾으면 "결과 없음"이 뜰 뿐 잘못된 매칭이 아님
    //   cell: i => <CopyText text={i.getValue()} onSearch={setPerfSearch} />,
    // }),
    h.accessor('part', { header: '파트', size: 90 }),
    h.accessor('note', { header: '비고', size: 220, cell: i => <span title={i.getValue()}>{i.getValue() || '-'}</span> }),
    h.accessor('missed_bid_reason', {
      header: '미수사유',
      size: 260,
      cell: i => {
        const reason = i.getValue() || '-';
        return <span title={reason}>{reason}</span>;
      },
    }),
    h.accessor('filename', { header: '파일명', size: 320, cell: i => <span title={i.getValue()}>{i.getValue()}</span> }),
  ], [setPerfSearch]);

  return (
    <DataTable<Project>
      data={vm.missedBidProjects}
      columns={missedBidColumns as never}
      // project_code는 미배정 placeholder("생성 예정" 등)라 여러 행이 값이 겹칠 수 있음 —
      // _row_num(원본 시트 행 번호)만 진짜 유니크해서 행 식별·펼침 키로 반드시 이걸 써야 함
      getRowId={p => String(p._row_num)}
      isLoading={vm.isLoading}
      compact
      hideToolbar
      /* storageKey — 헤더 드래그로 컬럼 순서 변경 + 폭 조절, localStorage 저장 */
      storageKey="perf-missed-bid"
      /* sizeVersion — 컬럼별 size 신규 지정 + td max-width 상한 제거에 맞춰 저장된 폭 1회 초기화 */
      sizeVersion={2}
      defaultPageSize={20}
      pageSizeOptions={[20]}
      emptyIcon="📋"
      emptyTitle="미수주 프로젝트 없음"
      emptyDescription="재무 PPT에만 있는 미수주 프로젝트가 없습니다."
      expandableRow={{
        getKey: p => String(p._row_num),
        excludeColumns: ['project_code'],
        renderContent: (p, close) => <FinanceDetailPanel project={p} onClose={close} />,
      }}
    />
  );
};

export default PerformanceInsightSection;
