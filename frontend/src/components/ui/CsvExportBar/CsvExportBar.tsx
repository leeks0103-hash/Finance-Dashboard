import { Button } from '../Button';
import styles from './CsvExportBar.module.css';

interface Props {
  onExport: () => void;
}

/** CSV 내보내기 버튼 한 줄 — KPI/실적현황처럼 CSV 내보내기만 있는 액션바 공용 */
export const CsvExportBar = ({ onExport }: Props) => (
  <div className={styles.bar}>
    <Button variant="success" size="sm" onClick={onExport}>↓ CSV</Button>
  </div>
);
