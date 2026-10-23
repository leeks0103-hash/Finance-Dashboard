import { useState, type FormEvent } from 'react';
import { Button } from '@/components/ui';
import { useExtractJob } from '@/hooks/useExtractJob';
import styles from './AdminSections.module.css';

/**
 * 관리자 로그인 폼 — 로그인 요구가 꺼져 있어 로그인 화면이 없을 때 관리자 페이지가 보여주는 유일한 관리자 로그인 입구
 * (예전엔 AdminModal 안 분기, 2026-10-23 페이지로). 사번·비밀번호 로그인(2026-10-06), 틀리면 인라인 에러텍스트
 */
const AdminLogin = () => {
  const extractJob = useExtractJob();
  const [empNo, setEmpNo] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleLogin = async (e: FormEvent) => {
    e.preventDefault();
    if (!empNo.trim() || !password) { setError('사번과 비밀번호를 입력하세요'); return; }
    const ok = await extractJob.authenticate({ empNo: empNo.trim(), password });
    setError(ok ? '' : '사번 또는 비밀번호가 올바르지 않습니다');
    if (ok) setPassword('');
  };

  return (
    <div className={styles.loginWrap}>
      <h1 className={styles.loginTitle}>관리자 기능</h1>
      <span className={styles.hint}>관리자로 등록된 사번만 로그인할 수 있습니다</span>
      <form className={styles.auth} onSubmit={handleLogin}>
        <input className={styles.authInput} placeholder="사번" autoComplete="username" autoFocus
          value={empNo} onChange={e => setEmpNo(e.target.value)} disabled={extractJob.isAuthing} />
        <input className={styles.authInput} placeholder="비밀번호" type="password" autoComplete="current-password"
          value={password} onChange={e => setPassword(e.target.value)} disabled={extractJob.isAuthing} />
        {/* 로그인 중엔 입력칸·버튼 잠금, 사번·비밀번호 둘 다 채워야 버튼 활성(2026-10-06 요청) */}
        <Button type="submit" variant="primary" className={styles.authBtn} loading={extractJob.isAuthing}
          disabled={!empNo.trim() || !password}>
          로그인
        </Button>
        {error && <span className={styles.error}>{error}</span>}
        <span className={styles.hint}>한 번 로그인하면 이 브라우저에선 로그아웃 전까지 유지됩니다</span>
      </form>
    </div>
  );
};

export default AdminLogin;
