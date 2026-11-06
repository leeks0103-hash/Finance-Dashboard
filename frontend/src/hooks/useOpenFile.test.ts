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

describe('열람 경고 — 막지 않고 확인창에 안내, 30분 지나면 평소 확인창만 (2026-11-06)', () => {
  beforeEach(() => {
    clicked.length = 0;
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) { clicked.push(this.href); });
    openFinanceFile.mockReset();
    confirmDialog.mockReset().mockResolvedValue(true);
    alertDialog.mockReset();
  });
  afterEach(() => { vi.restoreAllMocks(); });

  const notice = { kind: 'recent', name: '박둘', minutes: 5, locked: false, message: '5분 전 박둘님이 이 파일을 열었습니다.\n이미 닫았을 수도 있습니다.' };

  it('notice가 있으면 그 문구가 든 확인창이 뜨고, [그래도 열기]를 누르면 연다', async () => {
    openFinanceFile
      .mockResolvedValueOnce({ ok: true, checked: true, notice })
      .mockResolvedValueOnce({ ok: true, open_url: 'hmcopen://f/QUJD' });
    await openFinanceFileOrAlert('a.pptx');
    const [text, opts] = confirmDialog.mock.calls[0] as [string, { confirmText: string; icon?: string }];
    expect(text).toContain('5분 전 박둘님이 이 파일을 열었습니다');
    expect(opts.confirmText).toBe('그래도 열기');
    expect(opts.icon).toBe('warning');   // 빨간 느낌표
    expect(alertDialog).not.toHaveBeenCalled();
    expect(clicked).toEqual(['hmcopen://f/QUJD']);
  });

  it('경고를 보고 취소하면 열지 않는다', async () => {
    confirmDialog.mockResolvedValue(false);
    openFinanceFile.mockResolvedValueOnce({ ok: true, checked: true, notice });
    await openFinanceFileOrAlert('a.pptx');
    expect(openFinanceFile).toHaveBeenCalledTimes(1);
    expect(clicked).toEqual([]);
  });

  it('notice가 없으면(30분 지남·기록 없음) 평소 확인창 문구', async () => {
    openFinanceFile
      .mockResolvedValueOnce({ ok: true, checked: true })
      .mockResolvedValueOnce({ ok: true, open_url: 'hmcopen://f/QUJD' });
    await openFinanceFileOrAlert('a.pptx');
    const [text, opts] = confirmDialog.mock.calls[0] as [string, { confirmText: string; icon?: string }];
    expect(opts.icon).toBeUndefined();   // 평소 확인창은 기본 아이콘
    expect(text).toContain('이 PC에서 이 파일을 여시겠습니까?');
    expect(text).not.toContain('열었습니다');
    expect(opts.confirmText).toBe('열기');
  });
});
