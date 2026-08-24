import { usePerfExport } from '@/hooks/usePerfExport';
import { CsvExportBar } from '@/components/ui';

const PerformanceActionBar = () => {
  const { exportPerfCsv } = usePerfExport();
  return <CsvExportBar onExport={exportPerfCsv} />;
};

export default PerformanceActionBar;
