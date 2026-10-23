import { Button, Toggle } from '@/components/ui';
import { useAdminSettingsViewModel, VISIBILITY_ITEMS } from '@/hooks/viewmodels/useAdminSettingsViewModel';
import styles from './AdminSections.module.css';

/**
 * 관리자 페이지 > 화면 설정 — 공개 범위 네 개 + 로그인 요구 + AI 인사이트(예전 AdminModal 위쪽, 2026-10-23 페이지로).
 * 바꾸면 서버(data/*.json)에 저장돼 접속한 모든 사람 화면에 적용
 */
const AdminSettingsSection = () => {
  const vm = useAdminSettingsViewModel();

  return (
    <div className={styles.groups}>
      {/* 공개 범위 네 개는 한 줄에 — 모두 짧은 세그먼트라. 바꾸면 모든 사람 화면에 적용 */}
      <div className={styles.twoCol}>
        {VISIBILITY_ITEMS.map(item => (
          <section key={item.key} className={styles.group}>
            <span className={styles.label}>{item.label}</span>
            <div className={styles.segment}>
              {item.options.map(o => (
                <Button key={o.value} variant="ghost" size="sm"
                  className={`${styles.segBtn} ${vm.visibilityValues[item.key] === o.value ? styles.segActive : ''}`}
                  onClick={() => vm.setVisibility(item.key, o.value)}
                  title={o.title}
                >{o.label}</Button>
              ))}
            </div>
          </section>
        ))}
      </div>

      {/* 로그인 요구 — 코드 주석 대신 여기서 켜고 끔(2026-10-22). 서버 data/access.json 저장 → 모든 접속자에게 적용.
          끄면 로그인 화면 없이 누구나 조회(관리자 전용 기능은 그대로 관리자 로그인 필요) */}
      <section className={`${styles.group} ${styles.toggleGroup}`}>
        <div className={styles.toggleText}>
          <span className={styles.label}>로그인 요구</span>
          <span className={styles.toggleDesc}>
            {vm.loginRequired
              ? '접속하면 먼저 로그인(사번·시크릿 키) 화면이 뜹니다'
              : '끔 — 로그인 없이 누구나 조회할 수 있습니다(관리자 기능은 관리자 로그인 필요)'}
          </span>
        </div>
        <Toggle checked={vm.loginRequired} onChange={vm.toggleLoginRequired} />
      </section>
      {vm.loginRequiredError && <span className={styles.error}>로그인 설정을 저장하지 못했습니다 — 다시 눌러 주세요</span>}

      {/* 기능 켜기·끄기 — 주석 풀지 않고 여기서(2026-10-20 요청). 켬 = 모두에게 보임 */}
      <section className={`${styles.group} ${styles.toggleGroup}`}>
        <div className={styles.toggleText}>
          <span className={styles.label}>AI 인사이트</span>
          <span className={styles.toggleDesc}>재무·KPI 탭 위쪽 'AI 인사이트' 버튼(H-chat 요약)을 모든 사람에게 보이기</span>
        </div>
        {/* 트랙 안 켬/끔 글자 뺌(2026-10-21 요청) */}
        <Toggle checked={vm.aiInsightOn} onChange={vm.toggleAiInsight} />
      </section>
      <span className={styles.hint}>
        {vm.visibilityError
          ? <span className={styles.error}>공개 범위를 저장하지 못했습니다 — 다시 눌러 주세요</span>
          : '공개 범위는 이 화면뿐 아니라 접속한 모든 사람에게 적용됩니다(다른 화면엔 1분 안에 반영)'}
      </span>
    </div>
  );
};

export default AdminSettingsSection;
