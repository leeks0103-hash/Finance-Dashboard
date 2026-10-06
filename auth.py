"""
관리자 로그인(사번·비밀번호) — DB 없이 .env 계정 목록으로(2026-10-06).

  ADMIN_ACCOUNTS="12345:비밀번호:홍길동,67890:비밀번호"   (이름은 생략 가능 — 없으면 사번 표시)

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
    or hashlib.sha256(("ngv-admin:" + os.environ.get("ADMIN_ACCOUNTS", "")).encode()).hexdigest()
).strip()


def _load_accounts() -> dict[str, dict]:
    out: dict[str, dict] = {}
    for item in os.environ.get("ADMIN_ACCOUNTS", "").split(","):
        parts = [p.strip() for p in item.strip().split(":")]
        if len(parts) < 2 or not parts[0] or not parts[1]:
            continue
        emp, pw = parts[0], parts[1]
        out[emp] = {"password": pw, "name": parts[2] if len(parts) > 2 and parts[2] else emp}
    if not out:
        logger.warning("ADMIN_ACCOUNTS가 비어 있음 — 관리자 로그인 불가")
    return out


_ACCOUNTS = _load_accounts()


def _sign(emp: str, pw: str) -> str:
    return hmac.new(_SECRET.encode(), f"{emp}:{pw}".encode(), hashlib.sha256).hexdigest()


def login(emp: str, pw: str) -> "dict | None":
    """맞으면 {token, emp_no, name}, 틀리면 None."""
    acc = _ACCOUNTS.get(emp)
    if not acc or not hmac.compare_digest(acc["password"], pw):
        return None
    return {"token": f"{emp}.{_sign(emp, pw)}", "emp_no": emp, "name": acc["name"]}


def current_admin(req=None) -> "dict | None":
    """요청 헤더의 토큰이 유효하면 {emp_no, name}."""
    token = (req or request).headers.get("X-Extract-Key", "")
    emp, _, sig = token.partition(".")
    acc = _ACCOUNTS.get(emp)
    if not acc or not sig or not hmac.compare_digest(sig, _sign(emp, acc["password"])):
        return None
    return {"emp_no": emp, "name": acc["name"]}


def is_admin(req=None) -> bool:
    return current_admin(req) is not None


def admin_required(fn):
    """관리자 전용 API — 화면에서 숨긴 섹션의 데이터를 주소로 직접 불러도 못 받게."""
    @functools.wraps(fn)
    def wrapper(*args, **kwargs):
        if not is_admin():
            return jsonify({"ok": False, "error": "관리자만 볼 수 있습니다"}), 403
        return fn(*args, **kwargs)
    return wrapper
