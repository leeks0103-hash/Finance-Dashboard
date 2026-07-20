import styles from './InsightComment.module.css';
import type { CommentType } from '../../../types/finance.types';

interface Props {
  type: CommentType;
  icon: string;
  text: string;
}

const InsightComment = ({ type, icon, text }: Props) => (
  <div className={`${styles.comment} ${styles[type]}`}>
    <span className={styles.icon}>{icon}</span>
    <span dangerouslySetInnerHTML={{ __html: text }} />
  </div>
);

export default InsightComment;
