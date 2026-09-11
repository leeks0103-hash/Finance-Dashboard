import { useId } from 'react';

// 실제 주가 차트처럼 다양한 피크·밸리가 있는 뾰족한 형태 (직각 polyline)
const UP_POINTS   = "0,34 8,28 14,31 22,22 28,26 36,14 42,19 50,10 56,15 64,6 70,11 78,3 86,7 90,2";
const DOWN_POINTS = "0,2  8,8  14,5  22,14 28,10 36,22 42,17 50,26 56,21 64,30 70,25 78,33 86,29 90,34";

interface Props {
  up:         boolean;
  className?: string;
}

/**
 * 스파크라인 — polyline(직각) + 풀 그라디언트 fill. 색은 currentColor 상속(부모 CSS가 결정).
 * KpiCard의 배경 그래프로 쓰던 걸 공용 컴포넌트로 분리 — PerfCompareCard 등 다른 카드에도 재사용.
 */
export const Sparkline = ({ up, className }: Props) => {
  const uid    = useId();
  const gradId = `spark-grad-${uid.replace(/:/g, '')}`;
  const pts    = up ? UP_POINTS : DOWN_POINTS;

  return (
    <svg
      className={className}
      viewBox="0 0 90 36"
      fill="none"
      preserveAspectRatio="none"
      aria-hidden
    >
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stopColor="currentColor" stopOpacity="0.55" />
          <stop offset="75%"  stopColor="currentColor" stopOpacity="0.12" />
          <stop offset="100%" stopColor="currentColor" stopOpacity="0"    />
        </linearGradient>
      </defs>

      {/* 그라디언트 fill — polyline을 직접 path로 */}
      <polygon points={`${pts} 90,36 0,36`} fill={`url(#${gradId})`} />

      {/* 뾰족한 선 */}
      <polyline
        points={pts}
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </svg>
  );
};

export default Sparkline;
