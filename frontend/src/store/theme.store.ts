import { create } from 'zustand';

type Theme = 'dark' | 'light';

interface ThemeStore {
  theme: Theme;
  toggle: () => void;
}

// localStorage에서 직접 읽기 — FOUC 스크립트와 동일한 키 사용
const saved = localStorage.getItem('theme');
const initial: Theme = (saved === 'dark' || saved === 'light') ? saved : 'light';

export const useThemeStore = create<ThemeStore>(set => ({
  theme: initial,
  toggle: () => set(s => {
    const next: Theme = s.theme === 'dark' ? 'light' : 'dark';
    localStorage.setItem('theme', next);
    return { theme: next };
  }),
}));

// DOM 동기화 — React 외부에서 CSS 변수 즉시 반영
useThemeStore.subscribe(s => {
  document.documentElement.setAttribute('data-theme', s.theme);
});

// 초기 DOM 적용
document.documentElement.setAttribute('data-theme', initial);
