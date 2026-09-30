export type LineIconKind = 'search' | 'list' | 'chart' | 'note' | 'inbox';

interface Props {
  kind:       LineIconKind;
  /** 한 변 길이(px) — 기본 28 */
  size?:      number;
  className?: string;
}

/**
 * 빈 상태·안내용 얇은 선 아이콘 — 글자색(currentColor)을 따라감.
 * 이모지(📊📭📝)는 OS마다 모양·색이 달라 화면에서 튀어 보여서 전부 이걸로 대체(2026-09-30).
 */
export const LineIcon = ({ kind, size = 28, className }: Props) => (
  <svg className={className} viewBox="0 0 24 24" width={size} height={size} aria-hidden="true"
    fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    {kind === 'search' && (
      <>
        <circle cx="10.5" cy="10.5" r="6" />
        <path d="M15 15l5 5" />
      </>
    )}
    {kind === 'list' && (
      <>
        <rect x="4" y="4" width="16" height="16" rx="2.5" />
        <path d="M8 9h8M8 12.5h8M8 16h5" />
      </>
    )}
    {kind === 'chart' && (
      <>
        <path d="M4 4v16h16" />
        <path d="M8.5 16v-4M12.5 16V8M16.5 16v-6" />
      </>
    )}
    {kind === 'note' && (
      <>
        <path d="M6 3.5h8.5L19 8v12.5H6z" />
        <path d="M14.5 3.5V8H19M9 12.5h7M9 16h5" />
      </>
    )}
    {kind === 'inbox' && (
      <>
        <path d="M4 13.5l2.5-8h11l2.5 8v5.5H4z" />
        <path d="M4 13.5h4.5l1 2.5h5l1-2.5H20" />
      </>
    )}
  </svg>
);

export default LineIcon;
