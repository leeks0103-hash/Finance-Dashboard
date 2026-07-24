import { CopyText } from '../CopyText';
import styles from './ProjectRankRow.module.css';

interface Props {
  rank?: number;
  projectCode: string;
  part: string;
  value: string;
  valueColor?: string;
  subValue?: string;
}

const ProjectRankRow = ({ rank, projectCode, part, value, valueColor, subValue }: Props) => (
  <div className={styles.row}>
    {rank !== undefined && <span className={styles.rank}>{rank}</span>}
    <span className={styles.part}>{part}</span>
    <CopyText text={projectCode} className={styles.code} />
    <div className={styles.valueGroup}>
      {subValue && <span className={styles.subValue}>{subValue}</span>}
      <span className={styles.value} style={{ color: valueColor }}>{value}</span>
    </div>
  </div>
);

export default ProjectRankRow;
