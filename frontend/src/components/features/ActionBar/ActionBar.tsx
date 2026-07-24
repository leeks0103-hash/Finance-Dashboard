import { useExport } from '@/hooks/useExport';
import { useFilterPanelViewModel } from '@/hooks/viewmodels';
import { useUiStore } from '@/store';
import { Button, DownloadModal } from '@/components/ui';

const ActionBar = () => {
  const { exportCsv, exportPdf, isExportingPdf, showPdfModal, reload, isReloading, correctedRows } = useExport();
  const { hasActiveFilters, resetFilters } = useFilterPanelViewModel();
  const lastLoaded = useUiStore(s => s.lastLoaded);

  return (
    <>
      <div style={{ display:'flex', alignItems:'center', gap:'6px', flexShrink:0 }}>
        {hasActiveFilters && (
          <Button variant="danger" size="sm" onClick={resetFilters}>✕ 초기화</Button>
        )}
        <Button variant="success" size="sm" onClick={exportCsv}>↓ CSV</Button>
        <Button variant="danger"  size="sm" onClick={exportPdf} loading={isExportingPdf} disabled={isExportingPdf}>
          {isExportingPdf ? '생성 중…' : '↓ PDF'}
        </Button>
        <div style={{ display:'flex', alignItems:'center', gap:'4px' }}>
          <Button variant="ghost" size="sm" onClick={() => reload()} disabled={isReloading}>
            {isReloading ? '갱신 중…' : '↺ 갱신'}
          </Button>
          {lastLoaded && (
            <span style={{
              fontSize: '0.68rem',
              color: 'var(--text-muted)',
              whiteSpace: 'nowrap',
              lineHeight: 1,
            }}>
              {lastLoaded}
            </span>
          )}
          {correctedRows > 0 && (
            <span style={{
              fontSize: '0.65rem',
              fontWeight: 600,
              color: 'var(--warn, #d97706)',
              background: 'rgba(217,119,6,0.12)',
              border: '1px solid rgba(217,119,6,0.35)',
              borderRadius: '4px',
              padding: '1px 5px',
              whiteSpace: 'nowrap',
              lineHeight: '1.6',
            }}>
              {correctedRows}행 보정됨
            </span>
          )}
        </div>
      </div>
      <DownloadModal open={showPdfModal} filename="재무현황 PDF" />
    </>
  );
};

export default ActionBar;
