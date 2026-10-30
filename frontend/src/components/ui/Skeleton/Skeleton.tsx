import type { CSSProperties } from 'react';
import styles from './Skeleton.module.css';

interface Props {
  /** 높이·모서리·테두리 등 모양 — 바탕·애니메이션은 이 컴포넌트가 담당 */
  className?: string;
  style?: CSSProperties;
}

/** 로딩 자리표시(스켈레톤) 한 칸 — 은은한 파도 애니메이션 포함. 읽어 줄 내용이 없어 스크린리더에선 숨김 */
const Skeleton = ({ className, style }: Props) => (
  <div className={className ? `${styles.skeleton} ${className}` : styles.skeleton} style={style} aria-hidden="true" />
);

export default Skeleton;
