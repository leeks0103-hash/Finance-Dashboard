import FilterPanel from '@/components/features/FilterPanel';
import ActionBar   from '@/components/features/ActionBar';
import styles from './FilterBar.module.css';

const FilterBar = () => (
  <div className={styles.bar}>
    <div className={styles.scrollArea}>
      <FilterPanel />
    </div>
    <div className={styles.actions}>
      <ActionBar />
    </div>
  </div>
);

export default FilterBar;
