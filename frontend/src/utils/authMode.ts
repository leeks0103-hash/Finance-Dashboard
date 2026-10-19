/**
 * 들어가자마자 로그인(2026-10-13)을 켤지. 2026-10-14 — 내일부터 쓰기로 해서 잠깐 꺼 둠(누구나 조회).
 * 다시 켤 때: 이 값을 true로 + 백엔드 app.py의 `app.before_request(login_required_for_api)` 주석 해제.
 * 꺼져 있어도 관리자 기능은 그대로 — ⚙ > 관리자 기능 창에서 관리자 계정으로 로그인
 */
// export const LOGIN_REQUIRED = true;   // 2026-10-15 다시 켬
export const LOGIN_REQUIRED = false;  // 2026-10-19 회의용으로 잠깐 끔 — 다시 켤 땐 위 줄 + app.py before_request 주석 해제
