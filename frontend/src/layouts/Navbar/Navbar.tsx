import styles from './Navbar.module.css';

const Navbar = () => (
  <nav className={styles.nav}>
    <span className={styles.brand}>📊 프로젝트 재무 대시보드</span>
    <span className={styles.team}>기술교육사업기획팀</span>
  </nav>
);

export default Navbar;
