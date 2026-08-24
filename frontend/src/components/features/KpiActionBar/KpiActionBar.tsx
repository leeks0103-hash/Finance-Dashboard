import { useKpiExport } from '@/hooks/useKpiExport';
import { CsvExportBar } from '@/components/ui';

const KpiActionBar = () => {
  const { exportKpiCsv } = useKpiExport();
  return <CsvExportBar onExport={exportKpiCsv} />;
};

export default KpiActionBar;
