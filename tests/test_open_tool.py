"""파일 열기 — 서버는 열지 않고 열기 주소만 돌려준다(2026-11-06).

예전엔 서버 PC에서 os.startfile/explorer로 직접 열어서, 다른 PC 접속자가 눌러도 서버 PC에서 열렸음.
이제는 응답의 open_url(hmcopen://…)을 브라우저가 각 PC의 '파일 열기 도구'(tools/HmcOpen)에 넘긴다.
"""
import base64
import io
import os
import shutil
import subprocess
import sys
import zipfile

import pytest

import paths
import shared

NAS_FILE = "\\\\10.206.32.3\\기술교육팀\\1. 실 공통\\5. 보고서 수집\\26년_테스트 사업_완료.pptx"


def _decode(url: str) -> str:
    kind, token = url.removeprefix("hmcopen://").split("/", 1)
    token += "=" * (-len(token) % 4)
    return kind, base64.urlsafe_b64decode(token).decode("utf-8")


@pytest.fixture
def pptx(tmp_path):
    p = tmp_path / "보고서 폴더" / "26년_테스트 사업_완료.pptx"
    p.parent.mkdir()
    p.write_bytes(b"PK\x03\x04 not drm")
    return str(p)


@pytest.fixture
def no_server_launch(monkeypatch):
    """서버가 파일을 직접 실행하려 하면 즉시 실패 — 이게 이번 수정의 핵심"""
    def boom(*a, **k):
        raise AssertionError("서버가 파일/탐색기를 직접 실행하면 안 됨")
    if hasattr(os, "startfile"):
        monkeypatch.setattr(os, "startfile", boom)
    monkeypatch.setattr(subprocess, "Popen", boom)


# ── open_source_file ──────────────────────────────────────────────────────────

def test_file_open_returns_url_and_does_not_start_anything(pptx, no_server_launch):
    body, status = shared.open_source_file(pptx)
    assert status == 200 and body["ok"] is True
    kind, path = _decode(body["open_url"])
    assert kind == "f" and path == os.path.normpath(pptx)


def test_folder_open_returns_folder_url_and_does_not_start_explorer(pptx, no_server_launch):
    body, status = shared.open_source_file(pptx, folder=True)
    assert status == 200
    kind, path = _decode(body["open_url"])
    assert kind == "d" and path == os.path.normpath(pptx)


def test_check_only_does_not_return_open_url(pptx, no_server_launch):
    for folder in (False, True):
        body, status = shared.open_source_file(pptx, check_only=True, folder=folder)
        assert status == 200 and body == {"ok": True, "checked": True}


def test_missing_path_is_404(no_server_launch, tmp_path):
    body, status = shared.open_source_file(str(tmp_path / "없음.pptx"))
    assert status == 404 and body["ok"] is False and "open_url" not in body
    assert shared.open_source_file(None)[1] == 404


def test_drm_file_is_still_blocked_even_for_remote_open(pptx, monkeypatch):
    monkeypatch.setattr(shared, "is_drm_file", lambda p: True)
    for check in (True, False):
        body, status = shared.open_source_file(pptx, check_only=check)
        assert status == 403 and body["blocked"] is True and "open_url" not in body


# ── 열람 경고(2026-11-06) — 막지 않고 "N분 전 ○○님이 열었습니다"를 알려 줌 ──────────────

ME = {"emp": "1001", "name": "김하나"}
OTHER = {"emp": "2002", "name": "박둘"}


@pytest.fixture
def history(tmp_path, monkeypatch):
    """열람 기록 파일을 임시 위치로, 잠금파일은 없는 것으로 — 실제 data/를 건드리지 않음"""
    monkeypatch.setattr(shared, "OPEN_HISTORY_PATH", str(tmp_path / "open_history.json"))
    monkeypatch.setattr(shared, "is_file_locked", lambda p: False)
    return tmp_path


def _at(monkeypatch, minutes_later):
    """shared 안의 시계를 지금보다 minutes_later분 뒤로"""
    import time
    import types
    t0 = time.time()
    monkeypatch.setattr(shared, "time", types.SimpleNamespace(time=lambda: t0 + minutes_later * 60 + 3))


def test_lock_alone_does_not_block_anymore_but_warns(pptx, history, monkeypatch):
    monkeypatch.setattr(shared, "is_file_locked", lambda p: True)
    body, status = shared.open_source_file(pptx, check_only=True, opener=ME)
    assert status == 200 and body["ok"] is True and body["checked"] is True
    assert body["notice"]["kind"] == "locked" and "name" not in body["notice"]
    # 확인 뒤 실제 열기도 막지 않음 — 남은 잠금파일에 영영 막히던 문제
    body, status = shared.open_source_file(pptx, opener=ME)
    assert status == 200 and "open_url" in body


def test_recent_open_by_other_warns_with_name_and_minutes(pptx, history, monkeypatch):
    shared.open_source_file(pptx, opener=OTHER)
    _at(monkeypatch, 5)
    body, _ = shared.open_source_file(pptx, check_only=True, opener=ME)
    n = body["notice"]
    assert n["kind"] == "recent" and n["name"] == "박둘" and n["minutes"] == 5 and n["locked"] is False
    assert "5분 전 박둘님이 이 파일을 열었습니다" in n["message"] and "닫았을 수도" in n["message"]


def test_recent_open_with_lock_says_still_open(pptx, history, monkeypatch):
    shared.open_source_file(pptx, opener=OTHER)
    monkeypatch.setattr(shared, "is_file_locked", lambda p: True)
    body, _ = shared.open_source_file(pptx, check_only=True, opener=ME)
    assert body["notice"]["locked"] is True and "지금도 열려 있는" in body["notice"]["message"]
    assert "방금 전" in body["notice"]["message"]


def test_notice_goes_away_after_30_minutes(pptx, history, monkeypatch):
    shared.open_source_file(pptx, opener=OTHER)
    _at(monkeypatch, 29)
    assert "notice" in shared.open_source_file(pptx, check_only=True, opener=ME)[0]
    _at(monkeypatch, 31)
    body, status = shared.open_source_file(pptx, check_only=True, opener=ME)
    assert status == 200 and body == {"ok": True, "checked": True}


def test_own_recent_open_does_not_warn_me(pptx, history):
    shared.open_source_file(pptx, opener=ME)
    body, _ = shared.open_source_file(pptx, check_only=True, opener=ME)
    assert "notice" not in body


def test_check_only_and_folder_open_and_anonymous_open_record_nothing(pptx, history):
    shared.open_source_file(pptx, check_only=True, opener=OTHER)
    shared.open_source_file(pptx, folder=True, opener=OTHER)
    shared.open_source_file(pptx, opener=None)
    assert "notice" not in shared.open_source_file(pptx, check_only=True, opener=ME)[0]
    assert not os.path.exists(shared.OPEN_HISTORY_PATH)


def test_latest_opener_wins_and_old_records_are_pruned(pptx, history, monkeypatch, tmp_path):
    other_file = tmp_path / "다른 파일.pptx"
    other_file.write_bytes(b"PK")
    shared.open_source_file(str(other_file), opener=OTHER)
    _at(monkeypatch, 40)   # 40분 뒤 — 위 기록은 오래됨
    shared.open_source_file(pptx, opener=OTHER)
    import json
    with open(shared.OPEN_HISTORY_PATH, encoding="utf-8") as f:
        saved = json.load(f)
    assert len(saved) == 1   # 오래된 파일 기록은 이때 정리됨


def test_drm_still_blocked_even_with_opener(pptx, history, monkeypatch):
    monkeypatch.setattr(shared, "is_drm_file", lambda p: True)
    body, status = shared.open_source_file(pptx, check_only=True, opener=ME)
    assert status == 403 and body["blocked"] is True and "notice" not in body


def test_current_opener_prefers_account_name_then_roster_then_emp(monkeypatch):
    import auth
    monkeypatch.setattr(shared, "_roster_names", lambda: {"1001": "김하나"})
    monkeypatch.setattr(auth, "current_user", lambda req=None: {"emp_no": "1001", "name": "1001", "role": "user"})
    assert shared.current_opener() == {"emp": "1001", "name": "김하나"}          # 계정엔 사번뿐 → 명단 이름
    monkeypatch.setattr(auth, "current_user", lambda req=None: {"emp_no": "1001", "name": "홍길동", "role": "user"})
    assert shared.current_opener() == {"emp": "1001", "name": "홍길동"}          # 계정 이름이 있으면 그대로
    monkeypatch.setattr(shared, "_roster_names", lambda: {})
    monkeypatch.setattr(auth, "current_user", lambda req=None: {"emp_no": "3003", "name": "3003", "role": "user"})
    assert shared.current_opener() == {"emp": "3003", "name": "3003"}            # 명단에도 없으면 사번
    monkeypatch.setattr(auth, "current_user", lambda req=None: None)
    assert shared.current_opener() is None


def test_open_routes_pass_the_logged_in_user_so_the_next_person_is_warned(client, pptx, history, monkeypatch):
    """실제 라우트로 — 한 사람이 열면 다음 사람이 확인할 때 이름이 보임"""
    import auth
    import finance
    monkeypatch.setattr(finance, "find_source_path", lambda *a, **k: pptx)
    users = iter([{"emp_no": "2002", "name": "박둘", "role": "user"},   # 열기
                  {"emp_no": "1001", "name": "김하나", "role": "user"}])  # 확인
    monkeypatch.setattr(auth, "current_user", lambda req=None: next(users))
    assert client.post("/api/finance/open-file", json={"filename": "x.pptx"}).get_json()["open_url"]
    body = client.post("/api/finance/open-file", json={"filename": "x.pptx", "check": True}).get_json()
    assert body["notice"]["name"] == "박둘" and body["notice"]["kind"] == "recent"


def test_url_is_ascii_only_and_short_enough_for_korean_unc_path():
    url = shared.build_open_url(NAS_FILE)
    assert url.isascii() and "=" not in url and " " not in url
    assert len(url) < 1000
    assert _decode(url)[1] == os.path.normpath(NAS_FILE)


# ── 설치 파일 zip ─────────────────────────────────────────────────────────────

def _zip(client, query=""):
    res = client.get("/api/open-tool/download" + query)
    assert res.status_code == 200
    assert res.mimetype == "application/zip"
    return zipfile.ZipFile(io.BytesIO(res.data))


def test_download_zip_has_tool_files_and_generated_root(client):
    z = _zip(client)
    names = set(z.namelist())
    assert {"HmcOpen/install.bat", "HmcOpen/install.ps1", "HmcOpen/open.ps1",
            "HmcOpen/launch.vbs", "HmcOpen/uninstall.bat", "HmcOpen/root.txt"} <= names
    assert z.read("HmcOpen/root.txt").decode("utf-8").strip() == paths.PPT_SOURCE_DIR
    assert "HmcOpen/url.txt" not in names          # origin을 안 보내면 생략


def test_download_zip_includes_dashboard_origin_when_valid(client):
    z = _zip(client, "?origin=http://10.206.33.120:5188")
    assert z.read("HmcOpen/url.txt").decode("utf-8").strip() == "http://10.206.33.120:5188"


@pytest.mark.parametrize("origin", [
    "javascript:alert(1)", "http://evil.com/path", "http://a b", "file:///c:/x", "http://h:1?x=1", "ftp://h",
])
def test_download_zip_ignores_bad_origin(client, origin):
    assert "HmcOpen/url.txt" not in _zip(client, "?origin=" + origin).namelist()


@pytest.mark.parametrize("name", ["open.ps1", "install.ps1"])
def test_powershell_scripts_have_utf8_bom(name):
    # BOM이 없으면 Windows PowerShell 5.1이 한글 메시지를 깨뜨림
    path = os.path.join(os.path.dirname(paths.__file__), "tools", "HmcOpen", name)
    assert open(path, "rb").read(3) == b"\xef\xbb\xbf"


# ── open.ps1(PC 쪽 핸들러) 검증 — 열기 전에 거절하는 경우만(실제 열기는 앱이 떠서 자동 테스트 안 함) ──────────

POWERSHELL = shutil.which("powershell")


@pytest.mark.skipif(sys.platform != "win32" or not POWERSHELL, reason="Windows PowerShell 필요")
class TestHandler:
    @pytest.fixture
    def tool(self, tmp_path):
        d = tmp_path / "tool"
        d.mkdir()
        src = os.path.join(os.path.dirname(paths.__file__), "tools", "HmcOpen", "open.ps1")
        shutil.copy(src, d / "open.ps1")
        # 실제 허용 폴더(NAS 보고서 폴더)처럼 한글·공백이 든 경로로 — root.txt를 UTF-8로 읽는 부분까지 검증
        root = tmp_path / "1. 실 공통" / "5. 보고서 수집"
        (root / "sub").mkdir(parents=True)
        (d / "root.txt").write_bytes(str(root).encode("utf-8") + b"\r\n")
        return d, root

    def _run(self, tool_dir, url):
        env = dict(os.environ, HMCOPEN_QUIET="1")
        return subprocess.run(
            [POWERSHELL, "-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-File",
             str(tool_dir / "open.ps1"), url],
            capture_output=True, env=env, timeout=60,
        ).returncode

    @staticmethod
    def _url(kind, path):
        return f"hmcopen://{kind}/" + base64.urlsafe_b64encode(str(path).encode("utf-8")).decode().rstrip("=")

    def test_ping_exits_ok(self, tool):
        assert self._run(tool[0], "hmcopen://ping") == 0

    def test_garbage_url_rejected(self, tool):
        assert self._run(tool[0], "hmcopen://x/abc") == 2
        assert self._run(tool[0], "http://example.com") == 2

    def test_path_outside_root_rejected(self, tool, tmp_path):
        outside = tmp_path / "outside.pptx"
        outside.write_bytes(b"x")
        assert self._run(tool[0], self._url("f", outside)) == 2

    def test_dotdot_traversal_rejected(self, tool, tmp_path):
        outside = tmp_path / "outside.pptx"
        outside.write_bytes(b"x")
        sneaky = str(tool[1]) + "\\sub\\..\\..\\..\\outside.pptx"   # root/sub → root → 1. 실 공통 → tmp_path
        assert self._run(tool[0], self._url("f", sneaky)) == 2

    def test_sibling_folder_with_same_prefix_rejected(self, tool, tmp_path):
        evil = tool[1].parent / (tool[1].name + "_evil")   # 허용 폴더 이름으로 시작하지만 다른 폴더
        evil.mkdir()
        (evil / "a.pptx").write_bytes(b"x")
        assert self._run(tool[0], self._url("f", evil / "a.pptx")) == 2

    @pytest.mark.parametrize("name", ["run.exe", "run.bat", "run.ps1", "run.lnk", "run.docx"])
    def test_non_powerpoint_extension_rejected(self, tool, name):
        f = tool[1] / "sub" / name
        f.write_bytes(b"x")
        assert self._run(tool[0], self._url("f", f)) == 2
        assert self._run(tool[0], self._url("d", f)) == 2

    def test_missing_file_inside_root_reports_not_found(self, tool):
        assert self._run(tool[0], self._url("f", tool[1] / "sub" / "없음.pptx")) == 4
