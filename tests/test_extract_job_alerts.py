"""추출이 끝나면 상단 알림 종 배지를 다시 센다 (2026-11-06)
예전엔 정해진 시각(기본 08:00)에만 세서, 추출로 다 해결해도 아침의 "99+"가 다음 확인까지 남았음."""
import pytest

import app
import extract_alerts


@pytest.fixture
def job_env(monkeypatch):
    """실제 추출·엑셀 읽기 없이 _extract_job의 흐름만 — 상태 dict도 테스트용 사본"""
    monkeypatch.setattr(app, "_extract_status", {"running": True, "finished_at": None, "ok": None, "message": "", "cancelled": False})
    monkeypatch.setattr(app, "load_excel", lambda: None)
    monkeypatch.setattr(app, "load_kpi_excel", lambda: None)
    calls = []

    def fake_check():
        # 아직 "진행 중"일 때 불려야 함 — 화면이 끝남을 보고 알림을 다시 받을 때 새 숫자가 이미 들어 있게
        calls.append(app._extract_status["running"])
        return {}

    monkeypatch.setattr(extract_alerts, "check_now", fake_check)
    return calls


def test_alerts_recounted_before_status_flips_to_finished(job_env, monkeypatch):
    monkeypatch.setattr(app, "_run_extract_script", lambda *a, **k: (True, "ok"))
    app._extract_job(["finance"], "incremental")
    assert job_env == [True]
    assert app._extract_status["running"] is False and app._extract_status["ok"] is True


def test_alerts_recounted_even_when_extraction_failed_or_cancelled(job_env, monkeypatch):
    """실패·중지여도 거기까지는 반영돼 있으므로 다시 센다"""
    monkeypatch.setattr(app, "_run_extract_script", lambda *a, **k: (False, "exit 1"))
    app._extract_job(["finance"], "incremental")
    assert job_env == [True]

    job_env.clear()
    app._extract_status.update(running=True)
    monkeypatch.setattr(app, "_run_extract_script", lambda *a, **k: (False, "__CANCELLED__"))
    app._extract_job(["finance"], "incremental")
    assert job_env == [True] and app._extract_status["cancelled"] is True


def test_alert_recount_failure_never_blocks_the_extraction_result(job_env, monkeypatch):
    monkeypatch.setattr(app, "_run_extract_script", lambda *a, **k: (True, "ok"))

    def boom():
        raise RuntimeError("NAS 접근 실패")

    monkeypatch.setattr(extract_alerts, "check_now", boom)
    app._extract_job(["finance"], "incremental")
    assert app._extract_status["running"] is False and app._extract_status["ok"] is True
