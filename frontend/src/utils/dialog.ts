// ⚠️ utils/ 레이어 규칙(순수 함수·사이드이펙트 없음)의 의도적 예외 — window.confirm/alert/prompt를
// 대체하는 UI 다이얼로그라 그 자체가 사이드이펙트다. hooks/(useOpenFile 등)부터 features/layouts까지
// 전부 호출해야 해서 레이어 체인상 가장 앞쪽(hooks보다 왼쪽)인 여기 두는 게 유일하게 역방향 의존
// 없이 모두가 쓸 수 있는 위치 — components/ui/에 두면 hooks/ → ui/ 역방향 참조가 됨(2026-09-23).
import SwalBase from 'sweetalert2';
import styles from './dialog.module.css';

// 다이얼로그 열 때 화면이 옆으로 밀리고 다시 그려지던(reflow/repaint) 문제 — SweetAlert2 기본값 두 개가 원인:
//  · scrollbarPadding: body에 스크롤바 폭만큼 padding-right를 더함. 그런데 index.css의
//    `html { scrollbar-gutter: stable }`가 이미 그 자리를 예약해 둬서 이중 보정 → 헤더·본문이 옆으로 밀림
//    (useScrollLock에서 같은 이유로 보정을 뺀 것과 동일, 2026-09-17)
//  · heightAuto: html/body에 height:auto !important 클래스를 붙였다 뗌 → 페이지 전체 재배치
// 모든 confirm/alert/prompt/toast가 이 인스턴스를 쓰도록 mixin으로 한 곳에서 끔(2026-09-28)
const Swal = SwalBase.mixin({ scrollbarPadding: false, heightAuto: false });

const customClass = {
  popup:         styles.popup,
  title:         styles.title,
  htmlContainer: styles.text,
  actions:       styles.actions,
  cancelButton:  styles.cancelBtn,
  backdrop:      styles.backdrop,
};

interface ConfirmOptions {
  title?:       string;
  /** true면 확인 버튼이 danger 색 — 초기화처럼 되돌리기 어려운 작업에 사용 */
  danger?:      boolean;
  confirmText?: string;
  cancelText?:  string;
}

/**
 * window.confirm 대체 — 사이트 톤(HyundaiSans·브랜드 색·radius)에 맞춘 확인 다이얼로그.
 * 메시지의 줄바꿈(\n)은 그대로 유지됨(white-space: pre-line).
 */
export const confirmDialog = async (message: string, opts: ConfirmOptions = {}): Promise<boolean> => {
  const res = await Swal.fire({
    title: opts.title,
    text: message,
    icon: opts.danger ? 'warning' : 'question',
    showCancelButton: true,
    confirmButtonText: opts.confirmText ?? '확인',
    cancelButtonText: opts.cancelText ?? '취소',
    reverseButtons: true,
    focusCancel: opts.danger,
    buttonsStyling: false,
    customClass: { ...customClass, confirmButton: opts.danger ? styles.confirmDanger : styles.confirmBtn },
  });
  return res.isConfirmed;
};

interface AlertOptions {
  title?: string;
  /** true면 오류 아이콘/색으로 표시 */
  error?: boolean;
}

/** window.alert 대체 — 사이트 톤에 맞춘 알림 다이얼로그. */
export const alertDialog = async (message: string, opts: AlertOptions = {}): Promise<void> => {
  await Swal.fire({
    title: opts.title ?? (opts.error ? '오류' : '알림'),
    text: message,
    icon: opts.error ? 'error' : 'info',
    confirmButtonText: '확인',
    buttonsStyling: false,
    customClass: { ...customClass, confirmButton: opts.error ? styles.confirmDanger : styles.confirmBtn },
  });
};

interface PromptOptions {
  title?:        string;
  placeholder?:  string;
  confirmText?:  string;
  cancelText?:   string;
  inputValue?:   string;
}

/** window.prompt 대체 — 취소/빈 입력 시 null. */
export const promptDialog = async (message: string, opts: PromptOptions = {}): Promise<string | null> => {
  const res = await Swal.fire({
    title: opts.title ?? message,
    input: 'text',
    inputPlaceholder: opts.placeholder,
    inputValue: opts.inputValue,
    showCancelButton: true,
    confirmButtonText: opts.confirmText ?? '확인',
    cancelButtonText: opts.cancelText ?? '취소',
    reverseButtons: true,
    buttonsStyling: false,
    customClass: { ...customClass, confirmButton: styles.confirmBtn, input: styles.input },
  });
  if (!res.isConfirmed) return null;
  const value = String(res.value ?? '').trim();
  return value || null;
};

interface ToastOptions {
  /** true면 오류 아이콘으로 표시 */
  error?: boolean;
}

/**
 * 우측 하단 토스트 — 확인 버튼 없이 3초 뒤 사라짐. 백그라운드 작업(AI 분석 등) 완료 알림용.
 * SweetAlert2는 한 번에 팝업 1개만 띄울 수 있어서, 확인/알림 다이얼로그가 열려 있을 땐 토스트를
 * 생략한다 — 그대로 띄우면 열린 다이얼로그가 닫히며 confirmDialog가 "취소"로 resolve됨
 */
export const toast = (message: string, opts: ToastOptions = {}): void => {
  if (Swal.isVisible() && !Swal.getPopup()?.classList.contains('swal2-toast')) return;
  // 토스트는 스크롤 잠금·height 조정을 안 하는 데다 heightAuto를 넘기면 호환 안 되는 옵션이라고
  // 콘솔 경고가 떠서 mixin 말고 원본 인스턴스로
  void SwalBase.fire({
    toast: true,
    position: 'bottom-end',
    icon: opts.error ? 'error' : 'success',
    title: message,
    showConfirmButton: false,
    timer: 3000,
    timerProgressBar: true,
    customClass: { popup: styles.toast, title: styles.toastTitle },
  });
};
