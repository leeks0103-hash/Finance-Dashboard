import { useState } from 'react';
import { confirmDialog } from '@/utils/dialog';
import type { useExtractJob } from '@/hooks/useExtractJob';
import type { ExtractTarget, ExtractMode } from '@/types/extract.types';

export const EXTRACT_TARGET_LABEL: Record<ExtractTarget, string> = { finance: '재무', kpi: 'KPI' };

/** 방식 선택 버튼에 나오는 것만 — 'failed'(실패 파일만)는 추출 현황 카드의 버튼으로 따로 실행 */
/** 'force'(전체)는 버튼째 주석 처리(2026-10-20) — 다시 쓰려면 아래 Exclude에서 빼고 EXTRACT_MODE_INFO 주석 해제 */
export type PickMode = Exclude<ExtractMode, 'failed' | 'force'>;
/** 지금 안 쓰는 방식 — 버튼은 보이되 못 누름. 다시 쓰려면 여기서 빼기 (2026-10-19엔 'force'가 여기 있었음) */
export const DISABLED_MODES: ReadonlySet<PickMode> = new Set<PickMode>();
export const EXTRACT_MODE_INFO: Record<PickMode, { label: string; desc: string }> = {
  incremental: {
    label: '증분',
    desc: '이전에 처리한 적 없는 새 파일 · 내용이 바뀐 파일만 골라서 반영합니다. 기존 데이터는 그대로 유지. 평소엔 이 방식을 씁니다.',
  },
  selected: {
    label: '선택',
    desc: '아래에서 고른 파일만 다시 읽습니다. 고른 파일 이름으로 남아 있던 기존 행은 지우고 새로 넣어(덮어쓰기) PPT에서 지운 행·바뀐 코드·지운 비고까지 그대로 반영합니다. 파일을 열지 못하면 기존 행은 그대로 둡니다. 다른 파일은 건드리지 않습니다. 빨간 행(!)은 데이터 이상(상단 "!" 배지)에 걸린 파일로 목록 맨 위에 모아 둡니다 — PPT를 고친 뒤 골라서 다시 추출하세요. 담당자가 "!" 목록에서 "수정 완료"를 누른 파일은 파란 "✓ 수정 완료" 배지가 붙고 빨간 행 중 맨 위로 옵니다 — 그 파일만 골라 다시 추출하면 됩니다(다시 추출하면 배지는 저절로 사라짐).',
  },
  // force: {
  //   label: '전체',
  //   desc: '기존 데이터는 지우지 않되, 모든 PPT 파일을 처음부터 다시 읽어 반영합니다. 추출 로직 자체를 고친 뒤 이미 처리된 파일에도 새 로직을 다시 적용하고 싶을 때 씁니다. 파일 수가 많으면 시간이 오래 걸립니다.',
  // },
  reset: {
    label: '초기화',
    desc: '기존 추출 데이터를 전부 지우고 모든 PPT 파일을 처음부터 다시 추출합니다.',
  },
};
export const PICK_MODES = Object.keys(EXTRACT_MODE_INFO) as PickMode[];

/**
 * 관리자 페이지 > PPT 추출(2026-10-23 모달에서 페이지로) — 대상·방식·선택 파일 상태와 실행/중지/실패 재시도 핸들러.
 * extractJob은 호출하는 쪽(AdminPage)이 하나만 만들어 넘김 — 메뉴의 "추출 중…" 표시와 같은 인증·진행 상태를 봐야 해서.
 * initialSelected = 노란 "!"(업데이트 요청)에서 넘어온 파일들 — 이 파일들을 고른 채 '선택' 방식으로 시작(2026-10-21).
 * 추출이 이미 돌고 있으면 그 작업의 대상·방식으로 시작해 화면이 실제 작업과 어긋나지 않게 한다.
 */
export const useAdminExtractViewModel = (extractJob: ReturnType<typeof useExtractJob>, initialSelected?: string[]) => {
  const running = extractJob.isRunning ? extractJob.status : undefined;
  const [targets, setTargets] = useState<ExtractTarget[]>(() => running?.targets ?? ['finance', 'kpi']);
  const [mode, setMode] = useState<PickMode>(
    () => !running && initialSelected?.length ? 'selected'
      : (running?.mode && running.mode in EXTRACT_MODE_INFO && !DISABLED_MODES.has(running.mode as PickMode) ? running.mode as PickMode : 'incremental'),
  );
  // mode=selected — 다시 추출할 파일명(원본 폴더 기준)
  const [selectedFiles, setSelectedFiles] = useState<string[]>(() => initialSelected ?? []);
  const locked = extractJob.isRunning || extractJob.isStarting;

  const toggleTarget = (t: ExtractTarget) => {
    setTargets(prev => prev.includes(t) ? prev.filter(x => x !== t) : [...prev, t]);
  };

  // 고른 파일만 다시 추출 — 방식 버튼의 '선택'과 추출 현황의 "선택한 N개 다시 추출"이 같이 씀(2026-10-29).
  // 방식이 증분 등으로 바뀌어 있어도 이쪽은 항상 '선택'으로 보냄(추출 현황에서 체크한 파일을 증분으로 돌리는 사고 방지)
  const runSelected = async () => {
    if (targets.length === 0 || locked || selectedFiles.length === 0) return;
    const targetLabel = targets.map(t => EXTRACT_TARGET_LABEL[t]).join(' + ');
    const shown = selectedFiles.slice(0, 8).map(f => `· ${f}`).join('\n');
    const more = selectedFiles.length > 8 ? `\n· 외 ${selectedFiles.length - 8}개` : '';
    const selMsg = `${targetLabel} — 고른 파일 ${selectedFiles.length}개를 다시 추출합니다.\n\n${shown}${more}\n\n`
      + '이 파일 이름으로 남은 기존 행은 지우고 새로 넣습니다. 다른 파일과 같은 (코드/연도/단계) 행이 있으면 이번 값으로 덮어씁니다.';
    if (!await confirmDialog(selMsg, { title: '선택한 파일 다시 추출', confirmText: '다시 추출' })) return;
    extractJob.run({ targets, mode: 'selected', files: selectedFiles });
  };

  // 추출 현황 목록의 체크박스 → '선택' 방식으로 보내고 그 카드의 대상(재무/KPI)도 켬(안 켜면 파일 고르기 표에서 못 고르는 파일이라)
  const pickFromCoverage = (files: string[], target: ExtractTarget, on: boolean) => {
    if (locked) return;
    if (on) {
      setMode('selected');
      setTargets(prev => (prev.includes(target) ? prev : [...prev, target]));
      setSelectedFiles(prev => [...prev, ...files.filter(f => !prev.includes(f))]);
    } else {
      setSelectedFiles(prev => prev.filter(f => !files.includes(f)));
    }
  };

  const run = async () => {
    if (targets.length === 0 || locked) return;
    // 어떤 방식이든 실제로 PPT를 다시 읽어 엑셀을 덮어쓰는 작업이라, 무슨 대상을 어떤 방식으로
    // 돌리는지 한 번 보여주고 확인받는다(2026-09-23 — "당연히 물어볼 줄 알았지" 피드백,
    // 이전엔 reset일 때만 확인해서 증분/전체재처리는 바로 실행돼버렸음)
    const targetLabel = targets.map(t => EXTRACT_TARGET_LABEL[t]).join(' + ');
    const modeInfo = EXTRACT_MODE_INFO[mode];
    if (mode === 'selected') { await runSelected(); return; }
    const msg =`${targetLabel} 데이터를 "${modeInfo.label}" 방식으로 추출합니다.\n\n${modeInfo.desc}`;
    if (!await confirmDialog(msg, { danger: mode === 'reset' })) return;
    extractJob.run({ targets, mode });
  };

  // 중지도 확인받음 — 예전엔 "의도적 클릭이라 생략"했지만(2026-09-23) 실행 버튼 바로 옆이라 잘못 누르기 쉽고,
  // 중지하면 마지막 저장 지점까지만 반영돼 다시 돌려야 해서(2026-09-30 요청)
  const cancel = async () => {
    const ok = await confirmDialog(
      '진행 중인 PPT 데이터 추출을 정말 중지할까요?\n\n마지막으로 저장된 지점까지만 반영되고, 나머지는 다시 추출해야 합니다.',
      { title: '추출 중지', danger: true, confirmText: '중지', cancelText: '계속 진행' },
    );
    if (ok) extractJob.cancel();
  };

  // 추출 현황 카드의 "실패 N개 다시 추출" — 실패한 파일만 다시 읽음(DRM 파일도 시도 — 원본 대신 로컬 사본을 엶)
  const retryFailed = async (target: ExtractTarget) => {
    if (locked) return;
    const ok = await confirmDialog(
      `${EXTRACT_TARGET_LABEL[target]} 추출에서 실패한 파일만 다시 추출합니다.\n\n`
      + '다른 파일과 기존 데이터는 그대로 둡니다. DRM(문서보안) 암호화 파일도 시도하며, 원본은 건드리지 않고 복사본으로 엽니다.',
      { title: '실패 파일 다시 추출', confirmText: '다시 추출', cancelText: '취소' },
    );
    if (ok) extractJob.run({ targets: [target], mode: 'failed' });
  };

  return {
    targets, toggleTarget,
    mode, setMode,
    selectedFiles, setSelectedFiles,
    locked,
    run, runSelected, pickFromCoverage, cancel, retryFailed,
  };
};
