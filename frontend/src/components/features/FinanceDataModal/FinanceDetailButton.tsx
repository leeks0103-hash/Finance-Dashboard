import { useState } from 'react';
import { Button } from '@/components/ui';
import FinanceDataModal from './FinanceDataModal';

/** 문서 + 돋보기 아이콘 — 재무 보고서에서 뽑은 내용을 "자세히 본다"는 뜻(후보 7개 중 사용자가 5번으로 확정, 2026-10-30). 글자색(currentColor)을 따름 */
const ReportIcon = () => (
  <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor"
    strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M8.2 14H4.6a1.3 1.3 0 0 1-1.3-1.3V3.1a1.3 1.3 0 0 1 1.3-1.3h4.9l3.2 3.2v2.4" />
    <path d="M9.5 1.8V5h3.2" />
    <circle cx="10.6" cy="11" r="2.1" />
    <path d="M12.2 12.6l1.6 1.6" />
  </svg>
);

/**
 * 프로젝트 상세 표 제목줄의 "재무 상세" 버튼(2026-10-29 요청, ↓ 엑셀 바로 왼쪽) — 누르면 "프로젝트 재무 상세" 표(재무 PPT에서 뽑은 원본)를
 * 모달로 바로 띄움. 예전엔 ⚙ 메뉴 > 바로가기 > 재무데이터 확인에서만 열 수 있었음(같은 FinanceDataModal).
 * 모양은 따로 꾸미지 않고 앱 표준 Button만, 색은 [인원 입력]과 같은 ghost(흰 바탕+연한 테두리) — 채운 배경(success·primary)은 흰 화면에서 튄다는 의견으로 ↓ 엑셀도 같이 ghost로(2026-10-29). 직접 꾸민 버전이
 * 옆 버튼들과 안 어울린다는 의견이 이어졌음.
 * 상태·모달을 스스로 들고 있어 쓰는 쪽은 toolbarExtra에 끼우기만 하면 됨
 */
const FinanceDetailButton = () => {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="ghost" size="sm" icon={<ReportIcon />}
        onClick={() => setOpen(true)}
        title="프로젝트 재무 상세 — 재무 보고서(PPT)에서 뽑은 프로젝트별 재무 이력을 바로 확인">
        재무 상세
      </Button>
      {open && <FinanceDataModal onClose={() => setOpen(false)} />}
    </>
  );
};

export default FinanceDetailButton;
