// useKpiExport(CSV 내보내기) — 담당자 지정으로 CSV 버튼을 내리고 엑셀 원본 다운로드로 대체.
// 복구하려면 아래 import와 <CsvExportBar> 한 줄을 함께 되살릴 것.
// import { useKpiExport } from '@/hooks/useKpiExport';
// import { CsvExportBar } from '@/components/ui';
import { useDownloadFiles } from '@/hooks/useDownloadFiles';
import { DownloadMenu } from '@/components/ui';
// AI 인사이트 — 우선 숨김(2026-10-02 요청). 복구하려면 아래 import와 <AiInsightWidget> 한 줄을 함께 되살릴 것.
// import AiInsightWidget from '@/components/features/AiInsightWidget';
import styles from './KpiActionBar.module.css';

const KpiActionBar = () => {
  const { data: files, isLoading } = useDownloadFiles();
  return (
    <div className={styles.bar} data-tour="actions">
      {/* <AiInsightWidget aiTab="kpi" /> */}
      <DownloadMenu
        items={files ?? []}
        isLoading={isLoading}
        hrefOf={key => `/api/download/${key}`}
        buttonLabel="↓ Raw Data 다운로드"
      />
    </div>
  );
};

export default KpiActionBar;
