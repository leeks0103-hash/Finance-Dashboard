import styles from './FilterChip.module.css';

interface Props {
  label: string;
  checked: boolean;
  onChange: () => void;
  onHover?: () => void;
}

const FilterChip = ({ label, checked, onChange, onHover }: Props) => (
  <button
    type="button"
    className={`${styles.chip} ${checked ? styles.checked : ''}`}
    onClick={onChange}
    onMouseEnter={onHover}
    aria-pressed={checked}
  >
    {label}
  </button>
);

export default FilterChip;
