import type { TabId } from '@/components/ui/TabNav/TabNav';
import type { Side, Alignment } from 'driver.js';

/**
 * 사용법 투어 단계 정의 — 경영실적/재무데이터 탭 → KPI/경영현황 탭 → 설정까지 한 바퀴.
 *
 * - `anchor`: 가리킬 요소의 `data-tour` 값. 없으면 화면 가운데 안내(환영/마무리)
 * - `tab`: 이 단계가 보일 탭 — 이전 단계와 다르면 투어가 탭을 넘긴 뒤 요소가 뜰 때까지 기다림
 * - `optional`: 평소엔 안 보이는 요소(데이터 이상 배지 등) — 안 보이면 기다리지 않고 건너뜀
 *
 * 화면에 섹션을 추가/제거하면 여기 단계와 해당 컴포넌트의 `data-tour`(FadeInSection `tourId`)를 같이 맞출 것.
 * description은 driver.js가 innerHTML로 넣음 — <b>, <br> 정도만 사용
 */
export interface TourStepDef {
  tab:          TabId;
  anchor?:      string;
  optional?:    boolean;
  title:        string;
  description:  string;
  side?:        Side;
  align?:       Alignment;
}

export const TOUR_STEPS: TourStepDef[] = [
  {
    tab: 'performance',
    title: '경영현황 통합 대시보드 사용 안내',
    description:
      '주요 화면을 순서대로 짧게 소개합니다.<br>' +
      '<b>다음</b> 버튼이나 키보드 <b>→</b> 키로 넘기고, <b>ESC</b>로 언제든 닫을 수 있어요.<br>' +
      '다시 보려면 우측 상단 <b>⚙ 설정 › 사용방법(튜토리얼)</b>을 누르세요.',
  },
  {
    tab: 'performance',
    anchor: 'tabs',
    title: '탭',
    description:
      '<b>경영실적/재무데이터</b>: 사업계획 통합관리 파일 기준 매출·원가·손익<br>' +
      '<b>KPI/경영현황</b>: 프로젝트 보고서(PPT)에서 추출한 KPI 목표·실적',
    side: 'bottom',
    align: 'center',
  },
  {
    tab: 'performance',
    anchor: 'filter',
    title: '팀·파트 필터',
    description:
      '팀이나 파트를 고르면 아래 카드·차트·표가 한꺼번에 바뀝니다.<br>' +
      '<b>전체</b>를 누르면 모두 선택되고, 그중 빼고 싶은 파트만 해제하면 됩니다. 선택은 브라우저에 저장돼요.',
  },
  {
    tab: 'performance',
    anchor: 'perf-kpi',
    title: '핵심 지표 카드',
    description:
      '계획 · 추정 실적(연간) · 매출 이익 · 경상손익 · 누계 실적을 한눈에 봅니다.<br>' +
      '카드 우측 상단 손잡이를 끌면 <b>순서를 바꿀 수</b> 있어요.',
  },
  {
    tab: 'performance',
    anchor: 'perf-charts',
    title: '차트 — 클릭하면 산출 근거',
    description:
      '막대·도넛 조각(또는 축 이름)을 <b>클릭</b>하면 그 값이 어떤 프로젝트들의 합으로 나왔는지 표로 보여줍니다.<br>' +
      '<b>⤢</b> 크게 보기 · <b>ⓘ</b> 계산 방법 설명 · 손잡이 드래그로 차트 위치 변경',
    side: 'top',
  },
  {
    tab: 'performance',
    anchor: 'perf-achievement',
    title: '파트별 매출 달성 현황',
    description: '파트 행을 <b>클릭</b>하면 그 파트의 프로젝트별 누계 실적을 볼 수 있어요.',
    side: 'top',
  },
  {
    tab: 'performance',
    anchor: 'perf-missed',
    title: '미수주 프로젝트',
    description: '제안했지만 수주하지 못한 프로젝트와 미수 사유를 모아 봅니다.',
    side: 'top',
  },
  {
    tab: 'performance',
    anchor: 'perf-projects',
    title: '프로젝트 상세',
    description:
      '검색하면 실적과 함께 <b>재무 데이터(PPT 보고서) 검색 결과</b>도 아래에 나옵니다.<br>' +
      '프로젝트코드를 <b>더블클릭</b>하면 그 프로젝트의 재무 이력이 펼쳐지고, ' +
      '툴바에서 컬럼 숨김, 헤더를 끌어 순서 변경, 헤더 경계를 끌어 폭 조절이 됩니다.',
    side: 'top',
  },
  {
    tab: 'performance',
    anchor: 'actions',
    title: 'AI 인사이트 · 원본 다운로드',
    description:
      '<b>AI 인사이트</b>: 현재 데이터를 AI가 요약·분석<br>' +
      '<b>↓ Raw Data 다운로드</b>: 대시보드가 읽는 원본 엑셀 파일 받기',
    side: 'bottom',
    align: 'end',
  },
  {
    tab: 'kpi',
    anchor: 'kpi-chart',
    title: 'KPI 목표 vs 실적',
    description:
      'KPI/경영현황 탭으로 넘어왔습니다.<br>' +
      '제목줄 <b>파트</b> 선택으로 범위를 좁히고, 막대를 <b>클릭</b>하면 프로젝트별 산출 근거를 봅니다.',
  },
  {
    tab: 'kpi',
    anchor: 'kpi-summary',
    title: 'KPI 집계',
    description:
      '항목별 사업계획 목표 · 프로젝트 목표 · 실적 · 달성률.<br>' +
      '한 프로젝트가 여러 단계를 보고했으면 <b>가장 진행된 단계 1건</b>만 집계합니다.',
    side: 'top',
  },
  {
    tab: 'kpi',
    anchor: 'kpi-raw',
    title: 'KPI 취합',
    description:
      'PPT에서 뽑은 원본 행 전체입니다. <b>목록 / KPI 상세</b> 전환으로 PPT 표 모양 그대로 볼 수도 있어요.<br>' +
      '완료 전인데 실적이 들어간 항목이 있으면 위에 경고가 뜹니다.',
    side: 'top',
  },
  {
    tab: 'kpi',
    anchor: 'health',
    optional: true,
    title: '데이터 이상 알림 (!)',
    description:
      'KPI↔재무 코드 불일치, 같은 코드를 쓰는 서로 다른 PPT, 완료보고 이상 값이 있을 때만 나타납니다.<br>' +
      '눌러서 문제 파일 목록을 확인하세요.',
    side: 'bottom',
    align: 'end',
  },
  {
    tab: 'kpi',
    anchor: 'settings',
    title: '⚙ 설정',
    description:
      '테마(다크/라이트) · 그래프 수치 표시 · 표 실제값(원 단위) · 재무데이터 확인 바로가기.<br>' +
      '이 안내도 여기 <b>사용방법(튜토리얼)</b>에서 다시 볼 수 있어요. 끝!',
    side: 'bottom',
    align: 'end',
  },
];
