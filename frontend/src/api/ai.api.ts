import client from './client';

export interface AiAnalysis {
  text:          string;
  generated_at:  string | null;
}

// H-Chat 분석은 1회 90~100초 걸림(2026-10-22 실측 97초·92초, 경영실적 max_tokens 7000) — 예전 90초 한도에선 서버는 끝까지 분석·저장하는데
// 화면만 타임아웃으로 '분석 실패'가 떴음. 서버 H-Chat 호출 한도(150초)보다 넉넉하게
const AI_TIMEOUT_MS = 200_000;

export const getFinanceAiAnalysis = (force = false): Promise<AiAnalysis> =>
  client.get<AiAnalysis>('/ai/finance', { params: force ? { force: 1 } : undefined, timeout: AI_TIMEOUT_MS })
    .then(r => r.data);

export const getKpiAiAnalysis = (force = false): Promise<AiAnalysis> =>
  client.get<AiAnalysis>('/ai/kpi', { params: force ? { force: 1 } : undefined, timeout: AI_TIMEOUT_MS })
    .then(r => r.data);
