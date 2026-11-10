"""추출 알림 — 관리자 상단 바 종 아이콘(2026-11-05).

추출 현황(`extract_coverage.coverage`)의 '아직 안 읽음 · 열기 실패 · 원본 수정됨' 파일 수를 **관리자가 정한 일정**에 세어
`data/extract_alerts.json`에 저장하고, 화면(종 아이콘 배지)은 이 저장값만 읽는다(NAS를 매번 훑지 않음).
세 항목 합이 0이면 배지가 안 뜨고, 0이 아니면 합계가 뜬다.

- **일정은 관리자가 화면(관리자 기능 > 알림 탭)에서 바꿈** — `data/extract_alerts_settings.json`. 세 가지를 따로 정한다:
  · `enabled` 사용 여부
  · `days` 확인하는 요일(0=월 … 6=일) — 화면에선 매일 / 평일 / 주말 / 직접 선택
  · `mode` 방식 — `times`: 정해진 시각(`times`, 하루 1~6개, HH:MM) / `interval`: 시간대(`window_start`~`window_end`) 안에서
    `interval_minutes`마다(시간대 시작 시각부터 간격씩, 끝 시각 이하까지)
  어느 방식이든 **"그날 확인하는 시각 목록"(`day_slots`)으로 풀어서** 같은 규칙으로 판단한다(`_due`·`next_check`).
- 서버가 예정 시각에 꺼져 있었으면 다시 켤 때 놓친 체크를 바로 한 번 실행(`_due`: 가장 최근 예정 시각 이후 성공한 체크가 없으면 지금 체크).
- NAS 접근 실패면 직전 숫자는 그대로 두고 30분 뒤 다시 시도(`_RETRY_SEC`) — 접근이 안 된 걸 '문제 없음'으로 지우지 않음.
- 예약 스레드는 `app.py`의 `__main__`에서만 시작(`start_scheduler`) — 테스트·import 때는 안 돎.
- 예전 설정(`frequency`·`time`·`interval_hours` — 2026-11-05 오전에 잠깐 쓰던 모양)이 파일에 남아 있으면 새 모양으로 바꿔 읽음(`_migrate`).
"""

import json
import logging
import os
import re
import threading
import time
from datetime import date, datetime, time as dtime, timedelta
from pathlib import Path

logger = logging.getLogger(__name__)

_PATH = Path(__file__).parent / "data" / "extract_alerts.json"
_SETTINGS_PATH = Path(__file__).parent / "data" / "extract_alerts_settings.json"
_RETRY_SEC = 30 * 60       # NAS 접근 실패 시 재시도 간격
_TICK_SEC = 60             # 스레드가 시각을 보는 간격

MODES = ("times", "interval")
INTERVAL_CHOICES = (30, 60, 120, 180, 240, 360, 480, 720)   # 분 — 30분 ~ 12시간(하루 한 번은 정해진 시각 방식으로)
MAX_TIMES = 6              # 정해진 시각 방식에서 하루 최대 횟수
DEFAULT_SETTINGS = {
    "enabled": True,
    "days": [0, 1, 2, 3, 4, 5, 6],
    "mode": "times",
    "times": ["08:00"],
    "interval_minutes": 120,
    "window_start": "08:00",
    "window_end": "18:00",
}
_TIME_RE = re.compile(r"^([01]\d|2[0-3]):[0-5]\d$")
_lock = threading.Lock()
_settings_lock = threading.Lock()
_started = False

_KINDS = ("pending", "failed", "modified")   # 아직 안 읽음 / 열기 실패 / 원본 수정됨


def _empty() -> dict:
    zero = {k: 0 for k in _KINDS}
    return {"checked_at": None, "last_attempt": None, "last_error": None,
            "finance": dict(zero), "kpi": dict(zero), "total": 0}


def read() -> dict:
    """저장된 마지막 체크 결과. 파일이 없거나 깨졌으면 0건·미확인(checked_at=None)"""
    try:
        with open(_PATH, encoding="utf-8") as f:
            data = json.load(f)
        if isinstance(data, dict):
            base = _empty()
            base.update({k: data[k] for k in base if k in data})
            return base
    except (OSError, ValueError):
        pass
    return _empty()


def _write(data: dict) -> None:
    _PATH.parent.mkdir(parents=True, exist_ok=True)
    tmp = _PATH.with_name(_PATH.name + ".tmp")
    tmp.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
    os.replace(tmp, _PATH)


def _counts(cov: dict, key: str) -> dict:
    part = cov.get(key) or {}
    c = part.get("counts") or {}
    return {"pending": int(c.get("pending", 0)), "failed": int(c.get("failed", 0)),
            "modified": int(part.get("modified_count", 0))}


def check_now() -> dict:
    """추출 현황을 NAS에서 새로 훑어 세 항목을 세고 저장. 접근 실패면 직전 숫자를 두고 시도 시각·이유만 기록"""
    import extract_coverage
    now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    with _lock:
        prev = read()
        try:
            cov = extract_coverage.coverage(force=True)
        except Exception as e:   # noqa: BLE001 — 스레드가 죽지 않게. 상세는 로그
            logger.exception("추출 알림 체크 실패")
            cov = {"ok": False, "error": str(e)}
        if not cov.get("ok"):
            prev.update(last_attempt=now, last_error=str(cov.get("error") or "추출 현황을 읽지 못했습니다"))
            _write(prev)
            return prev
        fin, kpi = _counts(cov, "finance"), _counts(cov, "kpi")
        data = {"checked_at": now, "last_attempt": now, "last_error": None, "finance": fin, "kpi": kpi,
                "total": sum(fin.values()) + sum(kpi.values())}
        _write(data)
    logger.info("추출 알림 체크: 합계 %d건 (재무 %s · KPI %s)", data["total"], fin, kpi)
    return data


# ── 설정(요일·방식·시각) ───────────────────────────────────────────────────

def _valid_time(v) -> bool:
    return isinstance(v, str) and bool(_TIME_RE.match(v))


def _clean_days(v) -> "list[int] | None":
    if not isinstance(v, list) or not v:
        return None
    if any(isinstance(d, bool) or not isinstance(d, int) or not 0 <= d <= 6 for d in v):
        return None
    return sorted(set(v))


def _clean_times(v) -> "list[str] | None":
    if not isinstance(v, list) or not 1 <= len(v) <= MAX_TIMES or not all(_valid_time(t) for t in v):
        return None
    return sorted(set(v))


def _migrate(saved: dict) -> dict:
    """예전 모양(frequency/time/interval_hours)을 새 모양으로 — 오전에 잠깐 쓰던 설정이 파일에 남아 있을 때"""
    if "frequency" not in saved:
        return saved
    out = dict(saved)
    freq = saved.get("frequency")
    out["enabled"] = freq != "off"
    out["days"] = [0, 1, 2, 3, 4] if freq == "weekdays" else [0, 1, 2, 3, 4, 5, 6]
    if freq == "hours":
        h = saved.get("interval_hours")
        out["mode"] = "interval"
        out["interval_minutes"] = h * 60 if isinstance(h, int) and not isinstance(h, bool) else 360
        out["window_start"], out["window_end"] = "00:00", "23:59"
    else:
        out["mode"] = "times"
        out["times"] = [saved["time"]] if _valid_time(saved.get("time")) else ["08:00"]
    return out


def read_settings() -> dict:
    """저장된 일정. 파일이 없거나 깨졌거나 값이 이상하면 항목별로 기본값(매일 08:00 한 번)"""
    out = {k: (list(v) if isinstance(v, list) else v) for k, v in DEFAULT_SETTINGS.items()}
    try:
        saved = json.loads(_SETTINGS_PATH.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return out
    if not isinstance(saved, dict):
        return out
    saved = _migrate(saved)
    if isinstance(saved.get("enabled"), bool):
        out["enabled"] = saved["enabled"]
    if (d := _clean_days(saved.get("days"))) is not None:
        out["days"] = d
    if saved.get("mode") in MODES:
        out["mode"] = saved["mode"]
    if (t := _clean_times(saved.get("times"))) is not None:
        out["times"] = t
    if saved.get("interval_minutes") in INTERVAL_CHOICES and not isinstance(saved.get("interval_minutes"), bool):
        out["interval_minutes"] = saved["interval_minutes"]
    ws, we = saved.get("window_start"), saved.get("window_end")
    if _valid_time(ws) and _valid_time(we) and ws < we:
        out["window_start"], out["window_end"] = ws, we
    return out


def write_settings(patch: dict) -> dict:
    """바꾼 항목만 받아 검증 후 저장(나머지는 저장돼 있던 값 유지). 잘못된 값이면 ValueError(메시지는 화면에 그대로 보여도 됨)"""
    if not isinstance(patch, dict):
        raise ValueError("잘못된 요청입니다")
    with _settings_lock:
        cur = read_settings()
        for k, v in patch.items():
            if k == "enabled":
                if not isinstance(v, bool):
                    raise ValueError("사용 여부는 true/false여야 합니다")
                cur[k] = v
            elif k == "days":
                days = _clean_days(v)
                if days is None:
                    raise ValueError("요일은 월~일(0~6) 중 하나 이상이어야 합니다")
                cur[k] = days
            elif k == "mode":
                if v not in MODES:
                    raise ValueError("방식은 정해진 시각(times)이나 일정 간격(interval)이어야 합니다")
                cur[k] = v
            elif k == "times":
                times = _clean_times(v)
                if times is None:
                    raise ValueError(f"확인 시각은 HH:MM(24시간제) 1~{MAX_TIMES}개여야 합니다")
                cur[k] = times
            elif k == "interval_minutes":
                if isinstance(v, bool) or v not in INTERVAL_CHOICES:
                    raise ValueError(f"간격은 {', '.join(map(str, INTERVAL_CHOICES))}분 중 하나여야 합니다")
                cur[k] = v
            elif k in ("window_start", "window_end"):
                if not _valid_time(v):
                    raise ValueError("시간대는 HH:MM(24시간제) 형식이어야 합니다")
                cur[k] = v
            else:
                raise ValueError(f"알 수 없는 설정: {k}")
        if cur["window_start"] >= cur["window_end"]:
            raise ValueError("확인 시간대의 시작은 끝보다 빨라야 합니다")
        _SETTINGS_PATH.parent.mkdir(parents=True, exist_ok=True)
        tmp = _SETTINGS_PATH.with_name(_SETTINGS_PATH.name + ".tmp")
        tmp.write_text(json.dumps(cur, ensure_ascii=False, indent=2), encoding="utf-8")
        os.replace(tmp, _SETTINGS_PATH)
    logger.info("[추출 알림 설정] 변경 %s", cur)
    return cur


# ── 언제 체크하나 ──────────────────────────────────────────────────────────

def _parse(s: "str | None") -> "datetime | None":
    try:
        return datetime.strptime(s, "%Y-%m-%d %H:%M:%S") if s else None
    except ValueError:
        return None


def _hm(s: str) -> int:
    return int(s[:2]) * 60 + int(s[3:])


def day_slots(settings: dict) -> "list[str]":
    """하루에 확인하는 시각 목록("HH:MM", 오름차순) — 정해진 시각이면 그대로, 일정 간격이면 시간대 시작부터 간격씩 끝 시각 이하까지.
    화면은 이 목록으로 "하루 3회 · 08:00 · 12:00 · 16:00"을 보여 줌(계산은 여기서)"""
    if settings["mode"] == "times":
        return sorted(settings["times"])
    start, end, step = _hm(settings["window_start"]), _hm(settings["window_end"]), settings["interval_minutes"]
    return [f"{m // 60:02d}:{m % 60:02d}" for m in range(start, end + 1, step)]


def _slot_dt(day: date, hm: str) -> datetime:
    return datetime.combine(day, dtime(int(hm[:2]), int(hm[3:])))


def _last_slot(now: datetime, settings: dict) -> "datetime | None":
    """지금까지 가장 최근 예정 시각 — 이 시각 이후 성공한 체크가 없으면 놓친 것"""
    slots = day_slots(settings)
    for back in range(0, 8):
        day = now.date() - timedelta(days=back)
        if day.weekday() not in settings["days"]:
            continue
        past = [s for s in (_slot_dt(day, hm) for hm in slots) if s <= now]
        if past:
            return max(past)
    return None


def _due(now: datetime, state: dict, settings: "dict | None" = None) -> bool:
    """지금 체크해야 하나.
    · 끔 → 안 함
    · 직전 시도가 실패였으면 `_RETRY_SEC`가 지난 뒤에만(NAS가 막힌 동안 계속 두드리지 않게)
    · 한 번도 안 했으면 예정 시각을 기다리지 않고 지금(첫 배포 직후 종이 비어 있지 않게)
    · 그 외 → 가장 최근 예정 시각 이후 성공한 체크가 없을 때(서버가 그 시각에 꺼져 있었어도 켜질 때 잡힘)"""
    st = settings or DEFAULT_SETTINGS
    if not st["enabled"]:
        return False
    tried = _parse(state.get("last_attempt"))
    if tried and state.get("last_error") and (now - tried).total_seconds() < _RETRY_SEC:
        return False
    done = _parse(state.get("checked_at"))
    if done is None:
        return True
    slot = _last_slot(now, st)
    return slot is not None and done < slot


def next_check(now: datetime, state: dict, settings: "dict | None" = None) -> "str | None":
    """화면에 보여 줄 '다음 확인' 시각(YYYY-MM-DD HH:MM) — 끔이면 None. 지금 해야 하는 상태면 지금(곧 체크됨)"""
    st = settings or DEFAULT_SETTINGS
    fmt = "%Y-%m-%d %H:%M"
    if not st["enabled"]:
        return None
    if _due(now, state, st):
        return now.strftime(fmt)
    slots = day_slots(st)
    for ahead in range(0, 9):
        day = now.date() + timedelta(days=ahead)
        if day.weekday() not in st["days"]:
            continue
        future = [s for s in (_slot_dt(day, hm) for hm in slots) if s > now]
        if future:
            return min(future).strftime(fmt)
    return None


_SETTLE_SEC = 45   # 결과 엑셀이 이만큼 가만히 있은 뒤에야 다시 셈(추출 중 중간 저장마다 세지 않게)


def results_changed(now: datetime, state: dict) -> bool:
    """마지막 체크 뒤에 결과 엑셀(재무·KPI)이 바뀌었나(그리고 지금은 가만히 있나) — 추출 작업 밖에서 파일이 바뀐 경우
    (백업에서 복원·사람이 직접 교체 등)에도 알림 숫자를 다시 세기 위함. 2026-11-10: 복원했는데 종 알림은 '아직 안 읽음 264'가
    그대로였음(숫자는 마지막 체크 시점 저장값이라 추출 작업이 끝날 때만 갱신됐음)"""
    import paths
    from shared import safe_mtime
    done = _parse(state.get("checked_at"))
    if done is None:
        return False
    for p in (paths.FINANCE_EXCEL_PATH, paths.KPI_EXCEL_PATH):
        mt = safe_mtime(str(p))
        if mt and datetime.fromtimestamp(mt) > done and (now.timestamp() - mt) >= _SETTLE_SEC:
            return True
    return False


def _loop() -> None:
    while True:
        try:
            now, state, st = datetime.now(), read(), read_settings()
            if _due(now, state, st) or (st["enabled"] and results_changed(now, state)):
                check_now()
        except Exception:   # noqa: BLE001
            logger.exception("추출 알림 예약 확인 실패")
        time.sleep(_TICK_SEC)


def start_scheduler() -> None:
    """예약 체크 스레드 시작(한 번만). 켜질 때 놓친 체크가 있으면 첫 바퀴에서 바로 실행"""
    global _started
    with _lock:
        if _started:
            return
        _started = True
    threading.Thread(target=_loop, name="extract-alerts", daemon=True).start()
