import Badge from '../Badge/Badge';
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
    <span className={styles.code}>{projectCode}</span>
    <Badge label={part} variant="part" />
    <span className={styles.value} style={{ color: valueColor }}>{value}</span>
  </div>
);

export default ProjectRankRow;
