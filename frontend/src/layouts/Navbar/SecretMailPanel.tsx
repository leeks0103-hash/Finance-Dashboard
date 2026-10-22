import { useMemo, useState } from 'react';
import { Button, confirmDialog } from '@/components/ui';
import { usePresence } from '@/components/ui/useAnimatedClose';
import { useSecretMail } from '@/hooks/useSecretMail';
import type { SecretMailRow } from '@/types/secretMail.types';
import SecretMailPreviewModal from './SecretMailPreviewModal';
import styles from './SecretMailPanel.module.css';

const COLLAPSE_MS = 240;   // .closing 애니메이션 길이와 맞출 것

const shortTime = (s: string) => s.slice(5, 16);   // "MM-DD HH:MM"
const nameOf = (r: SecretMailRow) => r.name || r.emp;

/** 확인창용 명단 — 8명까지 + 외 N명 */
const listText = (rows: SecretMailRow[]) =>
  rows.slice(0, 8).map(r => `· ${nameOf(r)} (${r.emp}) ${r.mail}`).join('\n')
  + (rows.length > 8 ? `\n· 외 ${rows.length - 8}명` : '');

/**
 * 관리자 기능 > 시크릿 키 메일(2026-10-22) — 임직원에게 대시보드 로그인 시크릿 키를 Outlook으로 보냄.
 * 이 서버 PC Outlook 기본 계정으로, 한 사람씩 차례로(받는 사람 본인만·참조 없음·본문은 키만). 서버 secret_mail.py.
 * 전체 보내기 = 관리자·발송 담당 빼고 아직 안 보낸 사람 / 골라서 보내기 = 체크한 사람(이미 보냈어도 다시).
 * 같은 일을 send_user_secrets.bat으로도 할 수 있음
 */
const SecretMailPanel = () => {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<string[]>([]);
  // 미리보기 — 처음 보여 줄 사람(체크한 첫 사람, 없으면 목록 첫 사람)
  const [previewEmp, setPreviewEmp] = useState<string | null>(null);
  // 펼침/접힘 — 위에서 아래로(0fr → 1fr), 접을 땐 애니메이션 끝난 뒤 제거(재무 검색 결과와 같은 방식)
  const { mounted, closing } = usePresence(open, COLLAPSE_MS);
  const [settled, setSettled] = useState(false);
  const mail = useSecretMail(mounted);
  const rows = useMemo(() => mail.data?.rows ?? [], [mail.data]);
  const job = mail.job;
  const locked = mail.running || mail.isStarting;

  const selectedSet = useMemo(() => new Set(selected), [selected]);
  const q = query.trim().toLowerCase();
  const visible = q
    ? rows.filter(r => [r.name, r.emp, r.mail].some(v => v.toLowerCase().includes(q)))
    : rows;
  // 전체 보내기 대상 — 서버(mode all)와 같은 기준
  const allTargets = rows.filter(r => !r.excluded && !r.sent_at);
  const allBlocked = allTargets.filter(r => !r.key_ok);
  const pickedRows = rows.filter(r => selectedSet.has(r.emp));
  const sentCount = rows.filter(r => r.sent_at).length;

  const toggle = (emp: string) =>
    setSelected(prev => (prev.includes(emp) ? prev.filter(e => e !== emp) : [...prev, emp]));
  const visibleSendable = visible.filter(r => r.key_ok);
  const allVisibleChecked = visibleSendable.length > 0 && visibleSendable.every(r => selectedSet.has(r.emp));
  const toggleVisible = () => setSelected(prev => {
    const ids = new Set(visibleSendable.map(r => r.emp));
    return allVisibleChecked ? prev.filter(e => !ids.has(e)) : [...new Set([...prev, ...ids])];
  });

  const sender = mail.data?.sender ?? '(보내는 계정 확인 못 함)';

  const handleSendSelected = async () => {
    if (!pickedRows.length || locked) return;
    const again = pickedRows.filter(r => r.sent_at).length;
    const ok = await confirmDialog(
      `${pickedRows.length}명에게 시크릿 키 메일을 한 사람씩 차례로 보냅니다.\n보내는 계정: ${sender}\n\n${listText(pickedRows)}`
      + (again ? `\n\n이 중 ${again}명은 이미 보낸 적이 있어 한 번 더 갑니다.` : ''),
      { title: '골라서 보내기', confirmText: '보내기' },
    );
    if (ok) { mail.start({ mode: 'selected', emps: pickedRows.map(r => r.emp) }); setSelected([]); }
  };

  const handleSendAll = async () => {
    if (!allTargets.length || locked || allBlocked.length) return;
    const ok = await confirmDialog(
      `관리자를 뺀, 아직 안 보낸 ${allTargets.length}명에게 시크릿 키 메일을 한 사람씩 차례로 보냅니다.\n`
      + `보내는 계정: ${sender}\n\n${listText(allTargets)}\n\n보낸 메일은 되돌릴 수 없습니다.`,
      { title: '전체 보내기', confirmText: `${allTargets.length}명에게 보내기`, danger: true },
    );
    if (ok) mail.start({ mode: 'all' });
  };

  const handleCancel = async () => {
    const ok = await confirmDialog('보내기를 멈출까요? 지금 보내는 한 통까지만 가고 나머지는 안 갑니다.',
      { title: '보내기 중지', danger: true, confirmText: '중지', cancelText: '계속 보내기' });
    if (ok) mail.cancel();
  };

  const pct = job?.total ? Math.round(((job.done ?? 0) + (job.failed?.length ?? 0)) / job.total * 100) : 0;

  return (
    <section className={styles.wrap}>
      <div className={styles.top}>
        <div className={styles.titleBox}>
          <span className={styles.title}>시크릿 키 메일</span>
          <span className={styles.sub}>임직원에게 로그인 시크릿 키를 Outlook으로 · 한 사람씩 차례로, 받는 사람은 본인만(참조 없음) · 본문은 키만</span>
        </div>
        <Button variant="primary" size="sm" onClick={() => { setSettled(false); setOpen(v => !v); }}>{open ? '접기' : '명단 보기'}</Button>
      </div>

      {mounted && (
        <div className={`${styles.reveal} ${closing ? styles.closing : ''} ${settled && !closing ? styles.settled : ''}`}
          onAnimationEnd={e => { if (e.target === e.currentTarget && !closing) setSettled(true); }}>
        <div className={styles.revealInner}>
        <div className={styles.body}>
          {mail.isLoading && <span className={styles.muted}>명단·Outlook 확인 중…</span>}
          {mail.loadError && (
            <span className={styles.error}>
              {mail.loadError}{' '}
              <Button variant="ghost" size="sm" onClick={mail.refetch}>다시 확인</Button>
            </span>
          )}

          {mail.data && (
            <dl className={styles.info}>
              <dt>보내는 계정</dt>
              <dd>{mail.data.sender
                ? <b>{mail.data.sender}</b>
                : <span className={styles.error}>{mail.data.sender_error ?? 'Outlook 계정을 찾지 못함'}</span>}
                <span className={styles.muted}> — 이 서버 PC Outlook 기본 계정</span></dd>
              <dt>제목</dt><dd>{mail.data.subject}</dd>
              <dt>명단</dt>
              <dd>{mail.data.file ?? '-'} <span className={styles.muted}>· {rows.length}명 · 보냄 {sentCount}명</span></dd>
            </dl>
          )}

          {/* 진행 상황 — 보내는 동안 / 끝난 뒤 결과 */}
          {job?.running && (
            <div className={styles.progress}>
              <div className={styles.progressHead}>
                <span>보내는 중 {(job.done ?? 0) + (job.failed?.length ?? 0)}/{job.total}
                  {job.current && <span className={styles.muted}> — {job.current}</span>}</span>
                <Button variant="danger" size="sm" loading={mail.isCancelling} onClick={handleCancel}>중지</Button>
              </div>
              <div className={styles.bar}><div className={styles.barFill} style={{ width: `${pct}%` }} /></div>
              <span className={styles.muted}>이 창을 닫아도 서버에서 계속 보냅니다</span>
            </div>
          )}
          {!job?.running && job?.finished_at && (
            <div className={job.error || job.failed?.length ? styles.resultBad : styles.result}>
              {job.error
                ? job.error
                : `${job.cancelled ? '중지됨' : '완료'} (${shortTime(job.finished_at)}) — 보냄 ${job.done ?? 0}명`
                  + (job.failed?.length ? ` / 실패 ${job.failed.length}명` : '')}
              {!!job.failed?.length && (
                <ul className={styles.failList}>
                  {job.failed.map(f => <li key={f.emp}>{f.name || f.emp} ({f.mail}) — {f.error}</li>)}
                </ul>
              )}
            </div>
          )}
          {mail.startError && <span className={styles.error}>{mail.startError}</span>}

          {rows.length > 0 && (
            <>
              <div className={styles.toolbar}>
                <input className={styles.search} type="search" placeholder="이름·사번·메일 검색"
                  value={query} onChange={e => setQuery(e.target.value)} />
                <span className={styles.count}>선택 {selected.length}명</span>
                <Button variant="ghost" size="sm" onClick={() => setSelected([])} disabled={!selected.length}>선택 해제</Button>
              </div>
              <ul className={styles.list}>
                <li className={styles.headRow}>
                  <label className={styles.item}>
                    <input type="checkbox" checked={allVisibleChecked} onChange={toggleVisible}
                      disabled={locked || !visibleSendable.length} />
                    <span className={styles.headLabel}>{q ? '찾은 사람 전체' : '전체 선택'}</span>
                  </label>
                </li>
                {visible.map(r => (
                  <li key={r.emp}>
                    <label className={`${styles.item} ${r.key_ok ? '' : styles.itemOff}`}
                      title={r.key_ok ? undefined : '로그인 비밀번호(.env)와 엑셀 시크릿키가 다르거나 계정이 없음 — 보낼 수 없음'}>
                      <input type="checkbox" checked={selectedSet.has(r.emp)} onChange={() => toggle(r.emp)}
                        disabled={locked || !r.key_ok} />
                      <span className={styles.name}>{r.name || '-'}</span>
                      <span className={styles.emp}>{r.emp}</span>
                      <span className={styles.mail}>{r.mail}</span>
                      <span className={styles.tags}>
                        {r.excluded && <span className={styles.tag} title="전체 보내기에서 빠짐(골라서는 보낼 수 있음)">관리자</span>}
                        {!r.key_ok && <span className={`${styles.tag} ${styles.tagBad}`}>키 불일치</span>}
                        {r.sent_at && <span className={`${styles.tag} ${styles.tagSent}`} title={`보낸 시각 ${r.sent_at}`}>보냄 {shortTime(r.sent_at)}</span>}
                      </span>
                    </label>
                  </li>
                ))}
                {!visible.length && <li className={styles.empty}>맞는 사람이 없습니다</li>}
              </ul>

              <div className={styles.actions}>
                <Button variant="ghost" size="sm" disabled={!rows.length}
                  onClick={() => setPreviewEmp(pickedRows[0]?.emp ?? visible[0]?.emp ?? rows[0].emp)}>
                  메일 미리보기
                </Button>
                <Button variant="primary" size="sm" loading={mail.isStarting} disabled={locked || !pickedRows.length}
                  onClick={handleSendSelected}>
                  선택한 {pickedRows.length}명에게 보내기
                </Button>
                <Button variant="danger" size="sm" disabled={locked || !allTargets.length || !!allBlocked.length || !mail.data?.sender}
                  onClick={handleSendAll}
                  title={allBlocked.length ? `키 불일치 ${allBlocked.length}명이 있어 전체 보내기를 할 수 없음` : undefined}>
                  {allTargets.length ? `전체 보내기 (안 보낸 ${allTargets.length}명)` : '전체 보내기 — 모두 보냄'}
                </Button>
              </div>
              <span className={styles.muted}>
                전체 보내기는 관리자와 이미 보낸 사람을 빼고 보냅니다. 골라서 보내기는 이미 보낸 사람에게도 다시 갑니다(테스트는 본인 체크).
              </span>
            </>
          )}
        </div>
        </div>
        </div>
      )}
      {previewEmp && (
        <SecretMailPreviewModal rows={rows} initialEmp={previewEmp} sender={mail.data?.sender ?? null}
          onClose={() => setPreviewEmp(null)} />
      )}
    </section>
  );
};

export default SecretMailPanel;
