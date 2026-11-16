import { Button } from '@/components/ui';
import { stripPartPrefix } from '@/utils/format';
import styles from './HiddenPartsBar.module.css';

interface Props {
  /** 지금 차트에서 숨긴 파트(원본 이름, 차트 순서대로) — 비어 있으면 아무것도 안 그림 */
  parts: string[];
  /** 그 파트 하나만 다시 보이기 */
  onRestore: (part: string) => void;
  /** 숨긴 파트 전부 다시 보이기 */
  onRestoreAll: () => void;
}

/**
 * 원가분석(파트별 추정 매출/원가) 카드 위의 "숨긴 파트" 줄(2026-11-16).
 * 파트명(x축 라벨)을 클릭하면 그 파트가 차트에서 통째로 빠지는데, 라벨이 같이 사라져서 카드 안에서는 되돌릴 방법이 없었음
 * (확대 모달 "파트 표시" 체크박스뿐). 숨긴 파트를 칩으로 보여 주고 하나씩 또는 한 번에 다시 보이게 함. 순수 표현 컴포넌트
 */
const HiddenPartsBar = ({ parts, onRestore, onRestoreAll }: Props) => {
  if (parts.length === 0) return null;
  return (
    <div className={styles.bar} role="group" aria-label="숨긴 파트">
      <span className={styles.caption}>숨긴 파트</span>
      {parts.map(part => {
        const name = stripPartPrefix(part) || part;
        return (
          <Button
            key={part}
            variant="ghost"
            size="sm"
            className={styles.chip}
            onClick={() => onRestore(part)}
            title={`${name} 다시 보기`}
            aria-label={`${name} 다시 보기`}
          >
            {name}<span className={styles.x} aria-hidden="true">×</span>
          </Button>
        );
      })}
      {parts.length > 1 && (
        <Button variant="ghost" size="sm" className={styles.all} onClick={onRestoreAll}>모두 보기</Button>
      )}
    </div>
  );
};

export default HiddenPartsBar;
