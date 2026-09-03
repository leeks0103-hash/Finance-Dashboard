import { Button } from '@/components/ui/Button';
import styles from './Toggle.module.css';

interface Props {
  checked:   boolean;
  onChange:  () => void;
  label?:    string;  // 트랙 내부에 표시되는 텍스트
  disabled?: boolean;
  danger?:   boolean; // true이면 ON 상태 색상이 red
}

const Toggle = ({ checked, onChange, label, disabled = false, danger = false }: Props) => (
  <Button
    unstyled
    role="switch"
    aria-checked={checked}
    aria-label={label}
    aria-disabled={disabled}
    disabled={disabled}
    className={`${styles.track} ${checked ? (danger ? styles.dangerOn : styles.on) : ''} ${disabled ? styles.disabled : ''}`}
    onClick={onChange}
  >
    {label && <span className={styles.innerLabel}>{label}</span>}
    <span className={styles.thumb} />
  </Button>
);

export default Toggle;
