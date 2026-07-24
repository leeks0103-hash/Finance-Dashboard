// 전역 테마 상태 — Zustand store 위임
// 모든 컴포넌트가 동일한 상태를 공유하므로 toggle 시 즉시 반영
export { useThemeStore as useTheme } from '@/store';
