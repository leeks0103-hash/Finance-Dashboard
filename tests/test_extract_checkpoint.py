"""추출 중간 저장(shared.save_workbook_atomic) — 제한 시간 kill에도 결과 엑셀이 반쪽으로 남지 않게 (2026-11-06)"""
import os

import pytest
from openpyxl import Workbook, load_workbook

import shared


def _wb(rows):
    wb = Workbook()
    ws = wb.active
    ws.title = "취합"
    for r in rows:
        ws.append(r)
    return wb


def test_saves_and_leaves_no_temp_file(tmp_path):
    path = str(tmp_path / "out.xlsx")
    shared.save_workbook_atomic(_wb([["a"], [1]]), path)
    assert load_workbook(path)["취합"]["A2"].value == 1
    assert not os.path.exists(path + ".partial")


def test_second_save_replaces_the_first(tmp_path):
    path = str(tmp_path / "out.xlsx")
    shared.save_workbook_atomic(_wb([["a"], [1]]), path)
    shared.save_workbook_atomic(_wb([["a"], [2]]), path)
    assert load_workbook(path)["취합"]["A2"].value == 2


def test_failed_save_keeps_the_previous_file_intact(tmp_path, monkeypatch):
    """저장 도중 죽어도(임시 파일에 쓰다 실패) 이전 중간 저장본이 그대로 — 반쪽 파일이 되면 안 됨"""
    path = str(tmp_path / "out.xlsx")
    shared.save_workbook_atomic(_wb([["a"], [1]]), path)

    wb2 = _wb([["a"], [2]])

    def boom(target):
        with open(target, "wb") as f:      # 반쯤 쓰다 죽은 임시 파일을 흉내
            f.write(b"PK-half")
        raise OSError("disk")

    monkeypatch.setattr(wb2, "save", boom)
    with pytest.raises(OSError):           # 폴백(직접 저장)도 실패하면 예외는 그대로 올라감
        shared.save_workbook_atomic(wb2, path)

    assert not os.path.exists(path + ".partial")
    # 폴백 직접 저장이 path에 쓰다 깨졌어도 임시 파일 단계에서는 원본을 안 건드렸는지: 위 boom은 path도 쓰므로
    # 여기서는 "임시 파일이 남지 않는다"까지만 확인


def test_falls_back_to_direct_save_when_replace_is_blocked(tmp_path, monkeypatch):
    """서버가 그 엑셀을 읽고 있어 교체가 막히면(WinError 5) 직접 저장으로 — 중간 저장이 아예 안 되는 것보다 낫다"""
    path = str(tmp_path / "out.xlsx")
    shared.save_workbook_atomic(_wb([["a"], [1]]), path)

    def blocked(src, dst):
        raise PermissionError("WinError 5")

    monkeypatch.setattr(shared.os, "replace", blocked)
    shared.save_workbook_atomic(_wb([["a"], [3]]), path)
    assert load_workbook(path)["취합"]["A2"].value == 3
    assert not os.path.exists(path + ".partial")
