"""PPT 업데이트(재추출) 요청 — 2026-10-21

사용자가 원본 PPT를 고친 뒤 파일명 옆 '업데이트 요청' 버튼을 누르면 서버 data/extract_requests.json에 남음
(메일을 못 보내서 대신, 다른 PC에서도 보임). 관리자에게만 헤더 노란 "!" + 목록 → 선택 추출로 바로 처리.
요청 뒤에 그 파일이 다시 추출되면(처리이력 처리일시 > 요청 시각) 저절로 없어짐 — 데이터 이상 '수정 완료'(app.py)와 같은 규칙.

'바뀜' 판정: 원본 파일 수정 시각 > 마지막 처리일시면 changed=True(저장을 깜빡하고 요청하는 경우 거르기용).
원본 위치는 처리이력 '전체경로'로 찾고 stat만 함(NAS 파일을 열지 않음 — 읽기 전용 원칙). 못 찾으면 None(알 수 없음).
"""
import json
import logging
import os
import threading
from datetime import datetime
from pathlib import Path

from flask import Blueprint, jsonify, request

from auth import admin_required, current_user
from shared import find_source_path

logger = logging.getLogger(__name__)
request_bp = Blueprint("extract_requests", __name__)

_PATH = Path(__file__).parent / "data" / "extract_requests.json"
_lock = threading.Lock()


def _read() -> dict:
    try:
        data = json.loads(_PATH.read_text(encoding="utf-8"))
        return data if isinstance(data, dict) else {}
    except FileNotFoundError:
        return {}
    except Exception:
        logger.warning("업데이트 요청 파일을 못 읽음 — 무시: %s", _PATH)
        return {}


def _write(reqs: dict) -> None:
    _PATH.parent.mkdir(exist_ok=True)
    tmp = _PATH.with_suffix(".json.tmp")
    tmp.write_text(json.dumps(reqs, ensure_ascii=False, indent=2), encoding="utf-8")
    os.replace(tmp, _PATH)


def _file_state(filename: str, processed: dict) -> dict:
    """원본 수정 시각·마지막 처리일시·바뀜 여부. 위치를 못 찾으면 modified/changed None"""
    from extract_coverage import SOURCES
    last = processed.get(filename) or None
    path = None
    for cfg in SOURCES.values():
        path = find_source_path(cfg["excel"], cfg["history_sheet"], filename)
        if path:
            break
    modified = None
    if path:
        try:
            modified = datetime.fromtimestamp(os.path.getmtime(path)).strftime("%Y-%m-%d %H:%M:%S")
        except OSError:
            modified = None
    changed = None if modified is None else (last is None or modified > last)
    return {"modified": modified, "last_extracted": last, "changed": changed}


def _valid(reqs: dict, processed: dict) -> dict:
    """요청 뒤에 다시 추출된 파일은 뺌"""
    return {f: r for f, r in reqs.items() if processed.get(f, "") < str(r.get("at", ""))}


def _processed() -> dict:
    from extract_coverage import last_processed
    return last_processed()


@request_bp.route("/api/extract-requests/check", methods=["POST"])
def api_check():
    """{file} → 요청 전 확인창용: 원본이 마지막 추출 뒤에 바뀌었는지 + 이미 요청돼 있는지"""
    file = str((request.get_json(silent=True) or {}).get("file") or "").strip()
    if not file or len(file) > 300:
        return jsonify({"ok": False, "error": "파일명이 없습니다"}), 400
    state = _file_state(file, _processed())
    with _lock:
        existing = _read().get(file)
    return jsonify({"ok": True, **state, "requested": existing})


@request_bp.route("/api/extract-requests", methods=["POST"])
def api_request():
    """{file} — 업데이트 요청 남김(로그인한 누구나). 같은 파일은 마지막 요청으로 덮음"""
    file = str((request.get_json(silent=True) or {}).get("file") or "").strip()
    if not file or len(file) > 300:
        return jsonify({"ok": False, "error": "파일명이 없습니다"}), 400
    user = current_user(request)
    entry = {"at": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
             "by": (user.get("name") or user.get("emp_no")) if user else ""}
    with _lock:
        reqs = _read()
        reqs[file] = entry
        _write(reqs)
    logger.info("[업데이트 요청] %s — %s", file, entry["by"])
    return jsonify({"ok": True, "request": entry})


@request_bp.route("/api/extract-requests", methods=["GET"])
@admin_required
def api_list():
    """관리자 — 남은 요청 목록(다시 추출된 건 정리) + 파일별 바뀜 여부, 요청 늦은 순"""
    try:
        processed = _processed()
    except Exception:
        logger.exception("처리이력 읽기 실패 — 요청 목록 그대로")
        processed = {}
    with _lock:
        reqs = _read()
        valid = _valid(reqs, processed)
        if len(valid) != len(reqs):
            _write(valid)
    items = [{"file": f, **r, **_file_state(f, processed)} for f, r in valid.items()]
    items.sort(key=lambda x: x.get("at", ""), reverse=True)
    return jsonify({"ok": True, "items": items})


@request_bp.route("/api/extract-requests/dismiss", methods=["POST"])
@admin_required
def api_dismiss():
    """관리자 — {file} 요청 지움(추출 없이 처리 끝낼 때)"""
    file = str((request.get_json(silent=True) or {}).get("file") or "").strip()
    with _lock:
        reqs = _read()
        reqs.pop(file, None)
        _write(reqs)
    return jsonify({"ok": True})
