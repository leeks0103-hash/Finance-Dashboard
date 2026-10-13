import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Particles, ParticlesProvider } from '@tsparticles/react';
import { loadSlim } from '@tsparticles/slim';
import type { Engine, ISourceOptions } from '@tsparticles/engine';
import { Button, NgvLogo } from '@/components/ui';
import { useThemeStore } from '@/store/theme.store';
import styles from './LoginScreen.module.css';

interface Props {
  /** 맞으면 true — 그 순간 뒤에서 대시보드가 그려지기 시작하고, 이 화면은 걷힌 뒤 onDone */
  onLogin: (empNo: string, password: string) => Promise<boolean>;
  onDone: () => void;
}

const FADE_MS = 500;   // 로그인 성공 → 화면이 걷히는 시간

const reducedMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
const initEngine = (engine: Engine) => loadSlim(engine);

// 배경 — 현대 남색·주황 점 몇 개가 천천히 떠다니다 가까우면 옅은 선으로 이어짐, 마우스를 가져가면 선이 따라옴(수수하게)
const particleOptions = (dark: boolean): ISourceOptions => ({
  fullScreen: { enable: false },
  fpsLimit: 60,
  detectRetina: true,
  background: { color: { value: 'transparent' } },
  particles: {
    number: { value: 46, density: { enable: true } },
    // v4는 점 색이 paint.fill (예전 color는 무시되고 흰색으로 그려짐)
    paint: { fill: { enable: true, color: { value: dark ? ['#00AAD2', '#FA9D1C', '#AACAE6'] : ['#002C5F', '#FA9D1C', '#00AAD2'] } } },
    opacity: { value: { min: 0.25, max: 0.6 } },
    size: { value: { min: 1.5, max: 3.5 } },
    links: { enable: true, distance: 150, color: dark ? '#AACAE6' : '#002C5F', opacity: dark ? 0.18 : 0.12, width: 1 },
    move: { enable: true, speed: 0.6, outModes: { default: 'bounce' } },
  },
  interactivity: {
    events: { onHover: { enable: true, mode: 'grab' } },
    modes: { grab: { distance: 170, links: { opacity: dark ? 0.4 : 0.3 } } },
  },
});

/**
 * 로그인 화면(2026-10-13) — 흰 화면에 로그인 창 + 은은한 입자 배경(tsParticles).
 * 처음엔 대시보드를 모자이크로 깔았다가 "요란하다"로 걷어냄. 로그인 전엔 실제 데이터를 한 줄도 안 받음.
 */
const LoginScreen = ({ onLogin, onDone }: Props) => {
  const theme = useThemeStore(s => s.theme);
  const [empNo, setEmpNo]       = useState('');
  const [password, setPassword] = useState('');
  const [error, setError]       = useState('');
  const [busy, setBusy]         = useState(false);
  const [leaving, setLeaving]   = useState(false);
  const options = useMemo(() => particleOptions(theme === 'dark'), [theme]);
  const motion = useMemo(() => !reducedMotion(), []);

  // 로그인 성공 → 화면이 걷힌 뒤 끝
  useEffect(() => {
    if (!leaving) return;
    const t = window.setTimeout(onDone, motion ? FADE_MS : 0);
    return () => window.clearTimeout(t);
  }, [leaving, onDone, motion]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!empNo.trim() || !password || busy) return;
    setBusy(true);
    setError('');
    const ok = await onLogin(empNo.trim(), password);
    setBusy(false);
    if (ok) setLeaving(true);
    else { setError('사번 또는 비밀번호가 올바르지 않습니다'); setPassword(''); }
  };

  return (
    <div className={`${styles.root} ${leaving ? styles.leaving : ''}`}>
      {/* 움직임 줄이기 설정이면 입자 없이 흰 화면만 */}
      {motion && (
        <ParticlesProvider init={initEngine}>
          <Particles key={theme} id="login-particles" className={styles.particles} options={options} />
        </ParticlesProvider>
      )}

      <form className={styles.card} onSubmit={handleSubmit}>
        <NgvLogo className={styles.logo} />
        <h1 className={styles.title}>경영현황 통합 대시보드</h1>
        <p className={styles.sub}>사번과 비밀번호로 로그인하세요</p>

        <input className={styles.input} placeholder="사번" autoComplete="username" inputMode="numeric" autoFocus
          value={empNo} onChange={e => setEmpNo(e.target.value)} disabled={busy || leaving} />
        <input className={styles.input} placeholder="비밀번호" type="password" autoComplete="current-password"
          value={password} onChange={e => setPassword(e.target.value)} disabled={busy || leaving} />
        <Button type="submit" variant="primary" size="md" className={styles.submit}
          loading={busy} disabled={!empNo.trim() || !password || leaving}>
          로그인
        </Button>
        <p className={styles.error} role="alert">{error}</p>
        <p className={styles.hint}>한 번 로그인하면 이 브라우저에선 로그아웃 전까지 유지됩니다</p>
      </form>
    </div>
  );
};

export default LoginScreen;
