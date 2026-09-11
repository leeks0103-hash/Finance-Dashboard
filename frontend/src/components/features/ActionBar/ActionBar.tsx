import { useExport } from '@/hooks/useExport';
import { useSummary } from '@/hooks/useSummary';
import { useUiStore } from '@/store';
import { Button, DownloadModal } from '@/components/ui';
import styles from './ActionBar.module.css';

function fmtTs(raw: string | null | undefined): string {
  if (!raw) return '';
  // "2026-08-26 14:30:00" → "08-26 14:30"
  return raw.length >= 16 ? raw.slice(5, 16) : raw;
}

const ActionBar = () => {
  // exportCsv — CSV 버튼 비활성으로 현재 미사용 (복구 시 구조분해에 다시 추가)
  const { exportPdf, isExportingPdf, showPdfModal, reload, isReloading, correctedRows } = useExport();
  const lastLoaded    = useUiStore(s => s.lastLoaded);   // reload 클릭 시 갱신
  const { data: sum } = useSummary();                    // 초기 로드 시각 (서버 응답)
  const displayTs = lastLoaded || fmtTs(sum?.loaded_at); // reload > 초기 순서로 우선

  return (
    <>
      <div className={styles.bar}>
        {/* CSV 내보내기 — 담당자 지정으로 상단에서 내림. 되살리려면 아래 한 줄 주석 해제
        <Button variant="success" size="sm" onClick={exportCsv}>↓ CSV</Button>
        */}
        <Button variant="danger"  size="sm" onClick={exportPdf} loading={isExportingPdf} disabled={isExportingPdf}>
          {isExportingPdf ? '생성 중…' : '↓ PDF'}
        </Button>
        <div className={styles.reloadGroup}>
          <Button variant="ghost" size="sm" onClick={() => reload()} disabled={isReloading}>
            {isReloading ? '갱신 중…' : '↺ 갱신'}
          </Button>
          {/* 항상 렌더 + visibility 토글 — 조건부 렌더였을 때 로딩 후 늦게 팝인하며
              옆 버튼을 밀던 리플로우 방지(자리는 항상 예약) */}
          <span className={styles.lastLoaded} style={{ visibility: displayTs ? 'visible' : 'hidden' }} title="데이터 최종 업데이트">
            업데이트 {displayTs || '00-00 00:00'}
          </span>
          {correctedRows > 0 && <span className={styles.correctedBadge}>{correctedRows}행 보정됨</span>}
        </div>
      </div>
      <DownloadModal open={showPdfModal} filename="재무현황 PDF" />
    </>
  );
};

export default ActionBar;
