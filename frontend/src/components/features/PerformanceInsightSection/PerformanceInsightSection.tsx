import { useMemo } from 'react';
import { createColumnHelper } from '@tanstack/react-table';
import { usePerformanceInsightViewModel } from '@/hooks/viewmodels';
import { DataTable, CopyText, CellPopup, useClipboardPopup, alertDialog } from '@/components/ui';
import { useQuickSearchStore } from '@/store/quickSearch.store';
import { openFinanceFile } from '@/api/finance.api';
import FinanceDetailPanel from './FinanceDetailPanel';
import type { Project } from '@/types';

const openFile = (filename: string) => {
  openFinanceFile(filename).then(r => { if (!r.ok) alertDialog(r.message ?? '파일을 열 수 없습니다.', { error: true }); });
};

const h = createColumnHelper<Project>();

const PerformanceInsightSection = () => {
  const vm = usePerformanceInsightViewModel();
  const setPerfSearch = useQuickSearchStore(s => s.setPerf);
  // 미수사유는 PPT 텍스트박스 원문이라 길어서(줄바꿈 포함) 셀에 그대로 못 담음 —
  // 클릭 시 DataTable 기본 셀 팝업과 동일한 모달로 전체 내용을 보여줌
  const reasonPopup = useClipboardPopup();

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
    // 글씨가 짧아도(길이 무관) 복사 가능해야 해서 DataTable의 20자 이상 자동팝업 대신
    // CopyText를 직접 씀(2026-09-15 사용자 지정 — 특히 비고·미수사유)
    h.accessor('note', { header: '비고', size: 220, cell: i => i.getValue() ? <CopyText text={i.getValue()} /> : <span>-</span> }),
    h.accessor('missed_bid_reason', {
      header: '미수사유',
      size: 260,
      cell: i => {
        const v = i.getValue();
        if (!v) return <span>-</span>;
        return (
          <span
            role="button"
            tabIndex={0}
            title="클릭해서 전체 내용 보기"
            style={{ cursor: 'pointer', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
            onClick={e => { e.stopPropagation(); reasonPopup.openPopup(v, true); }}
            onKeyDown={e => e.key === 'Enter' && reasonPopup.openPopup(v, true)}
          >
            {v}
          </span>
        );
      },
    }),
    h.accessor('filename', { header: '파일명', size: 320, cell: i => <CopyText text={i.getValue()} onOpen={openFile} /> }),
  ], [setPerfSearch, reasonPopup.openPopup]);

  return (
    <>
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
      /* sizeVersion 5 — 테이블 자체 렌더 폭을 인라인 px 대신 CSS width:100%로 맡겨서
         반올림/테두리 오차가 오버플로우로 안 이어지게 함(DataTable.tsx) 반영 위해 초기화 */
      sizeVersion={5}
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
    <CellPopup
      title="미수사유"
      popup={reasonPopup.popup}
      copied={reasonPopup.copied}
      onClose={reasonPopup.closePopup}
      onCopy={reasonPopup.copyPopupText}
    />
    </>
  );
};

export default PerformanceInsightSection;
