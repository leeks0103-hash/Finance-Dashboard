import type { ReactNode } from 'react';
import { PERF_COL } from './perfPeriod';

function InfoTable({ rows }: { rows: [string, ReactNode][] }) {
  return (
    <table style={{
      width: '100%',
      borderCollapse: 'collapse',
      fontSize: '0.88rem',
      lineHeight: '1.55',
    }}>
      <tbody>
        {rows.map(([label, value]) => (
          <tr key={label} style={{ borderBottom: '1px solid var(--border)' }}>
            <td style={{
              padding: '7px 10px 7px 0',
              fontWeight: 700,
              color: 'var(--text-muted)',
              whiteSpace: 'nowrap',
              verticalAlign: 'top',
              width: '72px',
              fontSize: '0.78rem',
            }}>
              {label}
            </td>
            <td style={{
              padding: '7px 0',
              color: 'var(--text)',
              wordBreak: 'keep-all',
              verticalAlign: 'top',
            }}>
              {value}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function Chip({ text }: { text: string }) {
  return (
    <span style={{
      display: 'inline-block',
      fontFamily: 'monospace',
      fontSize: '0.78rem',
      fontWeight: 600,
      background: 'var(--bg-subtle)',
      border: '1px solid var(--border)',
      borderRadius: '4px',
      padding: '1px 6px',
      color: 'var(--brand-mid)',
      margin: '1px 3px 1px 0',
      lineHeight: '1.5',
    }}>
      {text}
    </span>
  );
}

function Chips({ items }: { items: string[] }) {
  return <>{items.map(t => <Chip key={t} text={t} />)}</>;
}

export const INFO_MONTHLY = (
  <InfoTable rows={[
    ['출처',   '실적현황 엑셀'],
    ['컬럼',   <Chips items={['BF~BQ열 (1~12월 점검)']} />],
    ['대상',   '카테고리 = 매출 행'],
    ['계산',   '월별 합계 (천원 → 억원)'],
    ['표시',   '현재 월 이후는 흐리게 처리'],
    ['필터',   '파트 · 팀 필터 적용'],
  ]} />
);

export const INFO_PROFIT_RATE = (
  <InfoTable rows={[
    ['출처',   '실적현황 엑셀'],
    ['컬럼',   <Chips items={[`${PERF_COL.profitRate}열 (손익률)`]} />],
    ['대상',   '카테고리 = 매출 행'],
    ['계산',   '파트별 평균 이익율 (%)'],
    ['필터',   '파트 · 팀 필터 적용'],
  ]} />
);

export const INFO_COST_BREAKDOWN = (
  <InfoTable rows={[
    ['출처',   '실적현황 엑셀'],
    ['항목',   <Chips items={[
      `${PERF_COL.costDirect}열 (직접원가)`, `${PERF_COL.costLabor}열 (인건비)`,
      `${PERF_COL.costOverhead}열 (공통원가)`, `${PERF_COL.costMgmt}열 (관리비)`,
    ]} />],
    ['계산',   '전체 합산 후 항목별 구성비 (%)'],
    ['필터',   '파트 · 팀 필터 적용'],
  ]} />
);

export const INFO_PLAN_VS_ACTUAL = (
  <InfoTable rows={[
    ['출처',   '실적현황 엑셀'],
    ['계획',   <Chips items={[`${PERF_COL.planInitial}열 (매출 계획)`]} />],
    ['실적',   <Chips items={[PERF_COL.actualRange]} />],
    ['계산',   '파트별 합계 비교'],
    ['필터',   '파트 · 팀 필터 적용'],
  ]} />
);

export const INFO_PROGRESS = (
  <InfoTable rows={[
    ['출처',   '실적현황 엑셀'],
    ['기준',   <Chips items={[`${PERF_COL.progress}열 (진행단계)`]} />],
    ['대상',   '카테고리 = 매출 / 원가 행'],
    ['계산',   '진행단계별 합계'],
    ['필터',   '파트 · 팀 필터 적용 (진행단계 제외)'],
  ]} />
);

export const INFO_ACHIEVEMENT_BARS = (
  <InfoTable rows={[
    ['출처',   '실적현황 엑셀'],
    ['계산',   `${PERF_COL.actualRange} ÷ ${PERF_COL.planInitial}열(매출 계획) × 100`],
    ['색상',   '100% 이상 Hyundai Blue / 70~100% Sky Blue / 70% 미만 Hyundai Gold'],
    ['필터',   '파트 · 팀 필터 적용'],
  ]} />
);

export const INFO_PART_TABLE = (
  <InfoTable rows={[
    ['출처',   '실적현황 엑셀'],
    ['컬럼',   <Chips items={[
      `${PERF_COL.actualRange} (실적)`, `${PERF_COL.actualRange} (원가, category=원가)`,
      `${PERF_COL.checkTotal}열 (점검 연간)`, `${PERF_COL.operatingProfit}열 (경상손익)`, `${PERF_COL.profitRate}열 (손익률)`,
    ]} />],
    ['계산',   '파트별 합계 (천원 → 억원)'],
    ['필터',   '파트 · 팀 필터 적용'],
  ]} />
);

export const INFO_INSIGHT = (
  <InfoTable rows={[
    ['출처',    '재무관점 필수 데이터 추출.xlsx (PPT 추출)'],
    ['대상',    '실적현황 엑셀에 없고 재무 PPT에만 있는 프로젝트'],
    ['의미',    '제안/수주 실패(미수주) 또는 수주 전 단계 프로젝트'],
    ['더블클릭','연도·단계·원가구성 등 재무 상세 펼쳐보기'],
  ]} />
);

export const INFO_PROJECT_TABLE = (
  <InfoTable rows={[
    ['출처',    '실적현황 엑셀'],
    ['대상',    '카테고리 = 매출 행 (1행 = 1프로젝트)'],
    ['좌측 선', <>
      <span style={{ color: 'var(--loss)', fontWeight: 700 }}>빨강</span>: 손익 {'<'} 0
      <br />
      <span style={{ color: 'var(--warn)', fontWeight: 700 }}>노랑</span>: 이익율 {'<'} 5%
      <br />
      <span style={{ fontSize: '0.82em', color: 'var(--text-muted)' }}>(호버 시 배경 강조)</span>
    </>],
    ['더블클릭','재무 PPT 이력 팝업 표시'],
    ['필터',    '파트 · 팀 필터 + 검색어 적용'],
  ]} />
);

export const INFO_FINANCE_SEARCH = (
  <InfoTable rows={[
    ['출처',   '재무관점 필수 데이터 추출.xlsx (PPT 추출)'],
    ['매칭',   '프로젝트코드 · 파트 · 보고단계 · 비고 · 파일명 동시 검색'],
    ['표시',   '보고단계별 이력 전체 (연도별 포함)'],
    ['비고',   '실적현황에 없고 재무에만 있는 프로젝트도 노출'],
  ]} />
);
