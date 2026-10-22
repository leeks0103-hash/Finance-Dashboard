"""
대시보드 로그인 시크릿 키 메일 — 2026-10-22

명단(data/사용자 목록/현대엔지비사용자목록_*.xlsx 중 최신: 사용자명·사원번호·EMAIL·시크릿키)의 사람에게
이 서버 PC Outlook 기본 계정으로 한 사람씩 차례로 보냄. 받는 사람 = 본인 한 명, 참조·숨은참조 없음, 본문 = 접속 주소·ID(사번)·PW(시크릿 키) 안내(BODY_TEMPLATE, 사람마다 변수로 채움).
책임님은 본인 PC에서 서버를 띄워 본인 Outlook으로 보냄(서버 PC 계정이 곧 보내는 사람).

- 화면: 관리자 기능 > 시크릿 키 메일(layouts/Navbar/SecretMailPanel) — 관리자만, 응답에 키는 절대 안 넣음
- CLI: scripts/send_user_secrets.py · send_user_secrets.bat (같은 함수 사용)
- 보낸 기록(사번·시각만): data/secret_mail_sent.json — 전체 보내기는 이미 보낸 사람을 건너뜀
- .env USER_ACCOUNTS 비밀번호와 엑셀 시크릿키가 다른 사람은 못 보냄(받아도 로그인 안 되는 키라)
"""
import glob
import json
import logging
import os
import re
import threading
import time
from datetime import datetime

import openpyxl
from flask import Blueprint, jsonify, request

logger = logging.getLogger(__name__)

ROOT = os.path.dirname(os.path.abspath(__file__))
ENV_PATH = os.path.join(ROOT, ".env")
ROSTER_GLOB = os.path.join(ROOT, "data", "사용자 목록", "현대엔지비사용자목록_*.xlsx")
SENT_PATH = os.path.join(ROOT, "data", "secret_mail_sent.json")

SUBJECT = "경영현황 통합 대시보드 개인별 시크릿키 전달 드립니다."

# 접속 주소 — 서버 PC 주소가 바뀌면 여기만 고침(2026-10-22 템플릿)
DASHBOARD_URL = "10.206.33.120:5188"

# 본문 템플릿 — {url} 접속 주소 · {emp} 받는 사람 사번(ID) · {key} 받는 사람 시크릿 키(PW). 사람마다 값이 달라 변수로 채움.
# 시크릿 키는 이 변수 하나로만 들어가고, 미리보기는 가린 값을 넘김(build_message)
BODY_TEMPLATE = """1. 통합 대시보드 URL : {url}
2. ID : {emp}
3. PW : {key}

사이트 이용중 불편 및 문의 사항은 내선[8020]으로 연락 부탁 드립니다.

감사합니다."""

# 발송 담당(관리자) — 전체 보내기 대상에서 뺌. 비밀번호는 여기 두지 않음
SENDER_IDS = {"9026704", "2016728"}   # 손호성, 이권성 책임

# 한 통 보내고 다음 통까지 쉬는 시간(초) — 한꺼번에 몰아 보내지 않게
SEND_INTERVAL_SEC = 1.0

_EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
_sent_lock = threading.Lock()


class RosterError(Exception):
    pass


def _cell(v) -> str:
    if v is None:
        return ""
    if isinstance(v, float) and v.is_integer():
        v = int(v)
    return str(v).strip()


def latest_roster_path() -> "str | None":
    paths = sorted(glob.glob(ROSTER_GLOB))
    return paths[-1] if paths else None   # 파일명 날짜(_yymmdd) 최신


def read_roster(path: str) -> list[dict]:
    """[{emp, name, mail, key}] — 형식 오류가 하나라도 있으면 RosterError(전부 보여 줌)"""
    wb = openpyxl.load_workbook(path, read_only=True, data_only=True)
    rows = list(wb.worksheets[0].iter_rows(values_only=True))
    head = [_cell(h) for h in rows[0]]

    def col(*names):
        return next((head.index(n) for n in names if n in head), None)
    i_emp, i_key = col("사번", "사원번호"), col("비밀번호", "시크릿키")
    i_mail, i_name = col("EMAIL", "이메일", "메일"), col("이름", "사용자명")
    if None in (i_emp, i_key, i_mail):
        raise RosterError(f"머리글에 사원번호·시크릿키·EMAIL 열이 있어야 합니다. 지금 머리글: {head}")

    out, seen, errors = [], set(), []
    for n, r in enumerate(rows[1:], start=2):
        emp, key, mail = _cell(r[i_emp]), _cell(r[i_key]), _cell(r[i_mail])
        name = _cell(r[i_name]) if i_name is not None else ""
        if not (emp or key or mail):
            continue
        if not emp or not key:
            errors.append(f"{n}행: 사번 또는 시크릿키 빈 값")
        elif not _EMAIL_RE.match(mail):
            errors.append(f"{n}행: 사번 {emp} 이메일이 비었거나 형식이 이상함({mail!r})")
        elif emp in seen:
            errors.append(f"{n}행: 사번 {emp} 중복")
        else:
            seen.add(emp)
            out.append({"emp": emp, "name": name, "mail": mail, "key": key})
    if errors:
        raise RosterError("명단 오류 — " + " / ".join(errors))
    return out


def env_accounts(key: str) -> dict[str, str]:
    """.env KEY="사번:비밀번호[:이름],…" → {사번: 비밀번호}"""
    try:
        with open(ENV_PATH, encoding="utf-8") as f:
            lines = f.read().splitlines()
    except FileNotFoundError:
        return {}
    for line in lines:
        if line.startswith(key + "="):
            v = line.split("=", 1)[1].strip().strip('"').strip("'")
            parts = [p.strip().split(":") for p in v.split(",") if p.strip()]
            return {p[0].strip(): (p[1].strip() if len(p) > 1 else "") for p in parts}
    return {}


def excluded_ids() -> set[str]:
    """전체 보내기에서 빼는 사번 — 관리자(.env) + 발송 담당"""
    return set(env_accounts("ADMIN_ACCOUNTS")) | SENDER_IDS


def key_mismatch(roster: list[dict]) -> set[str]:
    """엑셀 시크릿키가 .env 로그인 비밀번호와 다르거나 계정이 없는 사번(관리자는 대조 안 함 — 일반 회원 계정이 아님)"""
    users, admins = env_accounts("USER_ACCOUNTS"), excluded_ids()
    return {r["emp"] for r in roster if r["emp"] not in admins and users.get(r["emp"]) != r["key"]}


def load_sent() -> dict:
    try:
        with open(SENT_PATH, encoding="utf-8") as f:
            data = json.load(f)
            return data if isinstance(data, dict) else {}
    except (FileNotFoundError, json.JSONDecodeError):
        return {}


def mark_sent(emp: str) -> str:
    at = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    with _sent_lock:
        sent = load_sent()
        sent[emp] = at
        os.makedirs(os.path.dirname(SENT_PATH), exist_ok=True)
        tmp = SENT_PATH + ".tmp"
        with open(tmp, "w", encoding="utf-8") as f:
            json.dump(sent, f, ensure_ascii=False, indent=2)
        os.replace(tmp, SENT_PATH)
    return at


# ── 명단 ↔ .env 일반 회원 대조(읽기만, 2026-10-22) ──────────
# 명단 보기를 누를 때 엑셀(최신 명단)과 .env USER_ACCOUNTS가 어떻게 다른지 보여 주기만 함 — .env는 안 고침.
# 반영은 사람이 직접 scripts/fill_user_accounts.py --apply + Flask 재시작(계정 정보를 화면 버튼으로 바꾸지 않음).
# 기준은 그 스크립트와 같음: 명단 = 일반 회원 전체, ADMIN_ACCOUNTS 사번만 뺌

def account_diff(roster: list[dict]) -> dict:
    """{added, removed, key_changed} — 사번·이름만(키 없음)"""
    users, admins = env_accounts("USER_ACCOUNTS"), set(env_accounts("ADMIN_ACCOUNTS"))
    want = {r["emp"]: r for r in roster if r["emp"] not in admins}
    return {
        "added": [{"emp": e, "name": r["name"]} for e, r in want.items() if e not in users],
        "removed": [{"emp": e, "name": ""} for e in users if e not in want],
        "key_changed": [{"emp": e, "name": r["name"]} for e, r in want.items()
                        if e in users and users[e] != r["key"]],
        "users": len(users),
    }


def apply_command(path: str) -> str:
    """반영할 때 터미널에 칠 명령 — 지금 .env가 이름 없이 사번:키라 --no-name"""
    return f'python scripts/fill_user_accounts.py "{os.path.relpath(path, ROOT).replace(os.sep, "/")}" --no-name --apply'


# ── Outlook ─────────────────────────────────────────────────

def outlook_app():
    """현재 스레드에서 Outlook 연결 — 호출 전에 pythoncom.CoInitialize() 필요"""
    import win32com.client
    return win32com.client.Dispatch("Outlook.Application")


def default_account(outlook) -> "str | None":
    """보내는 계정(기본 계정 = 기본 저장소의 계정) 메일 주소"""
    accounts = [outlook.Session.Accounts.Item(i) for i in range(1, outlook.Session.Accounts.Count + 1)]
    if not accounts:
        return None
    try:
        store_id = outlook.Session.DefaultStore.StoreID
        for a in accounts:
            if a.DeliveryStore.StoreID == store_id:
                return a.SmtpAddress
    except Exception:  # noqa: BLE001 — 계정 판별 실패 시 첫 계정
        pass
    return accounts[0].SmtpAddress


def mask_key(key: str) -> str:
    """미리보기용 — 앞 2자만 보이고 나머지는 *"""
    return key[:2] + "*" * max(len(key) - 2, 4)


def build_message(person: dict, key: "str | None" = None) -> dict:
    """한 사람에게 갈 메일 — 보내기와 미리보기가 같이 씀(템플릿은 SUBJECT·BODY_TEMPLATE).
    key를 주면 그 값으로(미리보기는 가린 키), 없으면 실제 키. ID는 그 사람 사번"""
    return {
        "to": person["mail"],
        "cc": "",
        "bcc": "",
        "subject": SUBJECT,
        "body": BODY_TEMPLATE.format(url=DASHBOARD_URL, emp=person["emp"], key=person["key"] if key is None else key),
    }


def send_one(outlook, person: dict, account=None, draft: bool = False) -> None:
    """한 사람에게 한 통 — 받는 사람 본인만, 참조·숨은참조 비움(build_message 그대로)"""
    msg = build_message(person)
    m = outlook.CreateItem(0)   # olMailItem
    m.To = msg["to"]
    m.CC = msg["cc"]
    m.BCC = msg["bcc"]
    m.Subject = msg["subject"]
    m.Body = msg["body"]
    if account is not None:
        m.SendUsingAccount = account
    if draft:
        m.Save()    # 임시보관함
    else:
        m.Send()


# ── 화면용 API(관리자) ───────────────────────────────────────

secret_mail_bp = Blueprint("secret_mail", __name__)

_job_lock = threading.Lock()
_job: dict = {"running": False}


def _job_view() -> dict:
    with _job_lock:
        return {k: v for k, v in _job.items()}


def _run_job(people: list[dict]):
    import pythoncom
    pythoncom.CoInitialize()
    try:
        outlook = outlook_app()
        for i, p in enumerate(people):
            with _job_lock:
                if _job.get("cancel"):
                    _job["cancelled"] = True
                    break
                _job["current"] = f"{p['name'] or p['emp']} ({p['mail']})"
            try:
                send_one(outlook, p)
                at = mark_sent(p["emp"])
                with _job_lock:
                    _job["done"] += 1
                    _job["sent"].append({"emp": p["emp"], "at": at})
            except Exception as e:  # noqa: BLE001 — 한 사람 실패로 나머지를 멈추지 않음
                logger.warning("시크릿 키 메일 실패 %s: %s", p["emp"], e)
                with _job_lock:
                    _job["failed"].append({"emp": p["emp"], "name": p["name"], "mail": p["mail"], "error": str(e)[:200]})
            if i < len(people) - 1:
                time.sleep(SEND_INTERVAL_SEC)
    except Exception as e:  # noqa: BLE001 — Outlook 연결 자체 실패
        logger.exception("시크릿 키 메일 — Outlook 연결 실패")
        with _job_lock:
            _job["error"] = f"Outlook에 연결하지 못했습니다 — Outlook이 켜져 있는지 확인하세요 ({e})"
    finally:
        with _job_lock:
            _job["running"] = False
            _job["current"] = None
            _job["finished_at"] = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        pythoncom.CoUninitialize()


def _load_for_api():
    path = latest_roster_path()
    if not path:
        return None, None, "data/사용자 목록/ 에 현대엔지비사용자목록_*.xlsx 가 없습니다"
    try:
        return path, read_roster(path), None
    except RosterError as e:
        return path, None, str(e)
    except Exception as e:  # noqa: BLE001
        return path, None, f"명단 엑셀을 못 읽었습니다 — Excel로 열려 있거나 보호(AIP)가 걸렸는지 확인하세요 ({e})"


from auth import admin_required, current_admin  # noqa: E402


@secret_mail_bp.route("/api/secret-mail", methods=["GET"])
@admin_required
def api_roster():
    """명단 + 보낸 기록 + 보내는 계정 — 시크릿 키는 응답에 없음"""
    path, roster, err = _load_for_api()
    sender, sender_error = None, None
    try:
        import pythoncom
        pythoncom.CoInitialize()
        try:
            sender = default_account(outlook_app())
        finally:
            pythoncom.CoUninitialize()
    except Exception as e:  # noqa: BLE001
        sender_error = f"Outlook에 연결하지 못했습니다 — Outlook이 켜져 있는지 확인하세요 ({e})"
    base = {"ok": err is None, "file": os.path.basename(path) if path else None, "subject": SUBJECT,
            "sender": sender, "sender_error": sender_error, "job": _job_view()}
    if err:
        return jsonify({**base, "error": err, "rows": []})
    sent, excl, bad = load_sent(), excluded_ids(), key_mismatch(roster)
    rows = [{"emp": r["emp"], "name": r["name"], "mail": r["mail"],
             "excluded": r["emp"] in excl, "key_ok": r["emp"] not in bad,
             "sent_at": sent.get(r["emp"])} for r in roster]
    return jsonify({**base, "rows": rows})


@secret_mail_bp.route("/api/secret-mail/account-diff", methods=["GET"])
@admin_required
def api_account_diff():
    """명단 엑셀 vs .env 일반 회원 — 다른 사람 목록 + 반영 명령(읽기만)"""
    path, roster, err = _load_for_api()
    if err:
        return jsonify({"ok": False, "error": err})
    return jsonify({"ok": True, "file": os.path.basename(path), **account_diff(roster),
                    "command": apply_command(path),
                    "checked_at": datetime.now().strftime("%Y-%m-%d %H:%M:%S")})


@secret_mail_bp.route("/api/secret-mail/send", methods=["POST"])
@admin_required
def api_send():
    """{mode: "all"} = 관리자 빼고 안 보낸 사람 전부 / {mode: "selected", emps: [...]} = 고른 사람(이미 보냈어도 다시)"""
    body = request.get_json(silent=True) or {}
    mode = body.get("mode")
    path, roster, err = _load_for_api()
    if err:
        return jsonify({"ok": False, "error": err}), 400
    bad = key_mismatch(roster)
    if mode == "all":
        sent, excl = load_sent(), excluded_ids()
        people = [r for r in roster if r["emp"] not in excl and r["emp"] not in sent]
    elif mode == "selected":
        want = [str(e).strip() for e in (body.get("emps") or []) if str(e).strip()]
        by_emp = {r["emp"]: r for r in roster}
        missing = [e for e in want if e not in by_emp]
        if missing:
            return jsonify({"ok": False, "error": f"명단에 없는 사번: {', '.join(missing)}"}), 400
        people = [by_emp[e] for e in dict.fromkeys(want)]
    else:
        return jsonify({"ok": False, "error": "mode는 all 또는 selected"}), 400
    blocked = [p["emp"] for p in people if p["emp"] in bad]
    if blocked:
        return jsonify({"ok": False, "error": "로그인 비밀번호(.env)와 시크릿키가 다르거나 계정이 없어 못 보냄: "
                        + ", ".join(blocked)}), 400
    if not people:
        return jsonify({"ok": False, "error": "보낼 사람이 없습니다"}), 400

    with _job_lock:
        if _job.get("running"):
            return jsonify({"ok": False, "error": "이미 보내는 중입니다"}), 409
        who = current_admin() or {}
        _job.clear()
        _job.update({"running": True, "total": len(people), "done": 0, "sent": [], "failed": [],
                     "current": None, "cancel": False, "cancelled": False, "error": None,
                     "mode": mode, "started_by": who.get("name") or who.get("emp_no") or "",
                     "started_at": datetime.now().strftime("%Y-%m-%d %H:%M:%S"), "finished_at": None})
    threading.Thread(target=_run_job, args=(people,), daemon=True).start()
    return jsonify({"ok": True, "job": _job_view()})


@secret_mail_bp.route("/api/secret-mail/preview", methods=["GET"])
@admin_required
def api_preview():
    """?emp=사번 → 그 사람에게 갈 메일 그대로(키만 가림)"""
    emp = (request.args.get("emp") or "").strip()
    path, roster, err = _load_for_api()
    if err:
        return jsonify({"ok": False, "error": err}), 400
    person = next((r for r in roster if r["emp"] == emp), None)
    if person is None:
        return jsonify({"ok": False, "error": f"명단에 없는 사번: {emp}"}), 404
    return jsonify({"ok": True, "emp": emp, "name": person["name"],
                    "message": build_message(person, key=mask_key(person["key"])),
                    "key_length": len(person["key"])})


@secret_mail_bp.route("/api/secret-mail/status", methods=["GET"])
@admin_required
def api_status():
    return jsonify({"ok": True, "job": _job_view()})


@secret_mail_bp.route("/api/secret-mail/cancel", methods=["POST"])
@admin_required
def api_cancel():
    """지금 보내는 한 통은 끝내고 멈춤"""
    with _job_lock:
        if _job.get("running"):
            _job["cancel"] = True
    return jsonify({"ok": True, "job": _job_view()})
