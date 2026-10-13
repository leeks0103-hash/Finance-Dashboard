"""
로그인(사번·비밀번호) — DB 없이 .env 계정 목록으로(2026-10-06 관리자 로그인 → 2026-10-13 들어가자마자 모두 로그인).
계정을 추가하려면 쉼표로 이어 붙이고 Flask 재시작. 비밀번호에 쉼표·콜론(:)은 못 씀(구분자).

  ADMIN_ACCOUNTS="12345:비밀번호:홍길동,67890:비밀번호"   관리자 — 조회 + 관리자 기능(추출·재무 불일치 등)
  USER_ACCOUNTS="11111:비밀번호:김철수,22222:비밀번호"     일반 회원 — 조회만(2026-10-13)
  (이름은 생략 가능 — 없으면 사번 표시. 같은 사번이 둘 다 있으면 관리자)

로그인하면 토큰을 내려주고, 프론트가 localStorage에 저장해 이후 요청 헤더(X-Extract-Key)에 실어 보냄 —
예전 공용 키와 같은 흐름이라 헤더 이름은 그대로. 토큰 = "사번.HMAC(비밀, 사번:비밀번호)"라 서버에 세션을 안 두고도
검증되고, .env에서 비밀번호를 바꾸거나 계정을 지우면 그 사람의 기존 로그인은 바로 무효가 됨.
서명 비밀은 ADMIN_TOKEN_SECRET(선택) → 예전 EXTRACT_ADMIN_KEY → 계정 목록에서 자동 생성 순.
보안 경계라기보단 '아무나 못 보게' 하는 접근 제한(사내망 전용) — DB 생기면 정식 인증으로 옮길 것.
"""
import functools
import hashlib
import hmac
import logging
import os

from dotenv import load_dotenv
from flask import jsonify, request

load_dotenv()  # 블루프린트(performance·kpi)가 app.py보다 먼저 import해서 여기서도 읽음

logger = logging.getLogger(__name__)

# 토큰 서명용 비밀 — 따로 안 정했으면 계정 목록(비밀번호 포함)에서 만듦. 비밀번호를 모르면 위조 못 하고,
# 계정 목록이 바뀌면 기존 로그인이 전부 풀림(다시 로그인). ADMIN_TOKEN_SECRET은 굳이 안 적어도 됨
_SECRET = (
    os.environ.get("ADMIN_TOKEN_SECRET")
    or os.environ.get("EXTRACT_ADMIN_KEY")
    or hashlib.sha256(("ngv-admin:" + os.environ.get("ADMIN_ACCOUNTS", "")
                       + "|" + os.environ.get("USER_ACCOUNTS", "")).encode()).hexdigest()
).strip()


def _parse_accounts(env_name: str, role: str) -> dict[str, dict]:
    out: dict[str, dict] = {}
    for item in os.environ.get(env_name, "").split(","):
        parts = [p.strip() for p in item.strip().split(":")]
        if len(parts) < 2 or not parts[0] or not parts[1]:
            continue
        emp, pw = parts[0], parts[1]
        out[emp] = {"password": pw, "name": parts[2] if len(parts) > 2 and parts[2] else emp, "role": role}
    return out


def _load_accounts() -> dict[str, dict]:
    # 일반 회원 먼저, 관리자가 덮어씀 — 같은 사번이면 관리자
    out = {**_parse_accounts("USER_ACCOUNTS", "user"), **_parse_accounts("ADMIN_ACCOUNTS", "admin")}
    if not out:
        logger.warning("ADMIN_ACCOUNTS·USER_ACCOUNTS가 비어 있음 — 아무도 로그인 못 함")
    return out


_ACCOUNTS = _load_accounts()


def _sign(emp: str, pw: str) -> str:
    return hmac.new(_SECRET.encode(), f"{emp}:{pw}".encode(), hashlib.sha256).hexdigest()


def login(emp: str, pw: str) -> "dict | None":
    """맞으면 {token, emp_no, name, role}, 틀리면 None."""
    acc = _ACCOUNTS.get(emp)
    if not acc or not hmac.compare_digest(acc["password"], pw):
        return None
    return {"token": f"{emp}.{_sign(emp, pw)}", "emp_no": emp, "name": acc["name"], "role": acc["role"]}


def current_user(req=None) -> "dict | None":
    """요청 헤더의 토큰이 유효하면 {emp_no, name, role} — 관리자·일반 회원 모두."""
    req = req or request
    # 다운로드 링크(<a href>)는 헤더를 못 실어서 ?token= 으로도 받음(2026-10-13)
    token = req.headers.get("X-Extract-Key", "") or req.args.get("token", "")
    emp, _, sig = token.partition(".")
    acc = _ACCOUNTS.get(emp)
    if not acc or not sig or not hmac.compare_digest(sig, _sign(emp, acc["password"])):
        return None
    return {"emp_no": emp, "name": acc["name"], "role": acc["role"]}


def current_admin(req=None) -> "dict | None":
    """관리자로 로그인했으면 {emp_no, name, role}, 일반 회원·미로그인은 None."""
    user = current_user(req)
    return user if user and user["role"] == "admin" else None


def is_logged_in(req=None) -> bool:
    return current_user(req) is not None


def is_admin(req=None) -> bool:
    return current_admin(req) is not None


# 로그인 없이 부를 수 있는 API — 로그인 자체, 그리고 캐시 다시 읽기(데이터를 내보내지 않음.
# 추출 스크립트·dashboard_update가 서버 PC에서 토큰 없이 부름)
PUBLIC_API = {
    "/api/auth/login", "/api/auth/me",
    "/api/reload", "/api/kpi/reload", "/api/performance/reload",
}


def login_required_for_api():
    """app.before_request — 들어가자마자 로그인(2026-10-13). 로그인 안 하면 모든 데이터 API 401."""
    if not request.path.startswith("/api/") or request.path in PUBLIC_API or request.method == "OPTIONS":
        return None
    if not is_logged_in():
        return jsonify({"ok": False, "error": "로그인이 필요합니다"}), 401
    return None


def admin_required(fn):
    """관리자 전용 API — 화면에서 숨긴 섹션의 데이터를 주소로 직접 불러도 못 받게."""
    @functools.wraps(fn)
    def wrapper(*args, **kwargs):
        if not is_admin():
            return jsonify({"ok": False, "error": "관리자만 볼 수 있습니다"}), 403
        return fn(*args, **kwargs)
    return wrapper
