import client from './client';

export interface AiAnalysis {
  text:          string;
  generated_at:  string | null;
}

// H-Chat 응답이 늦으면(관측상 15~30초) 기본 30초 타임아웃보다 넉넉하게
const AI_TIMEOUT_MS = 90_000;

export const getFinanceAiAnalysis = (force = false): Promise<AiAnalysis> =>
  client.get<AiAnalysis>('/ai/finance', { params: force ? { force: 1 } : undefined, timeout: AI_TIMEOUT_MS })
    .then(r => r.data);

export const getKpiAiAnalysis = (force = false): Promise<AiAnalysis> =>
  client.get<AiAnalysis>('/ai/kpi', { params: force ? { force: 1 } : undefined, timeout: AI_TIMEOUT_MS })
    .then(r => r.data);
