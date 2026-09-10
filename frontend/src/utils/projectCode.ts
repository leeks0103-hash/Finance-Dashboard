/**
 * project_code에서 실제 코드 토큰만 추출 — "(생성 예정)"/"(생성예정)" 같은 placeholder 주석은
 * 시스템마다 띄어쓰기가 달라 문자열째로 매칭하면 깨짐. 애초에 앞쪽 진짜 코드(예: "E147600126030001")만
 * 잘라서 검색/교차조회에 쓰면 공백 차이 문제 자체가 사라짐.
 * "선정 시 생성 예정"처럼 코드가 아예 없는 순수 placeholder는 null — 검색을 시도해도 의미 없음.
 */
const REAL_CODE_RE = /^[A-Z]\d{6,}/;

export const extractRealCode = (raw: string): string | null => {
  const match = raw.trim().match(REAL_CODE_RE);
  return match ? match[0] : null;
};

/**
 * 그 프로젝트코드로 조회되는 재무 이력 건수. 없으면 0.
 *
 * 2뎁스 패널(useFinanceCrossCheckViewModel)이 실제로 던지는 질의와 같은 규칙으로 세야
 * "배지는 있는데 열어보니 없더라"가 생기지 않는다 —
 *   ① 앞쪽 정식 코드만 잘라 검색어로 쓰고(placeholder 주석의 띄어쓰기 차이 회피)
 *   ② 백엔드가 부분일치(contains)로 찾으므로 여기서도 부분일치로 센다.
 * codes가 수백 개라 매 행 스캔이 부담될 수 있어 호출부에서 캐시를 넘겨 재사용한다.
 */
export const countFinanceHistory = (
  rawCode: string,
  codes: Record<string, number> | undefined,
  cache?: Map<string, number>,
): number => {
  if (!codes) return 0;
  const term = (extractRealCode(rawCode) ?? rawCode).trim();
  if (!term) return 0;

  const hit = cache?.get(term);
  if (hit !== undefined) return hit;

  let n = codes[term] ?? 0;
  if (!n) {
    const lower = term.toLowerCase();
    for (const [code, cnt] of Object.entries(codes)) {
      if (code.toLowerCase().includes(lower)) n += cnt;
    }
  }
  cache?.set(term, n);
  return n;
};
