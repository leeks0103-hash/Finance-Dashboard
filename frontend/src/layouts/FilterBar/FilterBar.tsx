import FilterPanel from '@/components/features/FilterPanel';
import ActionBar from '@/components/features/ActionBar';
import styles from './FilterBar.module.css';

const FilterBar = () => (
  <div className={styles.bar}>
    <FilterPanel />
    <ActionBar />
  </div>
);

export default FilterBar;
