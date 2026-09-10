import { createPortal } from 'react-dom';
import { Button } from '@/components/ui';
import { useScrollLock } from '@/hooks/useScrollLock';
import { useEscToClose } from '@/hooks/useEscToClose';
import { useKpiBreakdownViewModel } from '@/hooks/viewmodels/useKpiBreakdownViewModel';
import { downloadCsvFile } from '@/hooks/useExport';
import { stripPartPrefix } from '@/utils/format';
import styles from './KpiBreakdownModal.module.css';

interface Props {
  name:    string;
  metric:  'target' | 'actual';
  onClose: () => void;
}

/**
 * KPI 목표 vs 실적 막대를 클릭하면 열리는 드릴다운 모달.
 * "이 값 = 어떤 프로젝트 행들을 합/평균한 결과"를 계산식 + 표로 보여준다.
 */
const KpiBreakdownModal = ({ name, metric, onClose }: Props) => {
  const vm = useKpiBreakdownViewModel(name, metric);

  // 배경 스크롤 잠금 (스크롤바 폭 보정 포함 — 화면 튐 방지)
  useScrollLock();
  // ESC 닫기 — 차트 확대 모달 위에 겹쳐 떠도 이 모달만 닫힌다
  useEscToClose(onClose);

  const handleCsv = () => {
    downloadCsvFile(
      `KPI상세_${vm.name}_${vm.metricLabel}_${new Date().toISOString().slice(0, 10)}.csv`,
      ['프로젝트코드', '프로젝트명', '파트', '보고단계', vm.column || '값', '파일명'],
      vm.rows.map(r => [r.project_code, r.project_name, r.part, r.stage, r.value, r.file]),
    );
  };

  const body = (() => {
    if (vm.isLoading) return <div className={styles.state}>불러오는 중…</div>;
    if (vm.isError)   return <div className={styles.state}>데이터를 불러오지 못했습니다.</div>;
    if (!vm.available) return <div className={styles.state}>{vm.message ?? '표시할 데이터가 없습니다.'}</div>;
    if (!vm.rows.length) {
      return (
        <>
          {vm.note && <p className={styles.note}>ⓘ {vm.note}</p>}
          <div className={styles.state}>이 항목에 집계된 프로젝트 행이 없습니다.</div>
        </>
      );
    }

    return (
      <>
        <div className={styles.explain}>
          <p className={styles.explainLead}>
            <b>{vm.metricLabel || (metric === 'target' ? '목표' : '실적')}</b> ={' '}
            취합 시트 <code>{vm.column}</code> 열을 프로젝트별로{' '}
            {vm.aggLabel === '평균' ? '평균낸' : '더한'} 값
          </p>
          {vm.note && <p className={styles.explainSub}>{vm.note}</p>}
        </div>

        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>프로젝트코드</th>
                <th>파트</th>
                <th>보고단계</th>
                <th className={styles.numCol}>{vm.column || '값'}</th>
              </tr>
            </thead>
            <tbody>
              {vm.rows.map((r, i) => (
                <tr key={`${r.project_code}-${r.file}-${i}`}>
                  <td>
                    {r.project_code || '—'}
                    {r.project_name && <span className={styles.pname}> · {r.project_name}</span>}
                  </td>
                  <td>{stripPartPrefix(r.part) || '—'}</td>
                  <td>{r.stage || '—'}</td>
                  <td className={styles.numCol}>{Number.isInteger(r.value) ? r.value.toLocaleString() : r.value}</td>
                </tr>
              ))}
              <tr className={styles.totalRow}>
                <td colSpan={3}>{vm.aggLabel} ({vm.count}건)</td>
                <td className={styles.numCol}>{vm.totalStr}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div className={styles.foot}>
          <span className={styles.count}>프로젝트당 최우선 보고단계 1건 기준</span>
          <Button variant="success" size="sm" onClick={handleCsv}>↓ 이 목록 CSV</Button>
        </div>
      </>
    );
  })();

  return createPortal(
    <div className={styles.overlay} onClick={onClose} role="presentation">
      <div className={styles.modal} role="dialog" aria-modal="true" onClick={e => e.stopPropagation()}>
        <div className={styles.header}>
          <div className={styles.titleWrap}>
            <h3 className={styles.title}>{vm.name}</h3>
            <div className={styles.sub}>
              <span className={styles.badge}>{vm.metricLabel || (metric === 'target' ? '목표' : '실적')}</span>
              {vm.available && `${vm.aggLabel}으로 산출`}
            </div>
          </div>
          <Button unstyled className={styles.close} onClick={onClose} aria-label="닫기">×</Button>
        </div>
        <div className={styles.body}>{body}</div>
      </div>
    </div>,
    document.body,
  );
};

export default KpiBreakdownModal;
