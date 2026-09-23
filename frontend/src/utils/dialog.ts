// ⚠️ utils/ 레이어 규칙(순수 함수·사이드이펙트 없음)의 의도적 예외 — window.confirm/alert/prompt를
// 대체하는 UI 다이얼로그라 그 자체가 사이드이펙트다. hooks/(useOpenFile 등)부터 features/layouts까지
// 전부 호출해야 해서 레이어 체인상 가장 앞쪽(hooks보다 왼쪽)인 여기 두는 게 유일하게 역방향 의존
// 없이 모두가 쓸 수 있는 위치 — components/ui/에 두면 hooks/ → ui/ 역방향 참조가 됨(2026-09-23).
import Swal from 'sweetalert2';
import styles from './dialog.module.css';

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
