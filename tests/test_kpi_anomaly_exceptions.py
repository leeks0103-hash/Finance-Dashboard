"""KPI 조기입력 의심 — 한 프로젝트 = 1건 · 관리자 예외 처리(2026-11-11)."""
import pandas as pd
import pytest

import app as app_module
import auth
import kpi


def _frame(rows):
    return pd.DataFrame(rows, columns=[
        "프로젝트코드", "보고단계", "파일명", "NPS_PJ실적", "AI활용_PJ실적", "AI적용_PJ실적", "수행연도", "파트명",
    ])


@pytest.fixture
def env(monkeypatch, tmp_path):
    state = {
        "admin": True,
        # 한 프로젝트(착수 단계)에 지표 3개가 채워져 있음 + 완료 단계는 정상 + 값 없는 착수 행
        "rows": [
            ["E1", "착수", "a.pptx", "4.5", "10", "3", "2026", "AI"],
            ["E2", "완료", "b.pptx", "4.0", "5", "1", "2026", "AI"],
            ["E3", "착수", "c.pptx", "N", "0", "N", "2026", "AI"],
        ],
    }
    monkeypatch.setattr(kpi, "get_kpi_df", lambda: _frame(state["rows"]))
    monkeypatch.setattr(kpi, "_ANOM_EXC_PATH", tmp_path / "kpi_anomaly_exceptions.json")
    monkeypatch.setattr(auth, "is_logged_in", lambda req=None: True)
    monkeypatch.setattr(kpi, "is_admin", lambda req=None: state["admin"])
    monkeypatch.setattr(kpi, "current_admin", lambda req=None: {"name": "관리자", "emp_no": "1"})
    app_module.app.testing = True
    state["client"] = app_module.app.test_client()
    return state


def _data(env, **params):
    return env["client"].get("/api/kpi/data", query_string=params).get_json()


def test_one_project_with_three_metrics_is_one_item(env):
    found = kpi._find_premature_actual_rows()
    assert len(found) == 1                                   # 지표가 3개여도 한 건
    g = found[0]
    assert (g["project_code"], g["stage"], g["file"]) == ("E1", "착수", "a.pptx")
    assert {m["metric"] for m in g["metrics"]} == {"NPS", "AI활용", "AI적용"}


def test_two_projects_are_two_items(env):
    env["rows"].append(["E4", "제안", "d.pptx", "1", "N", "N", "2026", "AI"])
    assert len(kpi._find_premature_actual_rows()) == 2


def test_exception_hides_item_but_stays_for_admin(env):
    gid = kpi._find_premature_actual_rows()[0]["id"]
    r = env["client"].post("/api/kpi/anomaly-exception", json={"ids": [gid], "done": True})
    assert r.status_code == 200 and r.get_json()["ok"] is True

    visible, excepted = kpi._split_anomalies()
    assert visible == [] and len(excepted) == 1
    assert excepted[0]["by"] == "관리자" and excepted[0]["at"]


def test_exception_row_marked_and_anomaly_only_empty(env):
    gid = kpi._find_premature_actual_rows()[0]["id"]
    env["client"].post("/api/kpi/anomaly-exception", json={"ids": [gid], "done": True})

    rows = {r["프로젝트코드"]: r for r in _data(env)["data"]}
    assert rows["E1"].get("_anomaly_excepted") is True       # 빨간 행으로 안 칠하도록 표시
    assert "_anomaly_excepted" not in rows["E3"]
    assert _data(env, anomaly_only="1")["total"] == 0        # "한눈에 보기"에도 안 걸림


def test_exception_released_when_values_change(env):
    gid = kpi._find_premature_actual_rows()[0]["id"]
    env["client"].post("/api/kpi/anomaly-exception", json={"ids": [gid], "done": True})
    env["rows"][0][3] = "4.9"                                # PPT가 고쳐져 값이 달라짐
    visible, excepted = kpi._split_anomalies()
    assert len(visible) == 1 and excepted == []              # 다시 의심으로 표시
    env["rows"][0][3] = "4.5"                                # 예전 값으로 돌아와도 예외는 이미 정리됨
    visible, excepted = kpi._split_anomalies()
    assert len(visible) == 1 and excepted == []


def test_resolved_item_clears_exception(env):
    gid = kpi._find_premature_actual_rows()[0]["id"]
    env["client"].post("/api/kpi/anomaly-exception", json={"ids": [gid], "done": True})
    env["rows"][0][1] = "완료"                                # 완료 보고가 되면 더 이상 의심이 아님
    assert kpi._split_anomalies() == ([], [])
    env["rows"][0][1] = "착수"
    visible, excepted = kpi._split_anomalies()
    assert len(visible) == 1 and excepted == []              # 같은 이상이 다시 생기면 새 이상


def test_release_brings_item_back(env):
    gid = kpi._find_premature_actual_rows()[0]["id"]
    env["client"].post("/api/kpi/anomaly-exception", json={"ids": [gid], "done": True})
    env["client"].post("/api/kpi/anomaly-exception", json={"ids": [gid], "done": False})
    visible, excepted = kpi._split_anomalies()
    assert len(visible) == 1 and excepted == []


def test_non_admin_forbidden_and_unknown_id_rejected(env):
    gid = kpi._find_premature_actual_rows()[0]["id"]
    env["admin"] = False
    assert env["client"].post("/api/kpi/anomaly-exception", json={"ids": [gid], "done": True}).status_code == 403
    env["admin"] = True
    assert env["client"].post("/api/kpi/anomaly-exception", json={"ids": ["nope|x|y"], "done": True}).status_code == 400
    assert env["client"].post("/api/kpi/anomaly-exception", json={"ids": [], "done": True}).status_code == 400
    assert kpi._split_anomalies()[1] == []                   # 거절된 요청은 아무것도 저장 안 함


def test_summary_excepted_list_only_for_admin(env, monkeypatch, tmp_path):
    excel = tmp_path / "kpi.xlsx"
    excel.write_bytes(b"x")
    monkeypatch.setattr(kpi, "KPI_EXCEL_PATH", str(excel))
    monkeypatch.setattr(kpi, "_kpi_agg_df", pd.DataFrame({"구분": ["x"]}))
    monkeypatch.setattr(kpi, "_load_kpi_items_from_cache", lambda: [])
    gid = kpi._find_premature_actual_rows()[0]["id"]

    body = env["client"].get("/api/kpi/summary").get_json()
    assert body["anomaly_count"] == 1 and body["excepted"] == []

    env["client"].post("/api/kpi/anomaly-exception", json={"ids": [gid], "done": True})
    body = env["client"].get("/api/kpi/summary").get_json()
    assert body["anomaly_count"] == 0 and body["anomalies"] == []
    assert len(body["excepted"]) == 1                        # 관리자에게는 해제할 자리용으로 남음

    env["admin"] = False
    body = env["client"].get("/api/kpi/summary").get_json()
    assert body["anomaly_count"] == 0 and body["excepted"] == []   # 일반 사용자에겐 완전히 사라짐
