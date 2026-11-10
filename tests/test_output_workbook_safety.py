"""추출 결과 엑셀이 안 열려도(보안 암호화 등) 이력을 지우지 않는다 — 2026-11-10 사고 재발 방지."""
import os

import pytest
from openpyxl import Workbook, load_workbook

import shared

OLE2 = b"\xd0\xcf\x11\xe0\xa1\xb1\x1a\xe1" + b"\x00" * 64


def _make(path, rows=5):
    wb = Workbook()
    ws = wb.active
    ws.title = "취합"
    ws.append(["코드", "파일명"])
    for i in range(rows):
        ws.append([f"C{i}", f"f{i}.pptx"])
    wb.save(path)


def test_normal_file_loads(tmp_path):
    p = str(tmp_path / "out.xlsx")
    _make(p)
    wb, status = shared.load_output_workbook(p, lambda m: None)
    assert status == "loaded" and wb["취합"].max_row == 6


def test_missing_file_is_new(tmp_path):
    wb, status = shared.load_output_workbook(str(tmp_path / "none.xlsx"), lambda m: None)
    assert wb is None and status == "new"


@pytest.mark.parametrize("content", [b"not a zip at all", OLE2])
def test_unreadable_file_is_kept_and_extraction_stops(tmp_path, content, monkeypatch):
    p = tmp_path / "out.xlsx"
    p.write_bytes(content)

    class _NoExcel:   # 이 PC에 Excel이 없거나 못 여는 상황
        def __init__(self, *a, **k):
            raise OSError("no excel")

    monkeypatch.setattr(shared, "ComExcelFile", _NoExcel)
    logs = []
    with pytest.raises(RuntimeError):
        shared.load_output_workbook(str(p), logs.append)
    assert p.read_bytes() == content                      # 원본은 그대로
    assert any(f.startswith("out.열기실패_") for f in os.listdir(tmp_path / "backup"))   # 백업도 있음


def test_reset_mode_may_recreate_but_keeps_backup(tmp_path):
    p = tmp_path / "out.xlsx"
    p.write_bytes(b"garbage")
    wb, status = shared.load_output_workbook(str(p), lambda m: None, allow_recreate=True)
    assert wb is None and status == "recreated"
    assert os.listdir(tmp_path / "backup")


def test_encrypted_file_is_recovered_through_excel(tmp_path, monkeypatch):
    p = tmp_path / "out.xlsx"
    p.write_bytes(OLE2)

    class _FakeCom:
        def __init__(self, path):
            self.sheet_names = ["취합", "처리이력"]

        def __enter__(self):
            return self

        def __exit__(self, *a):
            pass

        def _sheet_values(self, name):
            return [["코드", "파일명"], ["C1", "a.pptx"], ["C2", None]] if name == "취합" else [["파일명"], ["a.pptx"]]

    monkeypatch.setattr(shared, "ComExcelFile", _FakeCom)
    wb, status = shared.load_output_workbook(str(p), lambda m: None)
    assert status == "recovered"
    assert wb.sheetnames == ["취합", "처리이력"]
    assert [c.value for c in wb["취합"][2]] == ["C1", "a.pptx"]
    assert p.read_bytes() == OLE2   # 원본 파일은 건드리지 않음


def test_backup_keeps_only_latest(tmp_path):
    p = str(tmp_path / "out.xlsx")
    _make(p)
    import time
    for _ in range(4):
        shared.backup_output_file(p, keep=2)
        time.sleep(1.05)
    names = [f for f in os.listdir(tmp_path / "backup") if f.startswith("out_")]
    assert len(names) == 2
    load_workbook(str(tmp_path / "backup" / names[0]))   # 복사본이 열림
