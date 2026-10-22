import client from './client';
import type { SecretMailAccountDiff, SecretMailJob, SecretMailPreview, SecretMailRoster, SecretMailSendBody } from '@/types/secretMail.types';

/** 관리자 — 명단·보낸 기록·보내는 계정(Outlook 확인이 있어 조금 걸릴 수 있음) */
export const getSecretMailRoster = (): Promise<SecretMailRoster> =>
  client.get('/secret-mail', { timeout: 60_000 }).then(r => r.data);

/** 관리자 — 보내기 시작(서버가 한 사람씩 차례로 보냄) */
export const startSecretMail = (body: SecretMailSendBody): Promise<{ ok: boolean; job: SecretMailJob }> =>
  client.post('/secret-mail/send', body).then(r => r.data);

export const getSecretMailStatus = (): Promise<{ ok: boolean; job: SecretMailJob }> =>
  client.get('/secret-mail/status').then(r => r.data);

/** 관리자 — 지금 보내는 한 통은 끝내고 멈춤 */
export const cancelSecretMail = (): Promise<{ ok: boolean; job: SecretMailJob }> =>
  client.post('/secret-mail/cancel').then(r => r.data);

/** 관리자 — 그 사람에게 갈 메일 그대로(키만 가림) */
export const getSecretMailPreview = (emp: string): Promise<SecretMailPreview> =>
  client.get('/secret-mail/preview', { params: { emp } }).then(r => r.data);

/** 관리자 — 명단 엑셀 vs .env 일반 회원(읽기만, .env는 안 고침) */
export const getSecretMailAccountDiff = (): Promise<SecretMailAccountDiff> =>
  client.get('/secret-mail/account-diff').then(r => r.data);
