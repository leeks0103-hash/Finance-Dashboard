import { openFinanceFile, openKpiFile } from '@/api';

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
    if (!kpi.ok) window.alert(kpi.message ?? fin.message ?? '파일을 열 수 없습니다.');
    return kpi;
  };

  return { openFile };
};
