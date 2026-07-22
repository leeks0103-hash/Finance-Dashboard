interface Props { v: number; text: string; }

const NegCell = ({ v, text }: Props) =>
  v < 0
    ? <span style={{ color: 'var(--loss)', fontWeight: 600 }}>{text}</span>
    : <>{text}</>;

export default NegCell;
