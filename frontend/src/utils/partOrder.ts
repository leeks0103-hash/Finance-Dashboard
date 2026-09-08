/** 파트 표시 순서 — 담당자 지정 고정 순서. 파트가 노출되는 모든 곳에서 공용 사용.
 *
 *  ⚠️ 탭마다 파트명 표기가 다르다:
 *    실적현황(사업계획 엑셀) : "① AIㆍDS", "③ 전동화ㆍ차량개발", "④ 미래모빌리티", "⑦ K뉴딜TF"
 *    재무(PPT 파일명 추출)   : "AI", "전차", "미모", "K뉴딜TF"
 *  그래서 완전일치가 아니라 keyword 포함 여부로 매칭한다.
 */

interface PartRule {
  /** 대표 표기 (정렬 기준 이름) */
  label: string;
  /** 이 파트로 인식할 키워드들 — 원문자·공백·구분자 제거 후 부분일치 */
  match: string[];
}

export const PART_ORDER: PartRule[] = [
  { label: 'PM',      match: ['PM'] },
  { label: '신사업',   match: ['신사업'] },
  { label: '전동화',   match: ['전동화', '전차', '차량개발'] },
  { label: '미모',     match: ['미모', '미래모빌리티'] },
  { label: 'SW',      match: ['SW'] },
  { label: 'AI',      match: ['AI'] },
  { label: 'K뉴딜TF', match: ['K뉴딜', 'K-뉴딜'] },
];

/** 비교용 정규화 — 원문자 번호·공백·가운뎃점·하이픈 제거 후 대문자 */
const norm = (v: string): string =>
  String(v ?? '')
    .replace(/^[①-⑳]\s*/, '')
    .replace(/[\s·ㆍ.\-_]/g, '')
    .toUpperCase();

/** 고정 순서상의 위치. 목록에 없는 파트는 맨 뒤로. */
export const partRank = (part: string): number => {
  const p = norm(part);
  const i = PART_ORDER.findIndex(rule => rule.match.some(k => p.includes(norm(k))));
  return i < 0 ? PART_ORDER.length : i;
};

/** 파트명 문자열 배열을 고정 순서로 정렬 (미등록 파트는 뒤에 가나다순) */
export const sortParts = (values: string[]): string[] =>
  [...values].sort((a, b) => {
    const d = partRank(a) - partRank(b);
    return d !== 0 ? d : a.localeCompare(b, 'ko');
  });

/** 객체 배열을 파트 기준 고정 순서로 정렬 */
export const sortByPart = <T>(items: T[], getPart: (item: T) => string): T[] =>
  [...items].sort((a, b) => {
    const d = partRank(getPart(a)) - partRank(getPart(b));
    return d !== 0 ? d : getPart(a).localeCompare(getPart(b), 'ko');
  });
