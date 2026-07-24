import { CopyText } from '../CopyText';
import styles from './ProjectRankRow.module.css';

interface Props {
  rank?: number;
  projectCode: string;
  part: string;
  value: string;
  valueColor?: string;
}

const ProjectRankRow = ({ rank, projectCode, part, value, valueColor }: Props) => (
  <div className={styles.row}>
    {rank !== undefined && <span className={styles.rank}>{rank}</span>}
    <span className={styles.part}>{part}</span>
    <CopyText text={projectCode} className={styles.code} />
    <span className={styles.value} style={{ color: valueColor }}>{value}</span>
  </div>
);

export default ProjectRankRow;
