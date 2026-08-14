import { getPerfData } from '@/api/performance.api';
import { usePerfStore } from '@/store/perf.store';
import { PERF_CSV_COLUMNS } from '@/utils/perfCsvColumns';
import { downloadCsvFile } from './useExport';

export const usePerfExport = () => {
  const selectedParts = usePerfStore(s => s.selectedParts);
  const selectedTeam  = usePerfStore(s => s.selectedTeam);

  const exportPerfCsv = async () => {
    try {
      const { data: rows } = await getPerfData(selectedParts, { page: 1, pageSize: 9999, search: '' }, selectedTeam);
      if (!rows.length) {
        alert('내보낼 데이터가 없습니다.');
        return;
      }
      downloadCsvFile(
        `실적현황_${new Date().toISOString().slice(0, 10)}.csv`,
        PERF_CSV_COLUMNS.map(c => c.label),
        rows.map(r => PERF_CSV_COLUMNS.map(c => r[c.key])),
      );
    } catch (err) {
      console.error('[Perf CSV Export]', err);
      alert('CSV 내보내기 중 오류가 발생했습니다.');
    }
  };

  return { exportPerfCsv };
};
