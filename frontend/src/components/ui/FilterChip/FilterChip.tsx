import { Button } from '@/components/ui/Button';
import styles from './FilterChip.module.css';

interface Props {
  label:    string;
  checked:  boolean;
  onChange: () => void;
  onHover?: () => void;
}

const FilterChip = ({ label, checked, onChange, onHover }: Props) => (
  <Button
    unstyled
    className={`${styles.chip} ${checked ? styles.checked : ''}`}
    onClick={onChange}
    onMouseEnter={onHover}
    aria-pressed={checked}
  >
    {checked && <span className={styles.checkIcon} aria-hidden>✓</span>}
    {label}
  </Button>
);

export default FilterChip;
