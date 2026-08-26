import { useMemo } from 'react';
import { createColumnHelper } from '@tanstack/react-table';
import { usePerformanceInsightViewModel } from '@/hooks/viewmodels';
import { InsightSectionView, CopyText, DataTable } from '@/components/ui';
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
    h.accessor('project_code', {
      header: '코드',
      size: 120,
      // 여긴 실적현황(다른 데이터셋) 검색창을 채우는 용도라 재무 교차조회(FinanceCrossCheckPanel)와
      // 달리 placeholder 코드라도 그냥 검색 시도 — 못 찾으면 "결과 없음"이 뜰 뿐 잘못된 매칭이 아님
      cell: i => <CopyText text={i.getValue()} onSearch={setPerfSearch} />,
    }),
    h.accessor('part', { header: '파트', size: 70 }),
    h.accessor('note', { header: '비고' }),
    h.accessor('filename', { header: '파일명', cell: i => <span title={i.getValue()}>{i.getValue()}</span> }),
  ], [setPerfSearch]);

  return (
    <InsightSectionView
      isLoading={vm.isLoading}
      isEmpty={vm.isEmpty}
      heading="실적 인사이트"
      comments={vm.comments}
      onCodeSearch={setPerfSearch}
      lists={[
        {
          variant: 'default', title: '미수주 프로젝트', rows: vm.missedBid, plain: true,
          // rows(InsightRow[])는 InsightListSpec 계약 충족용 — 실제 렌더는 원본 Project 배열(vm.missedBidProjects)로,
          // 더블클릭하면 목록에 안 보이는 나머지 재무 필드(연도/단계/원가구성/처리일 등)를 그 자리에서 펼침.
          // 실적현황 쪽엔 애초에 데이터가 없으므로(미수주=낙찰 실패) 교차조회 없이 자기 자신의 상세만 보여줌.
          renderList: () => (
            <DataTable<Project>
              data={vm.missedBidProjects}
              columns={missedBidColumns as never}
              // project_code는 미배정 placeholder("생성 예정" 등)라 여러 행이 값이 겹칠 수 있음 —
              // _row_num(원본 시트 행 번호)만 진짜 유니크해서 행 식별·펼침 키로 반드시 이걸 써야 함
              getRowId={p => String(p._row_num)}
              compact
              hideToolbar
              defaultPageSize={20}
              pageSizeOptions={[20]}
              expandableRow={{
                getKey: p => String(p._row_num),
                excludeColumns: ['project_code'],
                renderContent: (p, close) => <FinanceDetailPanel project={p} onClose={close} />,
              }}
            />
          ),
        },
        // ── 구버전 — 목표대비부진/손실·저수익 (2026-08 [미수주] 리스트로 교체, 삭제하지 않고 보존) ──
        // { variant: 'default', title: '목표 대비 부진', rows: vm.worst },
        // { variant: 'risk',    title: '손실 / 저수익',  rows: vm.risk },
      ]}
    />
  );
};

export default PerformanceInsightSection;
