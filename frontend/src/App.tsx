import { Navbar } from '@/layouts';
import { TabLayout } from '@/layouts';
import styles from './App.module.css';

const App = () => (
  <div className={styles.root}>
    <Navbar />
    <TabLayout />
  </div>
);

export default App;
