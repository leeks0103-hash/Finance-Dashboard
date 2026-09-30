import type { ReactNode } from 'react';
import { useProjectTableViewModel } from '@/hooks/viewmodels';
import { DataTable, FilterSelect } from '@/components/ui';
import { useUiStore } from '@/store';
import { columns } from './columns.tsx';

const HIDEABLE: { id: string; label: string }[] = [
  { id: 'direct_cost', label: '직접원가' },
  { id: 'labor_cost',  label: '인건비'   },
  { id: 'overhead',    label: '공통원가' },
  { id: 'note',        label: '비고'     },
  { id: 'filename',    label: '원본파일명' },
];

interface Props {
  /** 제목줄("프로젝트 재무 상세") 오른쪽 끝 슬롯 — 재무 데이터 확인 모달의 CSV 버튼 */
  toolbarExtra?: ReactNode;
  /** 부모(모달 본문) 높이에 맞춤 — 표 안에서만 세로 스크롤 */
  fillHeight?: boolean;
}

const ProjectTable = ({ toolbarExtra, fillHeight }: Props) => {
  const vm = useProjectTableViewModel();
  const rawValues = useUiStore(s => s.showRawValues);

  return (
    <DataTable
      data={vm.rows}
      columns={columns}
      getRowId={(row) => String(row._row_num)}
      title="프로젝트 재무 상세"
      toolbarExtra={toolbarExtra}
      fillHeight={fillHeight}
      meta={{ rawValues }}
      isLoading={vm.isLoading}
      isFetching={vm.isFetching}
      hideableColumns={HIDEABLE}
      // footer={vm.rows.length ? footer : undefined}  // 서버사이드 페이지네이션으로 전체 합계와 불일치 — 상단 KPI 카드로 대체
      getRowVariant={vm.getRowVariant}
      serverPagination={vm.serverPagination}
      serverSearch={vm.serverSearch}
      searchExtra={
        <>
          {/* 폭 고정 — 팀을 고르면 파트 옵션이 바뀌고, 옵션도 늦게 도착해서 안 그러면 고를 때마다 툴바가 출렁임 */}
          <FilterSelect {...vm.teamFilter}  allLabel="팀 전체"       ariaLabel="팀"       width={196} />
          <FilterSelect {...vm.partFilter}  allLabel="파트 전체"     ariaLabel="파트"     width={108} />
          <FilterSelect {...vm.stageFilter} allLabel="진행단계 전체" ariaLabel="진행단계" width={120} />
        </>
      }
      emptyIcon="search"
      emptyTitle="검색 결과 없음"
      emptyDescription="다른 검색어나 필터 조건을 시도해보세요."
      initialColumnVisibility={{ filename: true }}
      storageKey="finance-project"
      sizeVersion={3}   // columns.tsx 기본 폭 변경(2026-09-28, 09-30) — 저장된 옛 폭 1회 무효화
      searchOnDblClick={['project_code']}
    />
  );
};

export default ProjectTable;
