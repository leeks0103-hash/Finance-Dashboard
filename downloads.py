"""
추출 결과 엑셀 파일 다운로드 API.

추출 스크립트(extract_financial_ppt.py / extract_kpi_ppt.py)가 PPT를 파싱해 만들어내는
엑셀과, 실적현황 원본 엑셀을 대시보드에서 바로 받아갈 수 있게 한다.

⚠️ 핵심: 경로를 **요청 시점에 다시 확인하고 디스크에서 그대로 읽어 보낸다.**
   서버 시작 시점의 사본을 캐시하지 않으므로, 추출 스크립트가 파일을 덮어쓰면
   그다음 다운로드부터 자동으로 최신본이 나간다. (재시작 불필요)
"""
import logging
import os
from datetime import datetime

from flask import Blueprint, jsonify, send_file

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
        })
    return jsonify({"files": items})


@download_bp.route("/api/download/<key>")
def api_download(key: str):
    meta = _FILES.get(key)
    if meta is None:
        return jsonify({"error": f"알 수 없는 파일 키: {key}"}), 404

    path = meta["resolve"]()
    if not os.path.exists(path):
        return jsonify({
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
