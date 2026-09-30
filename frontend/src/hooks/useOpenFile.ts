import { openFinanceFile, openKpiFile } from '@/api';
import { alertDialog } from '@/utils/dialog';

const alertIfFailed = (r: { ok: boolean; message?: string }) => {
  if (!r.ok) alertDialog(r.message ?? '파일을 열 수 없습니다.', { error: true });
};

/** 재무 처리이력 기준으로 원본 PPT 열기 — 실패하면 알림창. 표 컬럼 정의처럼 훅을 못 쓰는 곳용 */
export const openFinanceFileOrAlert = (filename: string) => openFinanceFile(filename).then(alertIfFailed);
/** KPI 처리이력 기준으로 원본 PPT 열기 — 실패하면 알림창 */
export const openKpiFileOrAlert = (filename: string) => openKpiFile(filename).then(alertIfFailed);

/**
 * 파일명으로 원본 PPT를 서버(로컬 PC)에서 직접 연다.
 * 재무 처리이력을 먼저 찾고, 없으면 KPI 처리이력에서 찾는다(같은 원본 PPT를 두 파이프라인이
 * 각자 독립적으로 기록해서 어느 한쪽에만 이력이 남는 경우가 있음).
 */
export const useOpenFile = () => {
  const openFile = async (filename: string) => {
    const fin = await openFinanceFile(filename);
    if (fin.ok) return fin;
    const kpi = await openKpiFile(filename);
    if (!kpi.ok) alertDialog(kpi.message ?? fin.message ?? '파일을 열 수 없습니다.', { error: true });
    return kpi;
  };

  return { openFile };
};
