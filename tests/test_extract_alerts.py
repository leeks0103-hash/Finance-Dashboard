"""추출 알림(extract_alerts) — 일정(요일·정해진 시각·간격) 규칙·저장·관리자 전용 API."""
import json
from datetime import datetime

import pytest

import app as app_module
import extract_alerts as ea
import extract_coverage as ec


@pytest.fixture(autouse=True)
def _tmp_store(monkeypatch, tmp_path):
    monkeypatch.setattr(ea, "_PATH", tmp_path / "extract_alerts.json")
    monkeypatch.setattr(ea, "_SETTINGS_PATH", tmp_path / "extract_alerts_settings.json")


def _cov(f=(0, 0, 0), k=(0, 0, 0)):
    def part(t):
        return {"counts": {"pending": t[0], "failed": t[1], "extracted": 5}, "modified_count": t[2]}
    return {"ok": True, "finance": part(f), "kpi": part(k)}


def _t(s):
    return datetime.strptime(s, "%Y-%m-%d %H:%M:%S")


def _cfg(**kw):
    base = {k: (list(v) if isinstance(v, list) else v) for k, v in ea.DEFAULT_SETTINGS.items()}
    base.update(kw)
    return base


# ── 세기·저장 ──────────────────────────────────────────────────────────────

def test_counts_three_kinds_and_total(monkeypatch):
    monkeypatch.setattr(ec, "coverage", lambda force=False: _cov(f=(1, 2, 3), k=(0, 1, 4)))
    res = ea.check_now()
    assert res["finance"] == {"pending": 1, "failed": 2, "modified": 3}
    assert res["kpi"] == {"pending": 0, "failed": 1, "modified": 4}
    assert res["total"] == 11 and res["checked_at"] and res["last_error"] is None
    assert ea.read()["total"] == 11     # 저장됨


def test_zero_when_all_clear(monkeypatch):
    monkeypatch.setattr(ec, "coverage", lambda force=False: _cov())
    assert ea.check_now()["total"] == 0


def test_nas_failure_keeps_previous_numbers(monkeypatch):
    monkeypatch.setattr(ec, "coverage", lambda force=False: _cov(f=(2, 0, 0)))
    ea.check_now()
    monkeypatch.setattr(ec, "coverage", lambda force=False: {"ok": False, "error": "원본 폴더에 접근할 수 없습니다"})
    res = ea.check_now()
    assert res["total"] == 2                      # 접근 실패를 '문제 없음'으로 지우지 않음
    assert res["last_error"] and res["last_attempt"]


def test_exception_is_swallowed(monkeypatch):
    def boom(force=False):
        raise RuntimeError("NAS 끊김")
    monkeypatch.setattr(ec, "coverage", boom)
    assert ea.check_now()["last_error"] == "NAS 끊김"


def test_read_missing_or_broken_file_is_unchecked():
    assert ea.read()["checked_at"] is None
    ea._PATH.write_text("{깨짐", encoding="utf-8")
    assert ea.read()["total"] == 0


# ── 하루 확인 시각 목록 ────────────────────────────────────────────────────

def test_day_slots_times_mode_sorted():
    assert ea.day_slots(_cfg(mode="times", times=["17:00", "08:00", "13:00"])) == ["08:00", "13:00", "17:00"]


def test_day_slots_interval_mode_inside_window():
    cfg = _cfg(mode="interval", interval_minutes=240, window_start="08:00", window_end="18:00")
    assert ea.day_slots(cfg) == ["08:00", "12:00", "16:00"]            # 20:00은 시간대 밖
    cfg = _cfg(mode="interval", interval_minutes=120, window_start="09:00", window_end="17:00")
    assert ea.day_slots(cfg) == ["09:00", "11:00", "13:00", "15:00", "17:00"]   # 끝 시각과 딱 맞으면 포함
    cfg = _cfg(mode="interval", interval_minutes=30, window_start="00:00", window_end="23:59")
    assert len(ea.day_slots(cfg)) == 48


# ── 언제 체크하나 ──────────────────────────────────────────────────────────

ONCE = _cfg()                                        # 매일 08:00 한 번
WEEKDAYS = _cfg(days=[0, 1, 2, 3, 4])
THREE = _cfg(times=["08:00", "13:00", "17:00"])
OFF = _cfg(enabled=False)


def test_default_settings(tmp_path):
    assert ea.read_settings() == ea.DEFAULT_SETTINGS


def test_never_checked_is_due_immediately():
    # 첫 배포 직후 — 예정 시각을 기다리지 않고 한 번 확인
    assert ea._due(_t("2026-11-06 07:00:00"), ea._empty(), ONCE)


def test_once_a_day_not_due_after_todays_check():
    st = {**ea._empty(), "checked_at": "2026-11-06 08:00:05", "last_attempt": "2026-11-06 08:00:05"}
    assert not ea._due(_t("2026-11-06 15:00:00"), st, ONCE)


def test_once_a_day_waits_for_slot_when_yesterday_done():
    st = {**ea._empty(), "checked_at": "2026-11-05 08:00:05"}
    assert not ea._due(_t("2026-11-06 07:59:59"), st, ONCE)
    assert ea._due(_t("2026-11-06 08:00:00"), st, ONCE)


def test_catch_up_when_server_was_off_at_slot():
    st = {**ea._empty(), "checked_at": "2026-11-05 08:00:05"}
    assert ea._due(_t("2026-11-06 10:12:00"), st, ONCE)


def test_multiple_times_a_day_each_slot_is_due_once():
    st = {**ea._empty(), "checked_at": "2026-11-06 08:00:05"}
    assert not ea._due(_t("2026-11-06 12:59:59"), st, THREE)
    assert ea._due(_t("2026-11-06 13:00:00"), st, THREE)               # 13시 슬롯
    st = {**ea._empty(), "checked_at": "2026-11-06 13:00:10"}
    assert not ea._due(_t("2026-11-06 16:59:00"), st, THREE)
    assert ea._due(_t("2026-11-06 17:00:00"), st, THREE)
    st = {**ea._empty(), "checked_at": "2026-11-06 17:00:10"}
    assert not ea._due(_t("2026-11-06 23:00:00"), st, THREE)           # 그날은 끝
    assert ea._due(_t("2026-11-07 08:00:00"), st, THREE)               # 다음 날 첫 슬롯


def test_interval_mode_follows_window_slots():
    cfg = _cfg(mode="interval", interval_minutes=240, window_start="08:00", window_end="18:00")   # 08·12·16
    st = {**ea._empty(), "checked_at": "2026-11-06 08:00:05"}
    assert not ea._due(_t("2026-11-06 11:59:00"), st, cfg)
    assert ea._due(_t("2026-11-06 12:00:00"), st, cfg)
    st = {**ea._empty(), "checked_at": "2026-11-06 16:00:05"}
    assert not ea._due(_t("2026-11-06 20:00:00"), st, cfg)             # 시간대 밖(20시)엔 안 함


def test_weekdays_skips_weekend():
    # 2026-11-06 금 / 07 토 / 08 일 / 09 월
    fri = {**ea._empty(), "checked_at": "2026-11-06 08:00:05"}
    assert not ea._due(_t("2026-11-07 09:00:00"), fri, WEEKDAYS)       # 토요일엔 안 함
    assert not ea._due(_t("2026-11-08 20:00:00"), fri, WEEKDAYS)       # 일요일에도
    assert not ea._due(_t("2026-11-09 07:59:00"), fri, WEEKDAYS)
    assert ea._due(_t("2026-11-09 08:00:00"), fri, WEEKDAYS)           # 월요일 8시에 재개
    assert ea._due(_t("2026-11-07 09:00:00"), fri, ONCE)               # 매일이면 토요일에도 함


def test_custom_days_only_selected_weekdays():
    mon_wed = _cfg(days=[0, 2])                                        # 월·수만
    tue = {**ea._empty(), "checked_at": "2026-11-02 08:00:05"}         # 월요일에 확인함
    assert not ea._due(_t("2026-11-03 09:00:00"), tue, mon_wed)        # 화요일엔 안 함
    assert ea._due(_t("2026-11-04 08:00:00"), tue, mon_wed)            # 수요일에 함


def test_disabled_is_never_due():
    assert not ea._due(_t("2026-11-06 12:00:00"), ea._empty(), OFF)


def test_retry_only_after_30_minutes_when_last_attempt_failed():
    st = {**ea._empty(), "checked_at": "2026-11-05 08:00:05", "last_attempt": "2026-11-06 08:00:10",
          "last_error": "NAS"}
    assert not ea._due(_t("2026-11-06 08:20:00"), st, ONCE)
    assert ea._due(_t("2026-11-06 08:30:10"), st, ONCE)


def test_next_check_labels():
    done = {**ea._empty(), "checked_at": "2026-11-06 08:00:05"}
    assert ea.next_check(_t("2026-11-06 15:00:00"), done, ONCE) == "2026-11-07 08:00"
    assert ea.next_check(_t("2026-11-06 15:00:00"), done, WEEKDAYS) == "2026-11-09 08:00"        # 금 → 월
    assert ea.next_check(_t("2026-11-06 09:00:00"), done, THREE) == "2026-11-06 13:00"
    assert ea.next_check(_t("2026-11-06 14:00:00"), {**done, "checked_at": "2026-11-06 13:00:05"}, THREE) == "2026-11-06 17:00"
    assert ea.next_check(_t("2026-11-06 09:00:00"), done, OFF) is None
    # 지금 해야 하는 상태(놓친 슬롯)면 지금
    assert ea.next_check(_t("2026-11-06 14:00:00"), done, THREE) == "2026-11-06 14:00"


# ── 설정 저장·검증 ─────────────────────────────────────────────────────────

def test_write_settings_validates_and_keeps_others():
    cur = ea.write_settings({"days": [4, 0, 2, 2]})
    assert cur["days"] == [0, 2, 4]                                    # 정렬·중복 제거
    cur = ea.write_settings({"times": ["17:00", "08:00", "13:00"], "mode": "times"})
    assert cur["times"] == ["08:00", "13:00", "17:00"] and cur["days"] == [0, 2, 4]    # 안 보낸 항목은 유지
    assert ea.read_settings() == cur


@pytest.mark.parametrize("patch", [
    {"enabled": "yes"}, {"enabled": 1},
    {"days": []}, {"days": [7]}, {"days": [-1]}, {"days": ["0"]}, {"days": [True]}, {"days": "0123456"},
    {"mode": "cron"},
    {"times": []}, {"times": ["25:00"]}, {"times": ["8:00"]}, {"times": [800]}, {"times": ["08:00"] * 7 + ["09:00"]},
    {"times": [f"{h:02d}:00" for h in range(7)]},                      # 7개
    {"interval_minutes": 45}, {"interval_minutes": 1440}, {"interval_minutes": True}, {"interval_minutes": "60"},
    {"window_start": "24:00"}, {"window_end": "9"},
    {"window_start": "18:00", "window_end": "08:00"}, {"window_start": "09:00", "window_end": "09:00"},
    {"nope": 1}, {"frequency": "daily"},
])
def test_write_settings_rejects_bad_values(patch):
    with pytest.raises(ValueError):
        ea.write_settings(patch)
    assert ea.read_settings() == ea.DEFAULT_SETTINGS     # 거부하면 저장 안 함


def test_window_start_must_stay_before_end_across_patches():
    ea.write_settings({"window_end": "12:00"})
    with pytest.raises(ValueError):
        ea.write_settings({"window_start": "13:00"})                   # 저장된 끝(12:00)보다 늦음


def test_read_settings_ignores_broken_values():
    p = ea._SETTINGS_PATH
    p.write_text(json.dumps({"days": [9], "mode": "x", "times": ["99:99"], "interval_minutes": 7,
                             "window_start": "20:00", "window_end": "10:00", "enabled": "no"}), encoding="utf-8")
    assert ea.read_settings() == ea.DEFAULT_SETTINGS
    p.write_text("{깨짐", encoding="utf-8")
    assert ea.read_settings() == ea.DEFAULT_SETTINGS


def test_old_frequency_settings_are_migrated():
    p = ea._SETTINGS_PATH
    p.write_text(json.dumps({"frequency": "weekdays", "time": "15:30", "interval_hours": 6}), encoding="utf-8")
    s = ea.read_settings()
    assert s["enabled"] and s["days"] == [0, 1, 2, 3, 4] and s["mode"] == "times" and s["times"] == ["15:30"]
    p.write_text(json.dumps({"frequency": "hours", "time": "08:00", "interval_hours": 3}), encoding="utf-8")
    s = ea.read_settings()
    assert s["mode"] == "interval" and s["interval_minutes"] == 180 and (s["window_start"], s["window_end"]) == ("00:00", "23:59")
    p.write_text(json.dumps({"frequency": "off", "time": "08:00", "interval_hours": 6}), encoding="utf-8")
    assert ea.read_settings()["enabled"] is False
    p.write_text(json.dumps({"frequency": "daily", "time": "09:00", "interval_hours": 6}), encoding="utf-8")
    s = ea.read_settings()
    assert s["days"] == [0, 1, 2, 3, 4, 5, 6] and s["times"] == ["09:00"]


# ── API ───────────────────────────────────────────────────────────────────

def test_endpoint_admin_only(monkeypatch):
    app_module.app.testing = True
    monkeypatch.setattr(ea, "read", lambda: {"checked_at": "2026-11-06 08:00:05", "total": 3})
    with app_module.app.test_client() as c:
        monkeypatch.setattr(app_module, "is_admin", lambda req=None: False)
        # 로그인 요구 검사는 다른 before_request가 하므로 여기선 관리자 검사만 봄
        monkeypatch.setattr("auth.login_required", lambda: False)
        assert c.get("/api/notifications").status_code == 403
        monkeypatch.setattr(app_module, "is_admin", lambda req=None: True)
        body = c.get("/api/notifications").get_json()
        assert body["ok"] is True and body["total"] == 3
        assert body["slots"] == ["08:00"] and body["settings"]["mode"] == "times"


def test_settings_endpoint_admin_only_and_validates(monkeypatch):
    app_module.app.testing = True
    with app_module.app.test_client() as c:
        monkeypatch.setattr("auth.login_required", lambda: False)
        monkeypatch.setattr(app_module, "is_admin", lambda req=None: False)
        assert c.put("/api/settings/notifications", json={"enabled": False}).status_code == 403
        monkeypatch.setattr(app_module, "is_admin", lambda req=None: True)
        body = c.put("/api/settings/notifications",
                     json={"days": [0, 1, 2, 3, 4], "times": ["09:15", "14:00"]}).get_json()
        assert body["settings"]["days"] == [0, 1, 2, 3, 4] and body["slots"] == ["09:15", "14:00"]
        bad = c.put("/api/settings/notifications", json={"times": ["99:99"]})
        assert bad.status_code == 400 and bad.get_json()["ok"] is False
        body = c.get("/api/notifications").get_json()
        assert body["settings"]["times"] == ["09:15", "14:00"] and "next_check" in body


def test_stored_file_is_valid_json(monkeypatch):
    monkeypatch.setattr(ec, "coverage", lambda force=False: _cov(f=(1, 0, 0)))
    ea.check_now()
    assert json.loads(ea._PATH.read_text(encoding="utf-8"))["total"] == 1


def test_results_changed_after_outside_replacement(tmp_path, monkeypatch):
    """백업 복원처럼 추출 작업 밖에서 결과 엑셀이 바뀌면 알림을 다시 센다(2026-11-10). 쓰는 중(가만히 있지 않음)엔 안 셈"""
    import os
    import paths
    import extract_alerts as ea
    from datetime import datetime, timedelta

    fin, kpi = tmp_path / "f.xlsx", tmp_path / "k.xlsx"
    fin.write_bytes(b"x")
    kpi.write_bytes(b"x")
    monkeypatch.setattr(paths, "FINANCE_EXCEL_PATH", str(fin))
    monkeypatch.setattr(paths, "KPI_EXCEL_PATH", str(kpi))
    now = datetime.now()
    state = {"checked_at": (now - timedelta(hours=1)).strftime("%Y-%m-%d %H:%M:%S")}
    old = (now - timedelta(hours=2)).timestamp()
    os.utime(fin, (old, old))
    os.utime(kpi, (old, old))
    assert not ea.results_changed(now, state)                      # 체크 뒤로 안 바뀜
    recent = (now - timedelta(minutes=10)).timestamp()
    os.utime(fin, (recent, recent))
    assert ea.results_changed(now, state)                          # 체크 뒤 바뀌고 가만히 있음 → 다시 셈
    just = now.timestamp() - 5
    os.utime(fin, (just, just))
    assert not ea.results_changed(now, state)                      # 방금까지 쓰는 중 → 기다림
    assert not ea.results_changed(now, {"checked_at": None})       # 한 번도 체크 안 했으면 _due가 처리
