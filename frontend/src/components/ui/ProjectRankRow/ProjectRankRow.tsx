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
    <div className={styles.codeWrap}>
      <CopyText text={projectCode} className={styles.code} />
      {subValue && <span className={styles.subValue}>{subValue}</span>}
    </div>
    <span className={styles.value} style={{ color: valueColor }}>{value}</span>
  </div>
);

export default ProjectRankRow;
