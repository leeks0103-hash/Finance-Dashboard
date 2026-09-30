import { useCallback, useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { driver, type Driver, type DriveStep } from 'driver.js';
import 'driver.js/dist/driver.css';
import { useUiStore } from '@/store';
import { pathToTab } from '@/utils/routing';
import type { TabId } from '@/components/ui/TabNav/TabNav';
import { TOUR_STEPS, type TourStepDef } from './tourSteps';
import styles from './ProductTour.module.css';

/** 탭 전환 직후 lazy 페이지·데이터 로딩을 기다리는 최대 시간 — 넘기면 그 단계는 건너뜀 */
const WAIT_MS = 3000;
/** 첫 방문 자동 실행 지연 — 첫 화면 fadeUp 애니메이션이 끝난 뒤 시작 */
const AUTO_START_DELAY_MS = 900;

const selectorOf = (def: TourStepDef) => (def.anchor ? `[data-tour="${def.anchor}"]` : undefined);

/** 실제로 화면에 보이는(레이아웃이 잡힌) 요소만 — 숨긴 탭(display:none)·visibility:hidden 배지는 제외 */
const findVisible = (def: TourStepDef): Element | null => {
  const sel = selectorOf(def);
  if (!sel) return null;
  const el = document.querySelector(sel);
  if (!el || el.getClientRects().length === 0) return null;
  return getComputedStyle(el).visibility === 'hidden' ? null : el;
};

const waitVisible = (def: TourStepDef, timeout: number) =>
  new Promise<void>(resolve => {
    const start = Date.now();
    const tick = () => {
      if (findVisible(def) || Date.now() - start >= timeout) resolve();
      else window.setTimeout(tick, 100);
    };
    tick();
  });

/**
 * 사용법 투어 (driver.js) — 탭을 넘나들며 TOUR_STEPS를 순서대로 안내.
 * 첫 방문 시 1회 자동 실행(ui.store `tourSeen`, localStorage), 이후엔 `start()`로 수동 실행.
 * Router 안에서만 호출 가능(useNavigate) — Navbar에서 사용.
 */
export const useProductTour = () => {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const tourSeen = useUiStore(s => s.tourSeen);
  const markTourSeen = useUiStore(s => s.markTourSeen);

  // 콜백 안에서 최신 탭을 읽기 위한 ref (driver 콜백은 시작 시점 클로저에 고정됨)
  const tabRef = useRef<TabId>(pathToTab(pathname));
  tabRef.current = pathToTab(pathname);
  const driverRef = useRef<Driver | null>(null);

  const start = useCallback(() => {
    if (driverRef.current?.isActive()) return;
    const originTab = tabRef.current;
    let busy = false;

    // 탭이 바뀌면 이동 → 요소가 뜰 때까지 대기 → 해당 단계로. optional 단계는 기다리지 않음
    const go = async (d: Driver, index: number) => {
      const def = TOUR_STEPS[index];
      if (!def) { d.destroy(); return; }
      if (busy) return;
      busy = true;
      try {
        if (def.tab !== tabRef.current) navigate(`/${def.tab}`);
        if (def.anchor && !def.optional) await waitVisible(def, WAIT_MS);
        else await new Promise(r => window.requestAnimationFrame(r));
      } finally {
        busy = false;
      }
      if (d.isActive()) d.moveTo(index);
    };

    const steps: DriveStep[] = TOUR_STEPS.map(def => ({
      // 함수로 넘겨야 이동 시점에 다시 찾음 — 못 찾으면(null) skipMissingElement로 건너뜀
      element: def.anchor ? (() => findVisible(def) as Element) : undefined,
      popover: {
        title: def.title,
        description: def.description,
        side: def.side,
        align: def.align ?? 'start',
      },
    }));

    const d = driver({
      steps,
      showProgress: true,
      progressText: '{{current}} / {{total}}',
      nextBtnText: '다음',
      prevBtnText: '이전',
      doneBtnText: '완료',
      popoverClass: styles.popover,
      overlayOpacity: 0.55,
      stagePadding: 6,
      stageRadius: 8,
      smoothScroll: true,
      skipMissingElement: true,
      // 어두운 여백을 실수로 눌러도 종료되지 않게 — 기본값 'close' 대신 아무것도 안 하는 함수.
      // allowClose:false는 × 버튼까지 없애서 쓰지 않음(종료는 ×·ESC·마지막 '완료'로만)
      overlayClickBehavior: () => {},
      // driver 기본 hasNextStep()은 숨은 탭의 요소를 '없음'으로 보므로 인덱스로 직접 판단.
      // 요소가 끝내 없으면 moveTo 안에서 skipMissingElement가 진행 방향으로 건너뜀
      onNextClick: (_el, _step, { driver: drv }) => {
        const i = drv.getActiveIndex() ?? 0;
        if (i + 1 >= TOUR_STEPS.length) { drv.destroy(); return; }
        void go(drv, i + 1);
      },
      onPrevClick: (_el, _step, { driver: drv }) => {
        const i = drv.getActiveIndex() ?? 0;
        if (i > 0) void go(drv, i - 1);
      },
      onDestroyed: () => {
        markTourSeen();
        driverRef.current = null;
        // 투어가 다른 탭에서 끝났으면 시작했던 탭으로 복귀
        if (tabRef.current !== originTab) navigate(`/${originTab}`);
      },
    });
    driverRef.current = d;

    const first = TOUR_STEPS[0];
    if (first.tab !== tabRef.current) navigate(`/${first.tab}`);
    d.drive(0);
  }, [navigate, markTourSeen]);

  // 첫 방문 1회 자동 실행 — 배포 전이라 계정 대신 브라우저(localStorage) 기준
  useEffect(() => {
    if (tourSeen) return;
    const t = window.setTimeout(start, AUTO_START_DELAY_MS);
    return () => window.clearTimeout(t);
  }, [tourSeen, start]);

  // 언마운트 시 오버레이가 남지 않도록
  useEffect(() => () => driverRef.current?.destroy(), []);

  return { start };
};
