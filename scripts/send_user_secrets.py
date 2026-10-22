"""
임직원에게 대시보드 로그인 시크릿 키를 Outlook으로 한 사람씩 보내기(2026-10-22) — CLI·bat용.
같은 일을 대시보드 관리자 기능 > 시크릿 키 메일에서도 할 수 있음. 규칙은 secret_mail.py 한 곳(제목·대상·기록).

명단: 회사 사용자 목록(현대엔지비사용자목록_*.xlsx — 사용자명·사원번호·EMAIL·시크릿키)
대상: 기본 = 관리자(.env ADMIN_ACCOUNTS + secret_mail.SENDER_IDS)를 뺀 전원 / --only 사번1,사번2 = 그 사람만
메일: 한 사람씩 차례로, 받는 사람 칸에 본인 한 명(참조·숨은참조 없음), 본문은 시크릿 키만
보내는 계정: 이 PC Outlook 기본 계정. --from 메일주소로 고름(그 Outlook에 등록된 계정만)

사용(단계별로):
  python scripts/send_user_secrets.py "<엑셀>"                  # 미리보기만(키 가림, 아무것도 안 만듦)
  python scripts/send_user_secrets.py "<엑셀>" --draft          # Outlook 임시보관함에 초안
  python scripts/send_user_secrets.py "<엑셀>" --send           # 실제 발송
  --only 1234567,7654321  지정한 사번만 / --resend  이미 보낸 사람도 다시
  --from leeks38@hyundai-ngv.com  보내는 계정 지정
  python scripts/send_user_secrets.py --menu                    # 번호 메뉴(send_user_secrets.bat)

보낸 기록(사번·시각만, 키 없음)은 data/secret_mail_sent.json — 다시 돌리면 보낸 사람은 건너뜀.
.env USER_ACCOUNTS의 비밀번호와 엑셀 시크릿키가 다르면 멈춤(로그인 안 되는 키를 보내지 않게).
"""
import io
import os
import sys
import time

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import secret_mail as sm  # noqa: E402


def _arg(name: str):
    if name in sys.argv:
        i = sys.argv.index(name)
        if i + 1 < len(sys.argv):
            return sys.argv[i + 1]
        sys.exit(f"[중단] {name} 뒤에 값이 필요합니다")
    return None


def menu():
    """send_user_secrets.bat에서 부름 — 번호 고르면 아래 단계들을 그대로 실행"""
    path = sm.latest_roster_path()
    if not path:
        print("[중단] data/사용자 목록/ 에 현대엔지비사용자목록_*.xlsx 가 없습니다.")
        return
    me = sys.argv[0]

    def run(*args):
        sys.argv = [me, path, *args]
        try:
            main()
        except SystemExit as e:
            if e.code not in (None, 0):
                print(e.code)

    while True:
        print("\n==========================================")
        print(" 대시보드 시크릿 키 메일")
        print(f" 명단: {os.path.relpath(path, sm.ROOT)}")
        print("==========================================")
        print(" 1. 미리보기 (누구에게 갈지, 키 가림)")
        print(" 2. 지정한 사번에게 보내기 (여러 명은 쉼표, 테스트는 내 사번)")
        print(" 3. 임시보관함 초안만 만들기")
        print(" 4. 전체 발송 (관리자 제외, 이미 보낸 사람 건너뜀)")
        print(" 0. 끝내기")
        sel = input("번호: ").strip()
        if sel == "1":
            run()
        elif sel == "2":
            emp = input("사번 (예: 2001702,2001703): ").replace(" ", "").strip(",")
            if emp:
                run("--only", emp, "--send", "--resend")
        elif sel == "3":
            run("--draft")
        elif sel == "4":
            run()
            if input("\n위 사람들에게 실제로 보냅니다. 보내려면 YES 입력: ").strip().upper() == "YES":
                run("--send")
            else:
                print("취소했습니다.")
        elif sel == "0":
            return
        else:
            print(f"'{sel}'는 없는 번호예요. 0~4 중에 고르세요(특정 사람은 2를 누른 뒤 사번).")


def main():
    if len(sys.argv) < 2 or sys.argv[1].startswith("--"):
        sys.exit(__doc__)
    path = sys.argv[1]
    draft, send, resend = "--draft" in sys.argv, "--send" in sys.argv, "--resend" in sys.argv
    if draft and send:
        sys.exit("[중단] --draft와 --send는 하나만")
    only, sender = _arg("--only"), _arg("--from")

    try:
        roster = sm.read_roster(path)
    except sm.RosterError as e:
        sys.exit(f"[중단] {e}")

    if only:
        want = [s.strip() for s in only.split(",") if s.strip()]
        by_emp = {r["emp"]: r for r in roster}
        missing = [e for e in want if e not in by_emp]
        if missing:
            sys.exit(f"[중단] 명단에 없는 사번: {', '.join(missing)}")
        targets = [by_emp[e] for e in dict.fromkeys(want)]
    else:
        excl = sm.excluded_ids()
        targets = [r for r in roster if r["emp"] not in excl]

    bad = [r["emp"] for r in targets if r["emp"] in sm.key_mismatch(roster)]
    if bad:
        sys.exit("[중단] .env USER_ACCOUNTS와 시크릿키가 다르거나 계정이 없음: " + ", ".join(bad)
                 + "\n  → scripts/fill_user_accounts.py로 .env를 먼저 맞추고 Flask 재시작")

    sent = sm.load_sent()
    skip = [r for r in targets if r["emp"] in sent and not resend]
    todo = [r for r in targets if r not in skip]

    print(f"제목: {sm.SUBJECT}")
    print(f"명단 {len(roster)}명 / 대상 {len(targets)}명 / 이미 보내서 건너뜀 {len(skip)}명 / 이번 {len(todo)}명")
    for r in todo:
        print(f"  {r['emp']}  {r['name'] or '-':<6}  {r['mail']}  키 {r['key'][:2]}****")
    if not (draft or send):
        print("\n미리보기만 했습니다. 초안은 --draft, 실제 발송은 --send")
        return
    if not todo:
        return

    import pythoncom
    pythoncom.CoInitialize()
    outlook = sm.outlook_app()
    accounts = [outlook.Session.Accounts.Item(i) for i in range(1, outlook.Session.Accounts.Count + 1)]
    account = None
    if sender:
        account = next((a for a in accounts if a.SmtpAddress.lower() == sender.lower()), None)
        if account is None:
            sys.exit(f"[중단] 이 PC Outlook에 {sender} 계정이 없습니다. 등록된 계정: "
                     + ", ".join(a.SmtpAddress for a in accounts))
    print(f"보내는 계정: {account.SmtpAddress if account else sm.default_account(outlook)}")

    done, failed = 0, []
    for i, r in enumerate(todo):
        try:
            sm.send_one(outlook, r, account=account, draft=draft)
            if send:
                sm.mark_sent(r["emp"])   # 한 통마다 저장 — 중간에 끊겨도 보낸 사람은 남음
            done += 1
            print(f"  {'보냄' if send else '초안'} {done}/{len(todo)}  {r['emp']} {r['mail']}")
        except Exception as e:  # noqa: BLE001 — 한 사람 실패로 나머지를 멈추지 않음
            failed.append(f"{r['emp']} {r['mail']}: {e}")
        if send and i < len(todo) - 1:
            time.sleep(sm.SEND_INTERVAL_SEC)   # 한 사람씩 차례로

    print(f"\n{'발송' if send else '초안 저장'} {done}건" + (f" / 실패 {len(failed)}건" if failed else ""))
    for f in failed:
        print("  실패", f)


if __name__ == "__main__":
    menu() if sys.argv[1:] == ["--menu"] else main()
