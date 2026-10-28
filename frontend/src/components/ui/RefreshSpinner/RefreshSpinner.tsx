import { Spinner } from '@/components/ui/Spinner';
import styles from './RefreshSpinner.module.css';

interface Props {
  /** 재조회 중이면 true — 이전 데이터는 그대로 두고 그 위에 스피너만 띄움 */
  active: boolean;
  label?: string;
}

/**
 * 필터 변경 등으로 데이터를 다시 불러오는 동안 페이지(부모) 위에 뜨는 스피너.
 * 부모가 `position: relative`여야 하고, 클릭은 그대로 통과(pointer-events: none).
 * 스피너 자체가 0.12초 뒤에 나타나(Spinner.module.css) 캐시로 금방 끝나는 조회엔 번쩍이지 않는다.
 * 첫 로딩(스켈레톤)엔 쓰지 않음 — 재조회일 때만.
 */
const RefreshSpinner = ({ active, label = '불러오는 중…' }: Props) => {
  if (!active) return null;
  return (
    <div className={styles.overlay}>
      <div className={styles.box}>
        <Spinner size="md" fullPage={false} label={label} />
      </div>
    </div>
  );
};

export default RefreshSpinner;
