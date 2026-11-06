"""
추출 결과 엑셀 파일 다운로드 API.

추출 스크립트(extract_financial_ppt.py / extract_kpi_ppt.py)가 PPT를 파싱해 만들어내는
엑셀과, 실적현황 원본 엑셀을 대시보드에서 바로 받아갈 수 있게 한다.

⚠️ 핵심: 경로를 **요청 시점에 다시 확인하고 디스크에서 그대로 읽어 보낸다.**
   서버 시작 시점의 사본을 캐시하지 않으므로, 추출 스크립트가 파일을 덮어쓰면
   그다음 다운로드부터 자동으로 최신본이 나간다. (재시작 불필요)
"""
import io
import logging
import os
import re
import zipfile
from datetime import datetime

from flask import Blueprint, jsonify, request, send_file

import paths

logger = logging.getLogger(__name__)

download_bp = Blueprint("downloads", __name__)

# 다운로드 가능한 파일 — 고정 키 → 경로 해석 함수.
# 클라이언트가 보낸 문자열을 경로로 쓰지 않기 위해(경로 탈출 방지) 반드시 이 표를 거친다.
_FILES = {
    "finance": {
        "label": "재무 데이터",
        "desc":  "재무 PPT에서 추출한 매출·원가·손익 데이터",
        "resolve": lambda: paths._from_env("EXCEL_PATH", paths.FINANCE_EXCEL_NAME),
    },
    "kpi": {
        "label": "KPI 데이터",
        "desc":  "KPI PPT에서 추출한 지표 데이터 (취합·집계 시트)",
        "resolve": lambda: paths._from_env("KPI_EXCEL_PATH", paths.KPI_EXCEL_NAME),
    },
    "performance": {
        "label": "실적현황 원본",
        "desc":  "사업계획 통합관리 파일 (추출물이 아닌 원본, data/ 안 최신본)",
        "resolve": paths.resolve_perf_excel,
    },
    # 저장된 파일이 아니라 받을 때마다 만드는 엑셀(2026-10-14) — 수정 시각은 원본(실적현황) 기준.
    # 필터 없이 전체. 필터·검색 건 결과는 프로젝트 상세 표의 "↓ 엑셀"(/api/performance/data/export)
    "project_detail": {
        "label": "프로젝트 상세",
        "desc":  "실적 탭 프로젝트 상세 표 전체 (프로젝트당 한 줄, 상이·착수↑ 배지 포함)",
        "resolve": paths.resolve_perf_excel,
        "generated": True,
    },
}


def _stat(path: str):
    """파일 메타 — 없으면 None."""
    try:
        st = os.stat(path)
        return {
            "size": st.st_size,
            "modified": datetime.fromtimestamp(st.st_mtime).strftime("%Y-%m-%d %H:%M"),
            "mtime": st.st_mtime,
        }
    except OSError:
        return None


@download_bp.route("/api/download")
def api_download_list():
    """받을 수 있는 파일 목록 + 최종 수정 시각. 화면에서 버튼을 그릴 때 쓴다."""
    items = []
    for key, meta in _FILES.items():
        try:
            path = meta["resolve"]()
        except Exception as e:                       # 경로 해석 자체가 실패해도 목록은 나가야 함
            logger.warning("다운로드 경로 해석 실패(%s): %s", key, e)
            path = ""
        info = _stat(path) if path else None
        items.append({
            "key":       key,
            "label":     meta["label"],
            "desc":      meta["desc"],
            "filename":  os.path.basename(path) if path else "",
            "available": info is not None,
            "size":      info["size"] if info else 0,
            "modified":  info["modified"] if info else "",
            "generated": bool(meta.get("generated")),
        })
    return jsonify({"files": items})


@download_bp.route("/api/download/<key>")
def api_download(key: str):
    meta = _FILES.get(key)
    if meta is None:
        # 입력(key)을 그대로 되돌려 보내지 않고, 다른 API와 같은 {ok:false, error} 모양으로(2026-11-04)
        return jsonify({"ok": False, "error": "알 수 없는 파일입니다"}), 404

    path = meta["resolve"]()
    if meta.get("generated") and os.path.exists(path):
        # 받을 때마다 최신 실적 데이터로 생성 — **필터 없는 전체**. 예전엔 현재 요청을 그대로 넘겨서 `?part=..&search=..` 같은
        # 쿼리가 적용됐는데(주석·목록 설명은 "전체"), 화면 버튼은 쿼리 없이 불러 의도와 같음 → 빈 요청 컨텍스트에서 만들어 확실히 전체로(2026-11-04).
        # 필터·검색 결과는 프로젝트 상세 표의 "↓ 엑셀"(/api/performance/data/export)
        from flask import current_app
        from performance import api_perf_data_export
        logger.info("엑셀 다운로드: %s (생성)", key)
        with current_app.test_request_context("/api/performance/data/export"):
            return api_perf_data_export()
    if not os.path.exists(path):
        return jsonify({
            "ok": False,
            "error": f"{meta['label']} 파일이 없습니다. 추출 스크립트를 먼저 실행해주세요.",
            "path":  os.path.basename(path),
        }), 404

    # 같은 이름으로 계속 덮어쓰이는 파일이라, 받는 쪽에서 버전을 구분할 수 있도록
    # 파일 수정 시각을 이름에 붙인다. (원본 파일 자체는 건드리지 않음)
    base, ext = os.path.splitext(os.path.basename(path))
    stamp = datetime.fromtimestamp(os.path.getmtime(path)).strftime("%y%m%d_%H%M")
    download_name = f"{base}_{stamp}{ext}"

    logger.info("엑셀 다운로드: %s → %s", key, download_name)
    # conditional=False — mtime이 같아도 항상 새로 내보내 캐시된 옛 버전이 나가지 않게 한다
    return send_file(path, as_attachment=True, download_name=download_name, conditional=False)


# ── 파일 열기 도구(2026-11-06) ─────────────────────────────────────────────────────────────
# 서버가 아니라 접속자 PC에서 NAS 원본을 열기 위한 설치 파일 묶음. 소스는 tools/HmcOpen/, 받을 때마다 zip으로 묶어 내려줌
# (그래서 스크립트를 고치면 다음 다운로드부터 바로 반영). 아래 둘은 PC마다 달라서 소스가 아니라 **받을 때 생성**해 zip에 넣는다:
#   root.txt — 도구가 열어도 되는 폴더(NAS 보고서 폴더). 도구가 이 폴더 밖 경로는 거절 → paths.PPT_SOURCE_DIR가 바뀌면 다시 받아 설치
#   url.txt  — 대시보드 주소. 설치가 끝나면 이 주소를 열어 "이 브라우저는 설치됨"을 표시(프론트가 ?origin=으로 보냄, 없으면 생략)
# 파일 이름은 고정 목록으로만 — 폴더에 다른 파일이 섞여도 안 나가게
_OPEN_TOOL_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "tools", "HmcOpen")
_OPEN_TOOL_FILES = ("install.bat", "install.ps1", "uninstall.bat", "open.ps1", "launch.vbs", "README.txt")
_ORIGIN_RE = re.compile(r"^https?://[A-Za-z0-9.\-]+(:\d{1,5})?$")


@download_bp.route("/api/open-tool/download")
def api_open_tool_download():
    missing = [f for f in _OPEN_TOOL_FILES if not os.path.exists(os.path.join(_OPEN_TOOL_DIR, f))]
    if missing:
        logger.error("파일 열기 도구 소스 누락: %s", missing)
        return jsonify({"ok": False, "error": "설치 파일을 준비하지 못했습니다"}), 500

    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
        for name in _OPEN_TOOL_FILES:
            zf.write(os.path.join(_OPEN_TOOL_DIR, name), f"HmcOpen/{name}")
        # 한글 경로를 PowerShell이 BOM 없이도 UTF-8로 읽도록 Get-Content -Encoding UTF8로 읽는 파일이라 BOM 없이 씀
        zf.writestr("HmcOpen/root.txt", paths.PPT_SOURCE_DIR.rstrip("\\") + "\r\n")
        origin = (request.args.get("origin") or "").strip().rstrip("/")
        if _ORIGIN_RE.match(origin):
            zf.writestr("HmcOpen/url.txt", origin + "\r\n")
    buf.seek(0)
    logger.info("파일 열기 도구 다운로드 (origin=%s)", request.args.get("origin", ""))
    return send_file(buf, mimetype="application/zip", as_attachment=True, download_name="HmcOpen.zip", conditional=False)
