import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const openFinanceFile = vi.fn();
const openKpiFile = vi.fn();
vi.mock('@/api', () => ({
  openFinanceFile: (...a: unknown[]) => openFinanceFile(...a),
  openKpiFile: (...a: unknown[]) => openKpiFile(...a),
}));
vi.mock('@/api/extract.api', () => ({ openCoverageFile: vi.fn() }));
vi.mock('@/api/extractRequest.api', () => ({ checkExtractRequest: vi.fn(), sendExtractRequest: vi.fn() }));
const confirmDialog = vi.fn();
const alertDialog = vi.fn();
vi.mock('@/utils/dialog', () => ({
  confirmDialog: (...a: unknown[]) => confirmDialog(...a),
  alertDialog: (...a: unknown[]) => alertDialog(...a),
  toast: vi.fn(),
}));

import { openFinanceFileOrAlert } from './useOpenFile';

/** 브라우저에 넘긴 주소 — <a>가 클릭될 때 href를 모음 */
const clicked: string[] = [];

describe('원본 열기 — 서버는 열지 않고 열기 주소를 줌, 브라우저가 이 PC의 도구에 넘김 (2026-11-06)', () => {
  beforeEach(() => {
    clicked.length = 0;
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) { clicked.push(this.href); });
    openFinanceFile.mockReset();
    confirmDialog.mockReset().mockResolvedValue(true);
    alertDialog.mockReset();
  });
  afterEach(() => { vi.restoreAllMocks(); });

  it('확인 → 열기 요청 응답의 open_url을 브라우저로 넘긴다', async () => {
    openFinanceFile
      .mockResolvedValueOnce({ ok: true, checked: true })
      .mockResolvedValueOnce({ ok: true, open_url: 'hmcopen://f/QUJD' });
    await openFinanceFileOrAlert('a.pptx');
    expect(openFinanceFile).toHaveBeenNthCalledWith(1, 'a.pptx', true);
    expect(clicked).toEqual(['hmcopen://f/QUJD']);
  });

  it('확인창에서 취소하면 아무것도 안 넘긴다', async () => {
    confirmDialog.mockResolvedValue(false);
    openFinanceFile.mockResolvedValueOnce({ ok: true, checked: true });
    await openFinanceFileOrAlert('a.pptx');
    expect(openFinanceFile).toHaveBeenCalledTimes(1);
    expect(clicked).toEqual([]);
  });

  it('열람 중·DRM이면 안내만 하고 열지 않는다', async () => {
    openFinanceFile.mockResolvedValueOnce({ ok: false, locked: true, message: '열람 중' });
    await openFinanceFileOrAlert('a.pptx');
    expect(alertDialog).toHaveBeenCalled();
    expect(clicked).toEqual([]);
  });

  it('폴더 바로가기는 확인창 없이 바로 폴더 열기 주소를 넘긴다', async () => {
    openFinanceFile.mockResolvedValueOnce({ ok: true, open_url: 'hmcopen://d/QUJD' });
    await openFinanceFileOrAlert.openFolder!('a.pptx');
    expect(openFinanceFile).toHaveBeenCalledWith('a.pptx', false, true);
    expect(confirmDialog).not.toHaveBeenCalled();
    expect(clicked).toEqual(['hmcopen://d/QUJD']);
  });

  it('open_url이 없는 응답(재시작 전 옛 서버)은 아무것도 넘기지 않는다', async () => {
    openFinanceFile
      .mockResolvedValueOnce({ ok: true, checked: true })
      .mockResolvedValueOnce({ ok: true });
    await openFinanceFileOrAlert('a.pptx');
    expect(clicked).toEqual([]);
  });
});
