import { useKpiExport } from '@/hooks/useKpiExport';
import { Button } from '@/components/ui';

const KpiActionBar = () => {
  const { exportKpiCsv } = useKpiExport();

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
      <Button variant="success" size="sm" onClick={exportKpiCsv}>↓ CSV</Button>
    </div>
  );
};

export default KpiActionBar;
