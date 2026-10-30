import { useState, type ReactNode } from 'react';
import { Button, ModalShell, ModalCloseButton, ModalBadge } from '@/components/ui';
import { useExtractJob } from '@/hooks/useExtractJob';
import AdminSettingsSection from './AdminSettingsSection';
import AdminChartColorSection from './AdminChartColorSection';
import AdminExtractSection from './AdminExtractSection';
import PerfUpdatePanel from './PerfUpdatePanel';
import FinMismatch from './FinMismatch';
import SecretMailPanel from './SecretMailPanel';
// 파트별 인원은 관리자 기능에서 뺌(2026-10-29 요청) — 실적 탭 "파트별 인원" 카드 오른쪽 끝의 [인원 입력]에서만(AdminQuickActions). 관리자만 고칠 수 있는 건 그대로
// import PartHeadcountPanel from './PartHeadcountPanel';
import styles from './AdminModal.module.css';

type TabId = 'data' | 'view' | 'mail';
// | 'headcount'

const TABS: { id: TabId; label: string; desc: string }[] = [
  { id: 'data', label: '데이터',        desc: '실적 파일 · PPT 추출 · 재무 불일치' },
  { id: 'view', label: '화면·접근',     desc: '공개 범위 · 로그인 요구 · 차트 색상' },
  { id: 'mail', label: '시크릿 키 메일', desc: '임직원 로그인 키 발송' },
  // { id: 'headcount', label: '파트별 인원', desc: '인당 매출·손익·관리비 계산용' },
];

interface StepProps {
  /** 순서가 있는 묶음(데이터 탭)이면 번호, 아니면 생략 */
  no?: number;
  title: string;
  desc: string;
  children: ReactNode;
}

/** 탭 안의 한 덩어리 — 번호 · 제목 · 한 줄 설명 + 내용 */
const Step = ({ no, title, desc, children }: StepProps) => (
  <section className={styles.step}>
    <header className={styles.stepHead}>
      {no != null && <span className={styles.stepNo} aria-hidden>{no}</span>}
      <div className={styles.stepText}>
        <h3 className={styles.stepTitle}>{title}</h3>
        <p className={styles.stepDesc}>{desc}</p>
      </div>
    </header>
    <div className={styles.stepBody}>{children}</div>
  </section>
);

/**
 * 관리자 기능 창(2026-10-29) — 관리자 페이지(#/admin)가 불편하다는 의견으로 다시 모달로.
 * 열기 버튼 카드 대신 내용을 창 안에 바로 펼침. 왼쪽 탭 3개:
 *  · 데이터 — 실적현황 파일 → PPT 추출 → 재무 불일치(한 흐름이라 세트로, 위에서 아래로)
 *  · 화면·접근 — 공개 범위·로그인 요구·AI 인사이트 + 차트 색상
 *  · 시크릿 키 메일
 * 여는 곳은 상단 바 관리자 아이콘(Navbar, 관리자에게만 보임) — 서버 관리자 API는 따로 403.
 * 훅은 여기서 하나 만들어 PPT 추출에 넘김(진행 상태·인증을 탭 표시와 맞추려고)
 */
const AdminModal = ({ onClose }: { onClose: () => void }) => {
  const extractJob = useExtractJob();
  const [tab, setTab] = useState<TabId>('data');

  return (
    <ModalShell onClose={onClose} className={styles.panel}>
      {close => (
        <>
          <div className={styles.header}>
            <div className={styles.titleWrap}>
              <h3 className={styles.title}>관리자 기능</h3>
              <div className={styles.sub}>
                <ModalBadge>인증됨</ModalBadge>{extractJob.authedName || '관리자'}
              </div>
            </div>
            <ModalCloseButton onClick={close} />
          </div>

          <div className={styles.main}>
            <nav className={styles.rail} aria-label="관리자 기능 구분">
              {TABS.map(t => (
                <Button key={t.id} unstyled
                  className={`${styles.tab} ${tab === t.id ? styles.tabActive : ''}`}
                  aria-current={tab === t.id ? 'true' : undefined}
                  onClick={() => setTab(t.id)}>
                  <span className={styles.tabLabel}>
                    {t.label}
                    {t.id === 'data' && extractJob.isRunning && (
                      <span className={styles.running}><span className={styles.spinner} aria-hidden />추출 중…</span>
                    )}
                  </span>
                  <span className={styles.tabDesc}>{t.desc}</span>
                </Button>
              ))}
              <Button variant="ghost" size="sm" className={styles.logout} onClick={extractJob.logout}>로그아웃</Button>
            </nav>

            {/* key = 탭 — 바꿀 때마다 살짝 페이드(스크롤도 맨 위부터) */}
            <div className={styles.pane} key={tab}>
              {tab === 'data' && (
                <>
                  <Step no={1} title="실적현황 파일" desc="새 실적 엑셀을 넣으면 열 맞추기·계산식 검증 후 자동 반영 — 반영 상태·실패 이유 확인">
                    <div className={styles.card}><PerfUpdatePanel /></div>
                  </Step>
                  <Step no={2} title="PPT 추출" desc="재무·KPI PPT를 다시 읽어 데이터에 반영 · 추출 현황과 안 된 파일 이유">
                    <AdminExtractSection extractJob={extractJob} />
                  </Step>
                  <Step no={3} title="재무 불일치" desc="완료 프로젝트의 실적현황 ↔ 재무 이력 매출·직접원가 대조">
                    <FinMismatch inline />
                  </Step>
                </>
              )}

              {tab === 'view' && (
                <>
                  <Step title="화면 설정" desc="공개 범위 · 로그인 요구 · AI 인사이트 — 바꾸면 접속한 모든 사람에게 적용">
                    <AdminSettingsSection />
                  </Step>
                  <Step title="차트 색상" desc="역할별 색 선택 — 이 브라우저에만 저장">
                    <AdminChartColorSection />
                  </Step>
                </>
              )}

              {tab === 'mail' && (
                <Step title="시크릿 키 메일" desc="임직원에게 로그인 시크릿 키를 Outlook으로 한 사람씩 발송">
                  <SecretMailPanel inline />
                </Step>
              )}

              {/* {tab === 'headcount' && (
                <Step title="파트별 인원" desc="실적 탭 인당 매출·손익·관리비 차트의 분모 — 저장하면 모든 사용자에게 반영">
                  <div className={styles.card}><PartHeadcountPanel /></div>
                </Step>
              )} */}
            </div>
          </div>
        </>
      )}
    </ModalShell>
  );
};

export default AdminModal;
