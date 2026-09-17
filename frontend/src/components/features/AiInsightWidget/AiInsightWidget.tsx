import { useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useAiAnalysis, type AiTab } from '@/hooks';
import { Button } from '@/components/ui';
import { useScrollLock } from '@/components/ui/useScrollLock';
import { useEscToClose } from '@/components/ui/useEscToClose';
import styles from './AiInsightWidget.module.css';

const TAB_LABEL: Record<AiTab, string> = {
  finance: '경영실적 인사이트',
  kpi:     'KPI 현황 인사이트',
};

interface Props {
  /** 이 위젯이 어떤 탭의 분석을 보여줄지 — 호출부(KpiActionBar/PerformanceActionBar)가 지정 */
  aiTab: AiTab;
}

/**
 * 아주 가벼운 마크다운 렌더러 — 라이브러리 없이 H-Chat 응답에 자주 나오는
 * 헤더(#/##/###) · **볼드** · - 불릿 · | 표 | · --- 구분선만 처리.
 * 그 외 서식은 그냥 문단으로 표시(줄바꿈은 유지).
 */
const renderInline = (s: string): ReactNode =>
  s.split(/(\*\*[^*]+\*\*)/g).map((p, i) =>
    p.startsWith('**') && p.endsWith('**') ? <strong key={i}>{p.slice(2, -2)}</strong> : p);

const renderMarkdown = (text: string): ReactNode[] => {
  const lines = text.split('\n');
  const blocks: ReactNode[] = [];
  let tableBuf: string[] = [];

  const flushTable = () => {
    if (tableBuf.length < 2) { tableBuf = []; return; }
    const rows = tableBuf.filter(l => !/^\|?\s*[-:]+\s*\|/.test(l));
    blocks.push(
      <table key={`table-${blocks.length}`} className={styles.table}>
        <tbody>
          {rows.map((row, ri) => {
            const cells = row.split('|').map(c => c.trim()).filter((_, i, arr) => i !== 0 && i !== arr.length - 1);
            const Tag = ri === 0 ? 'th' : 'td';
            return <tr key={ri}>{cells.map((c, ci) => <Tag key={ci}>{renderInline(c)}</Tag>)}</tr>;
          })}
        </tbody>
      </table>,
    );
    tableBuf = [];
  };

  lines.forEach((line, i) => {
    if (line.trim().startsWith('|')) { tableBuf.push(line); return; }
    flushTable();
    const t = line.trim();
    if (!t) return;
    if (t.startsWith('### ')) { blocks.push(<h4 key={i} className={styles.h4}>{renderInline(t.slice(4))}</h4>); return; }
    if (t.startsWith('## '))  { blocks.push(<h3 key={i} className={styles.h3}>{renderInline(t.slice(3))}</h3>); return; }
    if (t.startsWith('# '))   { blocks.push(<h2 key={i} className={styles.h2}>{renderInline(t.slice(2))}</h2>); return; }
    if (/^[-*]\s+/.test(t))   { blocks.push(<div key={i} className={styles.li}>• {renderInline(t.replace(/^[-*]\s+/, ''))}</div>); return; }
    if (t === '---')          { blocks.push(<hr key={i} className={styles.hr} />); return; }
    blocks.push(<p key={i} className={styles.p}>{renderInline(t)}</p>);
  });
  flushTable();
  return blocks;
};

const AiInsightWidget = ({ aiTab }: Props) => {
  const [open, setOpen] = useState(false);

  const { text, generatedAt, isLoading, isError, refresh, isRefreshing } =
    useAiAnalysis(aiTab, open);

  useScrollLock(open);
  useEscToClose(() => setOpen(false), open);

  return (
    <>
      <Button
        variant="primary"
        size="sm"
        onClick={() => setOpen(true)}
        title="AI 분석 보기"
      >
        🤖 {TAB_LABEL[aiTab]}
      </Button>

      {open && createPortal(
        <div className={styles.overlay} onClick={() => setOpen(false)}>
          <div className={styles.panel} onClick={e => e.stopPropagation()}>
            <div className={styles.header}>
              <span className={styles.title}>{TAB_LABEL[aiTab]}</span>
              <div className={styles.headerActions}>
                <Button variant="ghost" size="sm" onClick={refresh} disabled={isRefreshing || isLoading}>
                  {isRefreshing ? '분석 중…' : '↺ 다시 분석'}
                </Button>
                <Button variant="ghost" size="sm" className={styles.closeBtn} onClick={() => setOpen(false)} aria-label="닫기">✕</Button>
              </div>
            </div>

            <div className={styles.body}>
              {(isLoading || isRefreshing) && (
                <div className={styles.state}>AI가 분석 중입니다… (최초 1회는 15~30초 정도 걸릴 수 있어요)</div>
              )}
              {!isLoading && !isRefreshing && isError && (
                <div className={styles.state}>분석을 불러오지 못했습니다. 잠시 후 다시 시도해주세요.</div>
              )}
              {!isLoading && !isRefreshing && !isError && !text && (
                <div className={styles.state}>표시할 분석 내용이 없습니다.</div>
              )}
              {!isLoading && !isRefreshing && !isError && text && (
                <div className={styles.content}>{renderMarkdown(text)}</div>
              )}
            </div>

            {generatedAt && (
              <div className={styles.footer}>생성 시각: {generatedAt}</div>
            )}
          </div>
        </div>,
        document.body,
      )}
    </>
  );
};

export default AiInsightWidget;
