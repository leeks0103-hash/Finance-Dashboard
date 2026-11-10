import { describe, it, expect, vi, beforeEach } from 'vitest';

const swal = vi.hoisted(() => ({
  fire: vi.fn(),
  isVisible: vi.fn(),
  getPopup: vi.fn(),
}));
vi.mock('sweetalert2', () => ({
  default: { mixin: () => swal, fire: vi.fn() },
}));
import { confirmDialog, isDialogOpen } from './dialog';

beforeEach(() => {
  swal.fire.mockReset().mockResolvedValue({ isConfirmed: true });
  swal.isVisible.mockReset().mockReturnValue(false);
  swal.getPopup.mockReset().mockReturnValue(null);
});

const lastFire = () => swal.fire.mock.calls.at(-1)![0] as Record<string, unknown>;

describe('confirmDialog 아이콘', () => {
  it('기본은 물음표, danger는 경고(빨간 느낌표)', async () => {
    await confirmDialog('x');
    expect(lastFire().icon).toBe('question');
    await confirmDialog('x', { danger: true });
    expect(lastFire().icon).toBe('warning');
  });

  it("icon: 'warning'이면 느낌표 — 확인 버튼 색·기본 포커스는 danger와 달리 그대로", async () => {
    await confirmDialog('x', { icon: 'warning' });
    expect(lastFire().icon).toBe('warning');
    expect(lastFire().focusCancel).toBeUndefined();
  });

  it("icon: 'mail'이면 봉투 아이콘 — SweetAlert 기본 아이콘이 아니라 info 틀에 SVG(iconHtml)", async () => {
    await confirmDialog('x', { icon: 'mail' });
    expect(lastFire().icon).toBe('info');
    expect(String(lastFire().iconHtml)).toContain('<svg');
  });

  it('mail이 아니면 iconHtml을 넘기지 않는다', async () => {
    await confirmDialog('x', { icon: 'warning' });
    expect('iconHtml' in lastFire()).toBe(false);
  });
});

describe('isDialogOpen — 저절로 뜨는 안내가 열린 창을 덮지 않게', () => {
  it('창이 없으면 false', () => {
    expect(isDialogOpen()).toBe(false);
  });

  it('확인·알림 창이 떠 있으면 true', () => {
    swal.isVisible.mockReturnValue(true);
    swal.getPopup.mockReturnValue({ classList: { contains: () => false } });
    expect(isDialogOpen()).toBe(true);
  });

  it('토스트만 떠 있는 건 창으로 안 침(토스트는 확인창을 취소로 만들지 않음)', () => {
    swal.isVisible.mockReturnValue(true);
    swal.getPopup.mockReturnValue({ classList: { contains: (c: string) => c === 'swal2-toast' } });
    expect(isDialogOpen()).toBe(false);
  });
});
