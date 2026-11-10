"""데이터 이상 "관리자 예외 처리"(2026-11-10) — 빨간 "!"에서 빼되 관리자 응답엔 남기고, 이상의 내용이 바뀌면 저절로 풀림."""
import copy

import pytest

import app as app_module
import auth


@pytest.fixture
def env(monkeypatch, tmp_path):
    state = {
        "admin": True,
        "rows": [{"file": "a.pptx", "finance_codes": ["E1", "E2"], "kpi_codes": ["E1"], "pending": False}],
        "conflicts": [],
        "anomalies": [],
        "failures": [],
    }

    def fake_collect():
        return (copy.deepcopy(state["rows"]), copy.deepcopy(state["conflicts"]),
                copy.deepcopy(state["anomalies"]), copy.deepcopy(state["failures"]))

    monkeypatch.setattr(app_module, "_collect_health", fake_collect)
    monkeypatch.setattr(app_module, "_EXC_PATH", tmp_path / "health_exceptions.json")
    monkeypatch.setattr(app_module, "_valid_health_acks", lambda: {})
    monkeypatch.setattr(auth, "is_logged_in", lambda req=None: True)
    monkeypatch.setattr(app_module, "is_admin", lambda req=None: state["admin"])
    monkeypatch.setattr(app_module, "current_admin", lambda req=None: {"name": "관리자", "emp_no": "1"})
    app_module.app.testing = True
    state["client"] = app_module.app.test_client()
    return state


def _health(env):
    return env["client"].get("/api/data-health").get_json()


def _except(env, files, done=True):
    return env["client"].post("/api/data-health/exception", json={"files": files, "done": done})


def test_exception_hides_from_badge_but_stays_for_admin(env):
    assert _health(env)["count"] == 1
    assert _except(env, ["a.pptx"]).status_code == 200

    env["admin"] = False
    body = _health(env)
    assert body["count"] == 0 and body["rows"] == [] and body["excepted"] == []   # 일반 사용자 화면에선 완전히 사라짐

    env["admin"] = True
    body = _health(env)
    assert body["count"] == 0 and body["rows"] == []                              # 관리자도 "!"에서는 빠짐
    ex = body["excepted"]
    assert len(ex) == 1 and ex[0]["file"] == "a.pptx" and ex[0]["by"] == "관리자" and ex[0]["at"]
    assert "재무 E1, E2" in ex[0]["issues"][0]                                    # 데이터(이상 내용)는 관리자에게 남음


def test_exception_released_when_issue_content_changes(env):
    _except(env, ["a.pptx"])
    env["rows"][0]["finance_codes"] = ["E1", "E2", "E3"]                          # PPT가 고쳐져 이상 내용이 달라짐
    body = _health(env)
    assert body["count"] == 1 and body["excepted"] == []                          # 다시 빨간 "!"
    env["rows"][0]["finance_codes"] = ["E1", "E2"]                                # 예전 내용으로 돌아와도 예외는 이미 정리됨
    assert _health(env)["count"] == 1


def test_exception_kept_while_same_issue_persists(env):
    _except(env, ["a.pptx"])
    for _ in range(3):
        assert _health(env)["count"] == 0


def test_resolved_issue_clears_exception(env):
    _except(env, ["a.pptx"])
    env["rows"] = []
    assert _health(env)["excepted"] == []
    env["rows"] = [{"file": "a.pptx", "finance_codes": ["E1", "E2"], "kpi_codes": ["E1"], "pending": False}]
    assert _health(env)["count"] == 1                                             # 이상이 사라졌다 다시 생기면 새 이상 — 예외 아님


def test_only_admin_can_set_or_release(env):
    env["admin"] = False
    assert _except(env, ["a.pptx"]).status_code == 403
    env["admin"] = True
    _except(env, ["a.pptx"])
    env["admin"] = False
    assert _except(env, ["a.pptx"], done=False).status_code == 403
    env["admin"] = True
    assert _health(env)["count"] == 0                                             # 일반 사용자의 해제 시도는 무효


def test_release_brings_back_the_badge(env):
    _except(env, ["a.pptx"])
    assert _except(env, ["a.pptx"], done=False).status_code == 200
    body = _health(env)
    assert body["count"] == 1 and body["excepted"] == []


def test_cannot_except_file_without_issue(env):
    r = _except(env, ["none.pptx"])
    assert r.status_code == 400
    assert _except(env, []).status_code == 400


def test_conflict_hidden_only_when_all_its_files_are_excepted(env):
    env["rows"] = []
    env["conflicts"] = [{"source": "재무", "code": "E9", "files": ["x.pptx", "y.pptx"], "verdict": "needs_review", "pending": False}]
    _except(env, ["x.pptx"])
    assert _health(env)["count"] == 1                                             # 한 파일만으로는 충돌 건이 안 사라짐
    _except(env, ["y.pptx"])
    assert _health(env)["count"] == 0
    assert {e["file"] for e in _health(env)["excepted"]} == {"x.pptx", "y.pptx"}


def test_exception_not_pruned_when_conflict_sheet_unreadable(env):
    """코드충돌 시트를 못 읽어 목록이 불완전할 땐 예외 처리 기록을 지우지 않는다"""
    _except(env, ["a.pptx"])
    env["rows"] = []
    env["failures"] = [{"source": "재무", "file": "재무.xlsx"}]
    _health(env)
    env["rows"] = [{"file": "a.pptx", "finance_codes": ["E1", "E2"], "kpi_codes": ["E1"], "pending": False}]
    env["failures"] = []
    assert _health(env)["count"] == 0                                             # 기록이 남아 있어 같은 내용이면 계속 예외


def test_pending_rows_still_admin_only(env):
    env["rows"] = [{"file": "p.pptx", "finance_codes": ["생성예정"], "kpi_codes": ["E5"], "pending": True}]
    env["admin"] = False
    assert _health(env)["count"] == 0
    env["admin"] = True
    assert _health(env)["count"] == 1
