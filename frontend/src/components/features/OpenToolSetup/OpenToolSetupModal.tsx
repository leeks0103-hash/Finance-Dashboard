import { Button, Modal } from '@/components/ui';
import { useOpenToolViewModel } from '@/hooks/viewmodels/useOpenToolViewModel';
import styles from './OpenToolSetupModal.module.css';

/**
 * 파일 열기 도구 설치 안내(2026-11-06) — 파일·폴더 바로가기가 서버 PC가 아니라 지금 쓰는 PC에서 열리게 하는 작은 프로그램.
 * 브라우저는 웹페이지가 PC 프로그램을 직접 못 열게 막아서 PC마다 한 번 설치가 필요함. 열림 여부는 ui.store가 이 브라우저에만 기억
 */
const OpenToolSetupModal = () => {
  const vm = useOpenToolViewModel();
  if (!vm.modalOpen) return null;

  return (
    <Modal
      title="파일 열기 도구"
      sub={vm.installed ? '이 브라우저에는 설치된 것으로 표시돼 있습니다' : '처음 한 번만 설치하면 됩니다'}
      onClose={vm.closeModal}
      width={560}
    >
      <p className={styles.lead}>
        파일·폴더 바로가기(↗)를 누르면 <strong>지금 쓰고 있는 내 PC</strong>에서 NAS의 원본 보고서(PPT)가 열리게 해 주는
        작은 프로그램입니다. 브라우저는 보안상 PC 프로그램을 직접 열 수 없어서 PC마다 한 번 설치해야 합니다.
      </p>

      <ol className={styles.steps}>
        <li>
          <div>설치 파일을 받습니다.</div>
          <Button variant="primary" size="sm" onClick={vm.download}>↓ 설치 파일 받기 (HmcOpen.zip)</Button>
        </li>
        <li>
          압축을 풀고 <code>install.bat</code>을 더블클릭하세요.
          <span className={styles.hint}>“Windows의 PC 보호” 창이 뜨면 [추가 정보] → [실행]. 관리자 권한은 필요 없습니다.</span>
        </li>
        <li>
          “설치가 끝났습니다”가 나오면 완료 — 대시보드가 다시 열리며 바로가기 버튼이 나타납니다.
          <span className={styles.hint}>처음 파일을 열 때 브라우저가 “열도록 허용할까요?”라고 물으면 <strong>항상 허용</strong>을 선택하세요.</span>
        </li>
      </ol>

      <p className={styles.note}>
        NAS(<code>\\10.206.32.3\기술교육팀</code>)에 내 계정으로 접근할 수 있어야 파일이 열립니다. 설치 후에도 열리지 않으면
        탐색기에서 NAS 폴더를 먼저 열어 보세요. 제거는 압축 푼 폴더의 <code>uninstall.bat</code>.
      </p>

      <div className={styles.status}>
        {vm.installed ? (
          <>
            <span className={styles.ok}>✓ 이 브라우저: 설치됨으로 표시</span>
            <Button variant="ghost" size="sm" onClick={vm.clearInstalled}>표시 해제</Button>
          </>
        ) : (
          <>
            <span className={styles.muted}>다른 브라우저에서 설치했거나 이미 설치했나요?</span>
            <Button variant="ghost" size="sm" onClick={() => { vm.markInstalled(); vm.closeModal(); }}>이미 설치했어요</Button>
          </>
        )}
      </div>
    </Modal>
  );
};

export default OpenToolSetupModal;
