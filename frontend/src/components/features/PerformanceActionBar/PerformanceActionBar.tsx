import { usePerfExport } from '@/hooks/usePerfExport';
import { usePerformanceSummary } from '@/hooks/usePerformanceSummary';
import { CsvExportBar } from '@/components/ui';
import styles from './PerformanceActionBar.module.css';

function fmtTs(raw: string | null | undefined): string {
  if (!raw) return '';
  return raw.length >= 16 ? raw.slice(5, 16) : raw;
}

const PerformanceActionBar = () => {
  const { exportPerfCsv } = usePerfExport();
  const { data: sum }     = usePerformanceSummary();
  const displayTs = fmtTs(sum?.loaded_at);

  return (
    <div className={styles.bar}>
      <CsvExportBar onExport={exportPerfCsv} />
      {displayTs && (
        <span className={styles.lastLoaded} title="데이터 최종 업데이트">
          업데이트 {displayTs}
        </span>
      )}
    </div>
  );
};

export default PerformanceActionBar;
