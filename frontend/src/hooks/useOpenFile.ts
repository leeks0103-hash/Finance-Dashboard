import { openFinanceFile, openKpiFile } from '@/api';
import { openCoverageFile } from '@/api/extract.api';
import { checkExtractRequest, sendExtractRequest } from '@/api/extractRequest.api';
import { alertDialog, confirmDialog, toast } from '@/utils/dialog';
import { queryClient } from './queryClient';
import type { FileOpener } from '@/types/fileOpen.types';

interface OpenResult { ok: boolean; message?: string; locked?: boolean; blocked?: boolean; checked?: boolean }
type OpenApi = (filename: string, check?: boolean, folder?: boolean) => Promise<OpenResult>;

/** 실패 안내 — 누가 열람 중이면 오류가 아니라 안내(ⓘ), DRM 파일은 열기 차단, 그 외(위치 없음·실행 실패)는 오류 */
const alertFailure = (r: OpenResult) => {
  if (r.blocked) {
    alertDialog(r.message ?? '문서보안(DRM) 암호화 파일이라 대시보드에서 열 수 없습니다.', { title: '열 수 없는 파일', error: true });
  } else if (r.locked) {
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
    // 열람 중·DRM 차단이면 다른 이력은 볼 필요 없음(같은 원본 파일)
    if (pre.ok || pre.locked || pre.blocked) { found = { api, pre }; break; }
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

/**
 * 폴더 바로가기(2026-10-06) — 서버 PC 탐색기로 그 파일이 든 폴더를 열고 파일을 선택해 둠. 파일은 안 열어서
 * 확인창 없이 바로(열람 중·DRM이어도 됨). apis를 순서대로 찾아 원본 위치가 있는 첫 곳에서
 */
const openFolderVia = async (filename: string, apis: OpenApi[]): Promise<OpenResult> => {
  let last: OpenResult = { ok: false };
  for (const api of apis) {
    last = await api(filename, false, true);
    if (last.ok) return last;
  }
  alertFailure(last);
  return last;
};

/**
 * 업데이트(재추출) 요청(2026-10-21) — 원본 PPT를 고친 사람이 관리자에게 "다시 추출해 주세요"를 남김(메일 대신, 서버 저장).
 * 먼저 원본이 마지막 추출 뒤에 바뀌었는지 보여 줌 — 저장을 깜빡하고 요청하는 경우를 거르려고(안 바뀌어도 요청은 됨)
 */
const requestUpdate = async (filename: string): Promise<{ ok: boolean }> => {
  let s: Awaited<ReturnType<typeof checkExtractRequest>>;
  try { s = await checkExtractRequest(filename); }
  catch { alertDialog('요청 상태를 확인하지 못했습니다. 잠시 뒤 다시 시도해 주세요.', { error: true }); return { ok: false }; }
  const last = s.last_extracted ? `마지막 추출 ${s.last_extracted}` : '아직 추출된 적 없음';
  const state = s.changed === true
    ? `원본이 마지막 추출 뒤에 수정됐습니다.\n(${last} · 원본 수정 ${s.modified})`
    : s.changed === false
      ? `⚠ 마지막 추출 뒤로 원본이 바뀌지 않았습니다 — PPT를 저장하셨나요?\n(${last} · 원본 수정 ${s.modified})`
      : `원본 수정 시각을 확인하지 못했습니다. (${last})`;
  const already = s.requested ? `\n\n이미 요청돼 있습니다 — ${s.requested.at}${s.requested.by ? ` · ${s.requested.by}` : ''}` : '';
  const ok = await confirmDialog(`${filename}\n\n${state}${already}\n\n관리자에게 다시 추출을 요청할까요?`, {
    title: '업데이트 요청', confirmText: '요청', cancelText: '취소',
  });
  if (!ok) return { ok: false };
  try { await sendExtractRequest(filename); }
  catch { alertDialog('요청을 남기지 못했습니다.', { error: true }); return { ok: false }; }
  queryClient.invalidateQueries({ queryKey: ['extract-requests'] });
  toast('업데이트 요청을 남겼습니다 — 관리자가 확인 후 다시 추출합니다');
  return { ok: true };
};

/** 열기 함수에 폴더 바로가기·업데이트 요청 짝을 붙임 — CopyText·셀 팝업이 있으면 그 버튼도 그림 */
const opener = (apis: OpenApi[], withRequest = true): FileOpener =>
  Object.assign((filename: string) => confirmAndOpen(filename, apis), {
    openFolder: (filename: string) => openFolderVia(filename, apis),
    ...(withRequest ? { requestUpdate } : {}),
  });

/** 재무 처리이력 기준으로 원본 PPT 열기(확인창 포함). 표 컬럼 정의처럼 훅을 못 쓰는 곳용 */
export const openFinanceFileOrAlert = opener([openFinanceFile]);
/** KPI 처리이력 기준으로 원본 PPT 열기(확인창 포함) */
export const openKpiFileOrAlert = opener([openKpiFile]);
/** 추출 현황 목록 기준(폴더에서 찾은 경로)으로 열기 — 처리이력에 없는 미처리·실패 파일도 열림 */
export const openCoverageFileOrAlert = opener([openCoverageFile], false);   // 관리자 추출 현황 — 요청 버튼 필요 없음
const openAnyFile = opener([openFinanceFile, openKpiFile]);

/**
 * 파일명으로 원본 PPT를 서버(로컬 PC)에서 직접 연다(확인창 포함).
 * 재무 처리이력을 먼저 찾고, 없으면 KPI 처리이력에서 찾는다(같은 원본 PPT를 두 파이프라인이
 * 각자 독립적으로 기록해서 어느 한쪽에만 이력이 남는 경우가 있음).
 */
export const useOpenFile = () => {
  return { openFile: openAnyFile };
};
