import { usePerfExport } from '@/hooks/usePerfExport';
import { Button } from '@/components/ui';

const PerformanceActionBar = () => {
  const { exportPerfCsv } = usePerfExport();

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
      <Button variant="success" size="sm" onClick={exportPerfCsv}>↓ CSV</Button>
    </div>
  );
};

export default PerformanceActionBar;
