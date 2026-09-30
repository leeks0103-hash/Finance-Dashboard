import { openFinanceFile, openKpiFile } from '@/api';
import { alertDialog, confirmDialog } from '@/utils/dialog';

interface OpenResult { ok: boolean; message?: string; locked?: boolean; checked?: boolean }
type OpenApi = (filename: string, check?: boolean) => Promise<OpenResult>;

/** 실패 안내 — 누가 열람 중이면 오류가 아니라 안내(ⓘ), 그 외(위치 없음·실행 실패)는 오류 */
const alertFailure = (r: OpenResult) => {
  if (r.locked) {
    alertDialog(r.message ?? '다른 사람이 열람 중인 파일입니다 — 닫힌 뒤 다시 시도해주세요.', { title: '열람 중' });
  } else {
    alertDialog(r.message ?? '파일을 열 수 없습니다.', { error: true });
  }
};

/**
 * 원본 PPT 열기 공통 흐름(2026-09-30 요청) — 서버 PC에서 실제 파일이 열리는 동작이라 한 번 묻는다.
 * ① 열 수 있는지만 확인(check) → 열람 중·위치 없음이면 확인창 없이 바로 안내
 * ② "진짜 열까요?" 확인 → ③ 실제로 열기(그 사이 누가 열었으면 ③에서 열람 중 안내)
 * apis를 순서대로 찾아 원본이 있는 첫 곳에서 연다(재무 → KPI 처리이력 폴백용).
 */
const confirmAndOpen = async (filename: string, apis: OpenApi[]): Promise<OpenResult> => {
  let found: { api: OpenApi; pre: OpenResult } | null = null;
  let last: OpenResult = { ok: false };
  for (const api of apis) {
    const pre = await api(filename, true);
    // 열람 중이면 다른 이력은 볼 필요 없음(같은 원본 파일)
    if (pre.ok || pre.locked) { found = { api, pre }; break; }
    last = pre;
  }
  if (!found) { alertFailure(last); return last; }
  if (!found.pre.ok) { alertFailure(found.pre); return found.pre; }
  // 재시작 전 옛 서버는 check를 몰라서 확인 단계에서 이미 열어버림 — 그땐 묻지 않고 끝
  if (!found.pre.checked) return found.pre;

  const ok = await confirmDialog(`${filename}\n\n이 파일을 여시겠습니까?`, {
    title: '파일 열기', confirmText: '열기', cancelText: '취소',
  });
  if (!ok) return { ok: false };
  const r = await found.api(filename);
  if (!r.ok) alertFailure(r);
  return r;
};

/** 재무 처리이력 기준으로 원본 PPT 열기(확인창 포함). 표 컬럼 정의처럼 훅을 못 쓰는 곳용 */
export const openFinanceFileOrAlert = (filename: string) => confirmAndOpen(filename, [openFinanceFile]);
/** KPI 처리이력 기준으로 원본 PPT 열기(확인창 포함) */
export const openKpiFileOrAlert = (filename: string) => confirmAndOpen(filename, [openKpiFile]);

/**
 * 파일명으로 원본 PPT를 서버(로컬 PC)에서 직접 연다(확인창 포함).
 * 재무 처리이력을 먼저 찾고, 없으면 KPI 처리이력에서 찾는다(같은 원본 PPT를 두 파이프라인이
 * 각자 독립적으로 기록해서 어느 한쪽에만 이력이 남는 경우가 있음).
 */
export const useOpenFile = () => {
  const openFile = (filename: string) => confirmAndOpen(filename, [openFinanceFile, openKpiFile]);
  return { openFile };
};
