import { Button } from '../Button';
import styles from './InsightComment.module.css';
import type { CommentType } from '../../../types/finance.types';

interface Props {
  type: CommentType;
  text: string;
  /** 있으면 텍스트 앞에 프로젝트명을 클릭 가능한 형태로 표시 */
  projectCode?: string;
  projectName?: string;
  onProjectClick?: (code: string) => void;
}

const BADGE: Record<CommentType, string | null> = {
  warning:  '⚠ 주의',
  positive: null,
  info:     null,
  neutral:  null,
};

const InsightComment = ({ type, text, projectCode, projectName, onProjectClick }: Props) => (
  <div className={`${styles.comment} ${styles[type]}`}>
    {BADGE[type] && <span className={styles.badge}>{BADGE[type]}</span>}
    {projectName ? (
      <span>
        <Button
          unstyled
          className={styles.projectLink}
          onDoubleClick={() => onProjectClick?.(projectCode ?? '')}
          title="더블클릭: 프로젝트 상세에서 검색"
        >
          {projectName}
        </Button>
        {' '}
        <span dangerouslySetInnerHTML={{ __html: text }} />
      </span>
    ) : (
      <span dangerouslySetInnerHTML={{ __html: text }} />
    )}
  </div>
);

export default InsightComment;
