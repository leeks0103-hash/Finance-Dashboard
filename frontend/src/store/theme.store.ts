import { create } from 'zustand';

type Theme = 'dark' | 'light';

interface ThemeStore {
  theme: Theme;
  toggle: () => void;
}

// 의도적으로 persist 미들웨어 대신 localStorage 직접 read/write 사용:
// index.html의 FOUC 방지 인라인 스크립트가 React/zustand 로드 전에 동일 키('theme')를
// 원시 문자열로 읽어 data-theme을 미리 세팅해야 함. persist 미들웨어는 JSON 래핑 포맷을
// 쓰기 때문에 그 스크립트와 포맷이 어긋나 깜빡임(FOUC)이 재발할 수 있어 우회함.
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
