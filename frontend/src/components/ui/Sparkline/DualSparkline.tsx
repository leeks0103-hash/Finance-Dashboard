import { useId } from 'react';

// 4가지 방향 조합(왼쪽→오른쪽): 둘 다 상승 / 둘 다 하락 / 하락→상승(valley) / 상승→하락(peak)
const UP     = "0,34 8,28 14,31 22,22 28,26 36,14 42,19 50,10 56,15 64,6 70,11 78,3 86,7 90,2";
const DOWN   = "0,2 8,8 14,5 22,14 28,10 36,22 42,17 50,26 56,21 64,30 70,25 78,33 86,29 90,34";
const PEAK   = "0,34 10,24 20,18 30,10 45,4 60,10 70,18 80,24 90,34";
const VALLEY = "0,4 10,14 20,20 30,28 45,34 60,28 70,20 80,14 90,4";

interface Props {
  /** 왼쪽 절반(계획 등)의 추세 — true면 상승 */
  leftUp:      boolean;
  /** 오른쪽 절반(추정 등)의 추세 — true면 상승 */
  rightUp:     boolean;
  leftColor:   string;
  rightColor:  string;
  className?:  string;
}

/**
 * 두 값(예: 계획→추정)의 방향을 하나의 이어진 곡선으로 표현하는 스파크라인.
 * 선을 두 개로 쪼개지 않고 한 선으로 그린 뒤 가운데서 색만 바뀌게 해서
 * "따로 노는" 느낌 없이 이어져 보이게 한다(가운데 급격한 색 전환 그라디언트).
 */
export const DualSparkline = ({ leftUp, rightUp, leftColor, rightColor, className }: Props) => {
  const uid = useId().replace(/:/g, '');
  const pts = leftUp === rightUp ? (leftUp ? UP : DOWN) : (rightUp ? VALLEY : PEAK);

  const strokeGrad = `dual-stroke-${uid}`;
  const fillLGrad   = `dual-fill-l-${uid}`;
  const fillRGrad   = `dual-fill-r-${uid}`;
  const clipL       = `dual-clip-l-${uid}`;
  const clipR       = `dual-clip-r-${uid}`;

  return (
    <svg className={className} viewBox="0 0 90 36" fill="none" preserveAspectRatio="none" aria-hidden>
      <defs>
        {/* 선 색 — 중간(50%)에서 왼쪽 색 → 오른쪽 색으로 급전환 */}
        <linearGradient id={strokeGrad} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%"    stopColor={leftColor} />
          <stop offset="49.9%" stopColor={leftColor} />
          <stop offset="50.1%" stopColor={rightColor} />
          <stop offset="100%"  stopColor={rightColor} />
        </linearGradient>
        <linearGradient id={fillLGrad} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={leftColor} stopOpacity="0.5" />
          <stop offset="100%" stopColor={leftColor} stopOpacity="0" />
        </linearGradient>
        <linearGradient id={fillRGrad} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={rightColor} stopOpacity="0.5" />
          <stop offset="100%" stopColor={rightColor} stopOpacity="0" />
        </linearGradient>
        <clipPath id={clipL}><rect x="0"  y="0" width="45" height="36" /></clipPath>
        <clipPath id={clipR}><rect x="45" y="0" width="45" height="36" /></clipPath>
      </defs>

      {/* 채움 — 절반씩 각자 색으로, 위→아래 페이드 */}
      <polygon points={`${pts} 90,36 0,36`} fill={`url(#${fillLGrad})`} clipPath={`url(#${clipL})`} />
      <polygon points={`${pts} 90,36 0,36`} fill={`url(#${fillRGrad})`} clipPath={`url(#${clipR})`} />

      {/* 선 — 하나로 이어진 폴리라인, 색만 가운데서 전환 */}
      <polyline
        points={pts}
        stroke={`url(#${strokeGrad})`}
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </svg>
  );
};

export default DualSparkline;
