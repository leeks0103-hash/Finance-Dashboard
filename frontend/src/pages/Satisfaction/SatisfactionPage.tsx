import { ErrorBoundary } from '@/components/ErrorBoundary';
import { EmptyState } from '@/components/ui/EmptyState';
import styles from './SatisfactionPage.module.css';

// 데이터 소스·API 미정 — 우선 플레이스홀더. 연동 시 KpiSection 같은 feature 컴포넌트로 교체.
const SatisfactionPage = () => (
  <main className={styles.main}>
    <div className="fadeUp">
      <ErrorBoundary>
        <EmptyState
          icon="📝"
          title="강사만족도 데이터 준비 중"
          description="집계 파이프라인 연동 후 이 탭에 강사별 만족도 현황이 표시됩니다."
        />
      </ErrorBoundary>
    </div>
  </main>
);

export default SatisfactionPage;
