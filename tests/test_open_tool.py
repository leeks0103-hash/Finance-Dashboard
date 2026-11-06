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


def test_locked_file_is_still_blocked(pptx, monkeypatch):
    monkeypatch.setattr(shared, "is_file_locked", lambda p: True)
    body, status = shared.open_source_file(pptx)
    assert status == 409 and body["locked"] is True and "open_url" not in body


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
