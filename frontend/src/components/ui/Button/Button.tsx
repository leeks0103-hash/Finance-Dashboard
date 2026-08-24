import type { ButtonHTMLAttributes, ReactNode } from 'react';
import styles from './Button.module.css';

type Variant = 'primary' | 'danger' | 'success' | 'ghost';
type Size    = 'sm' | 'md';

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  icon?: ReactNode;
  children: ReactNode;
  /** true면 기본 variant/size 시각 스타일을 전혀 입히지 않음 — FilterChip처럼 완전히 다른 자체 비주얼을
   *  가진 커스텀 컨트롤이 <button> 시맨틱·a11y·disabled 처리만 가져다 쓸 때 사용 */
  unstyled?: boolean;
}

const Button = ({
  variant = 'ghost',
  size = 'sm',
  loading = false,
  icon,
  children,
  disabled,
  className = '',
  unstyled = false,
  ...rest
}: Props) => (
  <button
    className={unstyled ? className : `${styles.btn} ${styles[variant]} ${styles[size]} ${className}`}
    disabled={disabled || loading}
    aria-busy={loading}
    {...rest}
  >
    {loading ? <span className={styles.spinner} aria-hidden /> : icon}
    {children}
  </button>
);

export default Button;
