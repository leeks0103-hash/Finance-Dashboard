import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { Button, Modal, ModalBadge } from '@/components/ui';
import { useExtractJob } from '@/hooks/useExtractJob';
import AdminActionCard from '@/components/features/Admin/AdminActionCard';
import AdminChartColorSection from '@/components/features/Admin/AdminChartColorSection';
import AdminExtractModal from '@/components/features/Admin/AdminExtractModal';
import AdminSettingsSection from '@/components/features/Admin/AdminSettingsSection';
import PerfUpdatePanel from '@/components/features/Admin/PerfUpdatePanel';
import PartHeadcountPanel from '@/components/features/Admin/PartHeadcountPanel';
import FinMismatch from '@/components/features/Admin/FinMismatch';
import SecretMailPanel from '@/components/features/Admin/SecretMailPanel';
import styles from './AdminPage.module.css';

type AdminSectionId = 'settings' | 'chart-colors' | 'perf-file' | 'headcount' | 'extract' | 'fin-mismatch' | 'secret-mail';

const SECTIONS: { id: AdminSectionId; label: string; desc: string }[] = [
  { id: 'settings',     label: '화면 설정',      desc: '공개 범위 · 로그인 요구 · AI 인사이트' },
  { id: 'chart-colors', label: '차트 색상',      desc: '막대·도넛 역할별 색 · 주간/야간' },
  { id: 'perf-file',    label: '실적현황 파일',  desc: '새 실적 엑셀 자동 반영' },
  { id: 'headcount',    label: '파트별 인원',    desc: '인당 매출·손익·관리비 계산용' },
  { id: 'extract',      label: 'PPT 추출',       desc: '재무·KPI 추출 실행 · 추출 현황' },
  { id: 'fin-mismatch', label: '재무 불일치',    desc: '완료 프로젝트 실적↔재무 대조' },
  { id: 'secret-mail',  label: '시크릿 키 메일', desc: '임직원 로그인 키 발송' },
];

const LS_SIDE_COLLAPSED = 'admin-side-collapsed';

/** 섹션 머리말 + 내용 — 스크롤로 넘어올 때 navbar에 가리지 않게 CSS scroll-margin-top */
const Block = ({ id, label, desc, children }: { id: AdminSectionId; label: string; desc: string; children: ReactNode }) => (
  <section id={`admin-${id}`} data-admin-section={id} className={styles.block} aria-labelledby={`admin-${id}-title`}>
    <header className={styles.blockHead}>
      <h2 id={`admin-${id}-title`} className={styles.blockTitle}>{label}</h2>
      <span className={styles.blockDesc}>{desc}</span>
    </header>
    {children}
  </section>
);

/**
 * 관리자 페이지(#/admin) — 예전 ⚙ > 관리자 기능 모달(2026-10-23 기능이 늘어 페이지로 분리).
 * 한 페이지에 모든 섹션을 세로로 놓고, 왼쪽 사이드바는 URL을 바꾸지 않고 그 섹션으로 부드럽게 스크롤만 한다.
 * 지금 보고 있는 섹션은 IntersectionObserver로 메뉴에 표시(스크롤 위치 계산·scroll 이벤트 없이).
 * 내용이 큰 항목(실적현황 파일·PPT 추출·재무 불일치·시크릿 키 메일)은 카드의 버튼으로 모달에서 연다.
 * 접근 제한은 AdminRoute(App.tsx)가 맡음.
 */
const AdminPage = () => {
  // 훅은 여기 하나만 두고 추출 모달에 넘김 — 메뉴의 "추출 중…" 표시도 같은 인증·진행 상태를 봐야 해서
  const extractJob = useExtractJob();
  const [perfFileOpen, setPerfFileOpen] = useState(false);
  const [extractOpen, setExtractOpen] = useState(false);

  // 사이드바 숨기기 — 넓게 보고 싶을 때. 이 브라우저에 기억(2026-10-23 "숨김 버튼도 없네")
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem(LS_SIDE_COLLAPSED) === '1');
  const toggleSide = () => setCollapsed(v => {
    localStorage.setItem(LS_SIDE_COLLAPSED, v ? '0' : '1');
    return !v;
  });
  const [active, setActive] = useState<AdminSectionId>(SECTIONS[0].id);
  // 메뉴 클릭으로 스크롤하는 동안엔 옵저버가 지나가는 섹션마다 표시를 바꾸지 않게 잠깐 잠금
  const lockUntil = useRef(0);
  const bottomRef = useRef<HTMLDivElement>(null);

  const goTo = useCallback((id: AdminSectionId) => {
    setActive(id);
    lockUntil.current = Date.now() + 700;
    document.getElementById(`admin-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, []);

  // 지금 보는 섹션 = 화면 위쪽 띠(위에서 15%~35% 구간)에 걸친 섹션. 맨 아래 센티널이 보이면(끝까지 내림) 마지막 섹션
  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver(entries => {
      if (Date.now() < lockUntil.current) return;
      const hit = entries.filter(e => e.isIntersecting).map(e => (e.target as HTMLElement).dataset.adminSection as AdminSectionId | undefined);
      const bottom = entries.some(e => e.isIntersecting && e.target === bottomRef.current);
      if (bottom) setActive(SECTIONS[SECTIONS.length - 1].id);
      else if (hit[0]) setActive(hit[0]);
    }, { rootMargin: '-15% 0px -65% 0px', threshold: 0 });
    document.querySelectorAll('[data-admin-section]').forEach(el => io.observe(el));
    if (bottomRef.current) io.observe(bottomRef.current);
    return () => io.disconnect();
  }, []);

  return (
    <main className={`${styles.page} ${collapsed ? styles.collapsed : ''}`}>
      {/* 숨겼을 때 다시 펼치는 버튼 — 화면 왼쪽 가장자리에 떠 있음 */}
      {collapsed && (
        <Button unstyled className={styles.sideOpen} onClick={toggleSide}
          aria-label="사이드바 펼치기" title="사이드바 펼치기">»</Button>
      )}
      <aside className={styles.side} aria-hidden={collapsed || undefined}>
        <div className={styles.sideHead}>
          <div className={styles.sideTitleRow}>
            <h1 className={styles.title}>관리자 기능</h1>
            <Button unstyled className={styles.sideToggle} onClick={toggleSide}
              aria-label="사이드바 숨기기" title="사이드바 숨기기" tabIndex={collapsed ? -1 : 0}>«</Button>
          </div>
          <span className={styles.who}>
            <ModalBadge>인증됨</ModalBadge>{extractJob.authedName || '관리자'}
          </span>
        </div>
        <nav className={styles.menu} aria-label="관리자 기능 바로가기">
          {SECTIONS.map(s => (
            <Button key={s.id} unstyled title={s.desc}
              className={`${styles.menuItem} ${active === s.id ? styles.menuActive : ''}`}
              aria-current={active === s.id ? 'true' : undefined}
              onClick={() => goTo(s.id)}>
              <span>{s.label}</span>
              {s.id === 'extract' && extractJob.isRunning && (
                <span className={styles.running}><span className={styles.spinner} aria-hidden />추출 중…</span>
              )}
            </Button>
          ))}
        </nav>
        <Button variant="ghost" size="sm" className={styles.logout} onClick={extractJob.logout}>로그아웃</Button>
      </aside>

      <div className={styles.content}>
        <Block id="settings" label="화면 설정" desc="공개 범위 · 로그인 요구 · AI 인사이트 — 바꾸면 접속한 모든 사람에게 적용">
          <AdminSettingsSection />
        </Block>
        <Block id="chart-colors" label="차트 색상" desc="역할별 색 선택 — 이 브라우저에만 저장">
          <AdminChartColorSection />
        </Block>
        <Block id="perf-file" label="실적현황 파일" desc="새 실적 엑셀을 넣으면 열 맞추기·계산식 검증 후 자동 반영">
          <AdminActionCard title="실적현황 파일 자동 반영" desc="새 실적 엑셀을 끌어다 놓거나 선택 · 반영 상태·실패 이유 확인 · 다시 시도"
            buttonLabel="열기" onClick={() => setPerfFileOpen(true)} />
        </Block>
        <Block id="headcount" label="파트별 인원" desc="실적 탭 인당 매출·손익·관리비 차트의 분모 — 저장하면 모든 사용자에게 반영">
          <div className={styles.card}><PartHeadcountPanel /></div>
        </Block>
        <Block id="extract" label="PPT 추출" desc="재무·KPI PPT를 다시 읽어 데이터에 반영 · 추출 현황">
          <AdminActionCard title="PPT 데이터 추출(파싱)" desc="대상·방식 고르기 · 실행/중지 · 추출 현황과 안 된 파일 이유"
            buttonLabel={extractJob.isRunning ? '추출 중… 보기' : '열기'} onClick={() => setExtractOpen(true)}
            badge={extractJob.isRunning ? <span className={styles.running}><span className={styles.spinner} aria-hidden />추출 중…</span> : undefined} />
        </Block>
        <Block id="fin-mismatch" label="재무 불일치" desc="완료 프로젝트의 실적현황 ↔ 재무 이력 매출·직접원가 대조">
          <FinMismatch />
        </Block>
        <Block id="secret-mail" label="시크릿 키 메일" desc="임직원에게 로그인 시크릿 키를 Outlook으로 한 사람씩 발송">
          <SecretMailPanel />
        </Block>
        {/* 맨 아래 센티널 — 마지막 섹션이 짧아 위쪽 띠까지 못 올라와도 끝까지 내리면 마지막 메뉴가 켜지게 */}
        <div ref={bottomRef} className={styles.bottom} aria-hidden />
      </div>

      {perfFileOpen && (
        <Modal title="실적현황 파일 자동 반영" sub="새 실적 엑셀을 넣으면 열 맞추기·계산식 검증 후 자동 반영" width="min(760px, 94vw)"
          onClose={() => setPerfFileOpen(false)}>
          <PerfUpdatePanel />
        </Modal>
      )}
      {extractOpen && <AdminExtractModal extractJob={extractJob} onClose={() => setExtractOpen(false)} />}
    </main>
  );
};

export default AdminPage;
