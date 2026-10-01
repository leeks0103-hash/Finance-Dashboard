"""추출 현황(extract_coverage) — 폴더 파일 목록과 처리이력·취합을 대조해 파일별 상태를 제대로 나누는지."""
import pandas as pd

import extract_coverage as ec


def _run(monkeypatch, tmp_path, hist_rows, data_files, folder_files):
    excel = tmp_path / "out.xlsx"
    excel.write_bytes(b"")   # 존재 여부만 봄 — 실제 읽기는 아래 가짜 read_sheet_cached
    hist = pd.DataFrame(hist_rows, columns=["파일명", "처리상태", "메시지", "처리일시", "전체경로"])
    data = pd.DataFrame({"원본파일명": data_files})
    sheets = {"처리이력": hist, "취합": data}
    monkeypatch.setitem(ec.SOURCES["finance"], "excel", str(excel))
    monkeypatch.setattr(ec, "read_sheet_cached", lambda path, sheet: sheets.get(sheet))
    return ec._source_coverage("finance", folder_files)


def test_statuses(monkeypatch, tmp_path):
    drm = tmp_path / "drm.pptx"
    drm.write_bytes(b"SCDSA004" + b"\0" * 10)
    res = _run(
        monkeypatch, tmp_path,
        hist_rows=[
            ["a.pptx", "SUCCESS", "추출 2건", "2026-09-30 10:00:00", ""],
            ["b.pptx", "SUCCESS", "조건에 맞는 표 데이터 없음", "2026-09-30 10:00:01", ""],
            ["c.pptx", "SUCCESS", "추출 1건 / 추가 1건", "2026-09-30 10:00:02", ""],
            ["d.pptx", "FAIL", "com_error", "2026-09-30 10:00:03", str(drm)],
            # 같은 파일이 다시 처리되면 마지막 것이 기준 — e는 실패했다가 성공
            ["e.pptx", "FAIL", "일시 오류", "2026-09-30 09:00:00", ""],
            ["e.pptx", "SUCCESS", "추출 1건", "2026-09-30 11:00:00", ""],
        ],
        data_files=["a.pptx", "a.pptx", "e.pptx", "gone.pptx"],
        folder_files=["a.pptx", "b.pptx", "c.pptx", "d.pptx", "e.pptx", "new.pptx"],
    )
    by = {it["file"]: it for it in res["items"]}
    assert by["a.pptx"]["status"] == "extracted" and by["a.pptx"]["rows"] == 2
    assert by["b.pptx"]["status"] == "no_table"
    assert by["c.pptx"]["status"] == "merged"
    assert by["d.pptx"]["status"] == "failed" and "SoftCamp" in by["d.pptx"]["reason"]
    assert by["e.pptx"]["status"] == "extracted"
    assert by["new.pptx"]["status"] == "pending"
    assert res["folder_files"] == 6
    assert res["counts"] == {"extracted": 2, "merged": 1, "no_table": 1, "failed": 1, "pending": 1}
    # 취합 행 수는 파일 수와 별개 — 결과에만 있는 파일(gone)도 행으로 셈
    assert res["rows_total"] == 4
    assert res["orphans"] == ["gone.pptx"]


def test_duplicate_names_counted(monkeypatch, tmp_path):
    res = _run(monkeypatch, tmp_path, hist_rows=[], data_files=[], folder_files=["x.pptx", "x.pptx", "y.pptx"])
    assert res["duplicate_names"] == 1
    assert res["folder_files"] == 3
    assert res["counts"]["pending"] == 2   # 이름 기준 2개(x, y)
