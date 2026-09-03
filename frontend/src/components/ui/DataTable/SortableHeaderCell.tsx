import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { CSSProperties, MouseEvent as ReactMouseEvent, ReactNode } from 'react';

interface Props {
  id:                    string;
  isDraggable:           boolean;
  isHighlighted:         boolean;
  highlightedClassName:  string;
  className?:            string;
  width?:                number;
  style?:                CSSProperties;
  onClick?:              (e: ReactMouseEvent<HTMLTableCellElement>) => void;
  children:              ReactNode;
}

/**
 * DnD 정렬 가능한 <th> — useSortable 배선(transform/transition/드래그 attrs) 내부화.
 * 정렬 화살표·리사이즈 핸들 등 셀 내용물은 테이블마다 방식이 달라 children으로 caller가 직접 구성.
 * DataTable·KpiRawTable 공용.
 */
export const SortableHeaderCell = ({
  id, isDraggable, isHighlighted, highlightedClassName, className, width, style, onClick, children,
}: Props) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });

  return (
    <th
      ref={setNodeRef}
      onClick={!isDragging ? onClick : undefined}
      className={[className ?? '', isHighlighted ? highlightedClassName : ''].filter(Boolean).join(' ')}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
        cursor: isDraggable ? 'grab' : undefined,
        width,
        position: 'relative',
        ...style,
      }}
      {...(isDraggable ? { ...attributes, ...listeners } : {})}
    >
      {children}
    </th>
  );
};
