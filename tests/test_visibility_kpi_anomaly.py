"""공개 범위 kpiAnomaly — KPI 조기입력 의심 배너를 관리자가 닫고(none) 다시 켤 수 있게 (2026-11-09)"""
import pytest

import app as app_module


@pytest.fixture
def vis_client(client, tmp_path, monkeypatch):
    """공개 범위 파일을 임시 위치로 — 실제 data/visibility.json을 건드리지 않음. 관리자로 로그인된 상태"""
    monkeypatch.setattr(app_module, "_VISIBILITY_PATH", tmp_path / "visibility.json")
    monkeypatch.setattr(app_module, "is_admin", lambda req=None: True)
    return client


def test_default_is_all_so_existing_screens_keep_showing_the_banner(vis_client):
    assert vis_client.get("/api/settings/visibility").get_json()["kpiAnomaly"] == "all"


def test_admin_can_close_and_reopen_for_everyone(vis_client):
    r = vis_client.put("/api/settings/visibility", json={"kpiAnomaly": "none"})
    assert r.status_code == 200 and r.get_json()["kpiAnomaly"] == "none"
    # 저장됨 — 누가 읽어도(로그인 전 공개 조회) 같은 값
    assert vis_client.get("/api/settings/visibility").get_json()["kpiAnomaly"] == "none"

    r = vis_client.put("/api/settings/visibility", json={"kpiAnomaly": "all"})
    assert r.get_json()["kpiAnomaly"] == "all"
    assert vis_client.get("/api/settings/visibility").get_json()["kpiAnomaly"] == "all"


def test_admin_only_option_is_accepted(vis_client):
    assert vis_client.put("/api/settings/visibility", json={"kpiAnomaly": "admin"}).get_json()["kpiAnomaly"] == "admin"


def test_closing_it_does_not_change_the_other_settings(vis_client):
    before = vis_client.get("/api/settings/visibility").get_json()
    after = vis_client.put("/api/settings/visibility", json={"kpiAnomaly": "none"}).get_json()
    assert {k: v for k, v in after.items() if k != "kpiAnomaly"} == {k: v for k, v in before.items() if k != "kpiAnomaly"}


def test_bad_value_is_rejected(vis_client):
    r = vis_client.put("/api/settings/visibility", json={"kpiAnomaly": "sometimes"})
    assert r.status_code == 400


def test_non_admin_cannot_close_it_for_everyone(client, tmp_path, monkeypatch):
    monkeypatch.setattr(app_module, "_VISIBILITY_PATH", tmp_path / "visibility.json")
    monkeypatch.setattr(app_module, "is_admin", lambda req=None: False)
    r = client.put("/api/settings/visibility", json={"kpiAnomaly": "none"})
    assert r.status_code == 403
    assert client.get("/api/settings/visibility").get_json()["kpiAnomaly"] == "all"
