import { CopyText, Modal, ModalBadge } from '@/components/ui';
import { useKpiBreakdownViewModel } from '@/hooks/viewmodels/useKpiBreakdownViewModel';
import { downloadCsvFile } from '@/hooks/useExport';
import { stripPartPrefix } from '@/utils/format';
import type { KpiBreakdownRow } from '@/api/kpi.api';
import BreakdownTable, { type BreakdownColumn } from '@/components/features/BreakdownModal/BreakdownTable';
import { BreakdownGate, BreakdownExplain, BreakdownFoot, BreakdownNote } from '@/components/features/BreakdownModal/BreakdownParts';
import styles from './KpiBreakdownModal.module.css';
import { openKpiFileOrAlert } from '@/hooks/useOpenFile';

const openFile = openKpiFileOrAlert;

interface Props {
  name:    string;
  metric:  'target' | 'actual' | 'prev';
  onClose: () => void;
}

const METRIC_LABEL_FALLBACK: Record<Props['metric'], string> = {
  target: '목표', actual: '실적', prev: '25년 유사실적',
};

/**
 * KPI 목표 vs 실적 막대를 클릭하면 열리는 드릴다운 모달.
 * "이 값 = 어떤 프로젝트 행들을 합/평균한 결과"를 계산식 + 표로 보여준다.
 */
const KpiBreakdownModal = ({ name, metric, onClose }: Props) => {
  const vm = useKpiBreakdownViewModel(name, metric);

  const handleCsv = () => {
    downloadCsvFile(
      `KPI상세_${vm.name}_${vm.metricLabel}_${new Date().toISOString().slice(0, 10)}.csv`,
      ['프로젝트코드', '프로젝트명', '파트', '보고단계', vm.column || '값', '파일명'],
      vm.rows.map(r => [r.project_code, r.project_name, r.part, r.stage, r.value, r.file]),
    );
  };

  const body = (
    <BreakdownGate
      vm={vm}
      empty={!vm.rows.length}
      emptyText="이 항목에 집계된 프로젝트 행이 없습니다."
      emptyNote={vm.note && <BreakdownNote>{vm.note}</BreakdownNote>}
    >
      <BreakdownExplain
        lead={<>
          <b>{vm.metricLabel || METRIC_LABEL_FALLBACK[metric]}</b> ={' '}
          취합 시트 <code>{vm.column}</code> 열을 프로젝트별로{' '}
          {vm.aggLabel === '평균' ? '평균낸' : '더한'} 값
        </>}
        sub={vm.note}
      />

      <BreakdownFoot placement="top" note="프로젝트당 최우선 보고단계 1건 기준" onCsv={handleCsv} />

      <BreakdownTable
        rowClassName={r => r.excluded ? styles.rowExcluded : undefined}
        columns={[
          {
            key: 'include', header: '포함', align: 'center',
            sortValue: r => r.excluded ? 0 : 1,
            render: r => (
              <input
                type="checkbox"
                className={styles.includeCheckbox}
                checked={!r.excluded}
                disabled={!r.file}
                title={r.file ? '체크 해제하면 이번 집계에서만 임시로 뺍니다(새로고침하면 복원)' : '파일명이 없어 제외할 수 없습니다'}
                onChange={() => r.file && vm.toggleExclude(r.file)}
              />
            ),
          },
          {
            // 코드만 보이게 좁게 — 프로젝트명까지 옆에 붙이면 컬럼이 넓어져 가로스크롤 유발.
            // truncate 필수 — placeholder 코드(생성예정 등)는 파일명 기반 긴 문자열이 그대로
            // project_code 자리에 들어올 때가 있어(예: "(정부 교육부) 25년 영남대학교
            // RISE-MEGA_신사업_완료(프로젝트 3개 병합)") 그대로 두면 그 한 컬럼 때문에
            // 표 전체가 가로로 넘침. 이 표는 컬럼 리사이즈가 안 되고 CopyText가 title로
            // 전체 텍스트를 이미 보여주므로 wrap(여러 줄)보다 말줄임이 나음
            key: 'code', header: '프로젝트코드', truncate: true,
            sortValue: r => r.project_code,
            render: r => r.project_code ? <CopyText text={r.project_code} /> : '—',
          },
          { key: 'part',  header: '파트',     align: 'center', sortValue: r => stripPartPrefix(r.part), render: r => stripPartPrefix(r.part) || '—' },
          { key: 'stage', header: '보고단계', align: 'center', sortValue: r => r.stage, render: r => r.stage || '—' },
          {
            key: 'value', header: vm.column || '값', align: 'right',
            sortValue: r => r.value,
            render: r => (Number.isInteger(r.value) ? r.value.toLocaleString() : r.value),
          },
          {
            key: 'file', header: '파일명', wrap: true,
            sortValue: r => r.file,
            render: r => (r.file ? <CopyText text={r.file} onOpen={openFile} /> : '—'),
          },
        ] satisfies BreakdownColumn<KpiBreakdownRow>[]}
        rows={vm.rows}
        totalLabel={`${vm.aggLabel} (${vm.count}건)`}
        totalValue={vm.totalStr}
        totalSpan={4}
      />
    </BreakdownGate>
  );

  // 스크롤 잠금·ESC(겹쳐 떠도 이 모달만 닫힘)·퇴장 애니메이션은 Modal이 처리
  return (
    <Modal
      onClose={onClose}
      width={1160}
      title={vm.name}
      sub={<>
        <ModalBadge>{vm.metricLabel || METRIC_LABEL_FALLBACK[metric]}</ModalBadge>
        {vm.available && `${vm.aggLabel}으로 산출`}
      </>}
    >
      {body}
    </Modal>
  );
};

export default KpiBreakdownModal;
