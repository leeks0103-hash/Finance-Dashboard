import { getKpiData } from '@/api/kpi.api';
import { useKpiFilterStore } from '@/store/kpiFilter.store';
import { sortKpiRawCols } from '@/utils/kpiColumns';
import { downloadCsvFile } from './useExport';

export const useKpiExport = () => {
  const years  = useKpiFilterStore(s => s.years);
  const parts  = useKpiFilterStore(s => s.parts);
  const stages = useKpiFilterStore(s => s.stages);

  const exportKpiCsv = async () => {
    try {
      const { data: rows } = await getKpiData({ years, parts, stages }, { page: 1, pageSize: 9999, search: '' });
      if (!rows.length) {
        alert('내보낼 데이터가 없습니다.');
        return;
      }
      const cols = sortKpiRawCols(rows);
      downloadCsvFile(
        `KPI취합_${new Date().toISOString().slice(0, 10)}.csv`,
        cols,
        rows.map(r => cols.map(c => r[c])),
      );
    } catch (err) {
      console.error('[KPI CSV Export]', err);
      alert('CSV 내보내기 중 오류가 발생했습니다.');
    }
  };

  return { exportKpiCsv };
};
