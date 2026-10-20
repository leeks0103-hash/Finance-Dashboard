// usePerfExport(CSV 내보내기) — 담당자 지정으로 CSV 버튼을 내리고 엑셀 원본 다운로드로 대체.
// 복구하려면 아래 import와 <CsvExportBar> 한 줄을 함께 되살릴 것.
// import { usePerfExport } from '@/hooks/usePerfExport';
// import { CsvExportBar } from '@/components/ui';
// "업데이트 N일 N시" 뱃지 — Navbar로 옮기면서(2026-09-17, KpiActionBar와 동일 처리) 제거.
// 필요해지면 usePerformanceSummary + fmtTs 되살려서 버튼 옆에 다시 붙일 것.
import { useDownloadFiles, downloadHref } from '@/hooks/useDownloadFiles';
import { DownloadMenu } from '@/components/ui';
// AI 인사이트 — 관리자 기능 > 'AI 인사이트' 토글로 켜고 끔(서버 저장, 모든 사람 공통, 2026-10-20). 기본 꺼짐
import AiInsightWidget from '@/components/features/AiInsightWidget';
import { useVisible } from '@/hooks/useVisibility';
import styles from './PerformanceActionBar.module.css';

const PerformanceActionBar = () => {
  const { data: files, isLoading } = useDownloadFiles();
  const showAiInsight = useVisible('aiInsight');

  return (
    <div className={styles.bar} data-tour="actions">
      {showAiInsight && <AiInsightWidget aiTab="finance" />}
      <DownloadMenu
        items={files ?? []}
        isLoading={isLoading}
        hrefOf={downloadHref}
        buttonLabel="↓ Raw Data 다운로드"
      />
    </div>
  );
};

export default PerformanceActionBar;
