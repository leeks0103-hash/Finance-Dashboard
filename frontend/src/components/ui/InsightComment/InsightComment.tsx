import styles from './InsightComment.module.css';
import type { CommentType } from '../../../types/finance.types';

interface Props {
  type: CommentType;
  icon?: string;  // 데이터에는 존재하나 UI에서 미사용
  text: string;
}

const InsightComment = ({ type, text }: Props) => (
  <div className={`${styles.comment} ${styles[type]}`}>
    <span dangerouslySetInnerHTML={{ __html: text }} />
  </div>
);

export default InsightComment;
