/** 관리자 기능 > 시크릿 키 메일(2026-10-22) — 서버 secret_mail.py. 시크릿 키 자체는 응답에 없음 */
export interface SecretMailRow {
  emp: string;
  name: string;
  mail: string;
  /** 관리자·발송 담당 — 전체 보내기에서 빠짐(골라서는 보낼 수 있음) */
  excluded: boolean;
  /** .env 로그인 비밀번호와 엑셀 시크릿키가 같음 — 다르면 못 보냄 */
  key_ok: boolean;
  /** 마지막으로 보낸 시각(YYYY-MM-DD HH:MM:SS), 안 보냈으면 null */
  sent_at: string | null;
}

export interface SecretMailJob {
  running: boolean;
  total?: number;
  done?: number;
  sent?: { emp: string; at: string }[];
  failed?: { emp: string; name: string; mail: string; error: string }[];
  current?: string | null;
  cancelled?: boolean;
  error?: string | null;
  mode?: 'all' | 'selected';
  started_by?: string;
  started_at?: string;
  finished_at?: string | null;
}

export interface SecretMailRoster {
  ok: boolean;
  error?: string;
  file: string | null;
  subject: string;
  /** 이 서버 PC Outlook 기본 계정 = 보내는 사람 */
  sender: string | null;
  sender_error: string | null;
  rows: SecretMailRow[];
  job: SecretMailJob;
}

export type SecretMailSendBody = { mode: 'all' } | { mode: 'selected'; emps: string[] };

/** 미리보기 — 보내기와 같은 함수(secret_mail.build_message)로 만든 메일, 키만 가림 */
export interface SecretMailPreview {
  ok: boolean;
  emp: string;
  name: string;
  message: { to: string; cc: string; bcc: string; subject: string; body: string };
  /** 실제 키 글자 수 — 가린 글자 수와 다를 수 있어 따로 */
  key_length: number;
}

/** 명단 엑셀 vs .env 일반 회원 대조(읽기만) — 반영은 command를 터미널에서 직접 + Flask 재시작 */
export interface SecretMailAccountDiff {
  ok: boolean;
  error?: string;
  file?: string;
  added: { emp: string; name: string }[];
  removed: { emp: string; name: string }[];
  key_changed: { emp: string; name: string }[];
  /** 지금 .env 일반 회원 수 */
  users: number;
  command: string;
  checked_at: string;
}
