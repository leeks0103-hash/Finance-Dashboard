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
