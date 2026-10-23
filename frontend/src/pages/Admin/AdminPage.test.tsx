import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import AdminPage from './AdminPage';

// 섹션 본문은 이 테스트의 관심사가 아님(스크롤·메뉴 표시만) — 가볍게 바꿔 끼움
vi.mock('@/hooks/useExtractJob', () => ({ useExtractJob: () => ({ authedName: '관리자', isRunning: false, logout: vi.fn() }) }));
vi.mock('@/components/features/Admin/AdminSettingsSection', () => ({ default: () => <div>설정 본문</div> }));
vi.mock('@/components/features/Admin/AdminExtractModal', () => ({ default: () => <div>추출 모달</div> }));
vi.mock('@/components/features/Admin/PerfUpdatePanel', () => ({ default: () => <div>실적 본문</div> }));
vi.mock('@/components/features/Admin/PartHeadcountPanel', () => ({ default: () => <div>인원 본문</div> }));
vi.mock('@/components/features/Admin/FinMismatch', () => ({ default: () => <div>불일치 본문</div> }));
vi.mock('@/components/features/Admin/SecretMailPanel', () => ({ default: () => <div>메일 본문</div> }));

let observerCb: IntersectionObserverCallback;
const scrolled: string[] = [];

beforeEach(() => {
  scrolled.length = 0;
  Element.prototype.scrollIntoView = function (this: Element) { scrolled.push(this.id); };
  vi.stubGlobal('IntersectionObserver', class {
    constructor(cb: IntersectionObserverCallback) { observerCb = cb; }
    observe() {}
    disconnect() {}
  });
});
afterEach(() => { vi.unstubAllGlobals(); });

const Where = () => <span data-testid="where">{useLocation().pathname}</span>;
const renderPage = (state?: unknown) => render(
  <MemoryRouter initialEntries={[{ pathname: '/admin', state }]}><AdminPage /><Where /></MemoryRouter>,
);
const menuItem = (name: string) => screen.getByRole('button', { name: new RegExp(name) });
const intersect = (target: Element) =>
  act(() => observerCb([{ isIntersecting: true, target } as unknown as IntersectionObserverEntry], {} as IntersectionObserver));

describe('AdminPage — 한 페이지 + 바로가기 메뉴', () => {
  it('모든 섹션을 한 페이지에 그린다', () => {
    renderPage();
    // 실적현황 파일·PPT 추출은 카드의 버튼으로 모달에서 열림 — 페이지에는 카드만(본문은 모달을 열어야 보임)
    for (const t of ['설정 본문', '인원 본문', '불일치 본문', '메일 본문']) {
      expect(screen.getByText(t)).toBeInTheDocument();
    }
  });

  it('메뉴를 누르면 URL은 그대로 두고 그 섹션으로 스크롤하며 메뉴 표시가 옮겨 간다', () => {
    renderPage();
    fireEvent.click(menuItem('파트별 인원'));
    expect(scrolled).toEqual(['admin-headcount']);
    expect(screen.getByTestId('where').textContent).toBe('/admin');
    expect(menuItem('파트별 인원')).toHaveAttribute('aria-current', 'true');
    expect(menuItem('화면 설정')).not.toHaveAttribute('aria-current');
  });

  it('스크롤 중 옵저버가 섹션이 보인다고 알리면 메뉴 표시가 따라간다(메뉴 클릭 직후 잠깐은 무시)', () => {
    vi.useFakeTimers();
    renderPage();
    fireEvent.click(menuItem('화면 설정'));
    intersect(document.getElementById('admin-extract')!);   // 클릭 직후(잠금 중)
    expect(menuItem('화면 설정')).toHaveAttribute('aria-current', 'true');
    vi.advanceTimersByTime(800);
    intersect(document.getElementById('admin-extract')!);
    expect(menuItem('PPT 추출')).toHaveAttribute('aria-current', 'true');
    vi.useRealTimers();
  });

  it('맨 아래까지 내려 센티널이 보이면 마지막 섹션이 켜진다', () => {
    const { container } = renderPage();
    const sentinel = container.querySelector('[aria-hidden="true"]:last-child') as Element;
    intersect(sentinel);
    expect(menuItem('시크릿 키 메일')).toHaveAttribute('aria-current', 'true');
  });

  it('사이드바 숨김 버튼으로 숨기고 다시 펼칠 수 있으며 선택을 기억한다', () => {
    localStorage.clear();
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: '사이드바 숨기기' }));
    expect(localStorage.getItem('admin-side-collapsed')).toBe('1');
    fireEvent.click(screen.getByRole('button', { name: '사이드바 펼치기' }));
    expect(localStorage.getItem('admin-side-collapsed')).toBe('0');
    expect(screen.queryByRole('button', { name: '사이드바 펼치기' })).toBeNull();
  });
});
