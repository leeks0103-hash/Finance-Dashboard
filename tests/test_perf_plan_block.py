"""시트 합계 블록(매출/원가/공통원가/인건비/자산/관리비/손익)에서 사업계획 기준 관리비·경상손익을 읽는 규칙(2026-10-27)."""
import pandas as pd

import performance as perf

# 9월 집계 실측 값(천원) — 손익 = 매출 − 원가 − 공통원가 − 인건비 − 관리비(자산 줄은 안 들어감)
_BLOCK = [("매출", 32129100.0), ("원가", 19350640.0), ("공통원가", 2033364.0), ("인건비", 5361140.0),
          ("자산", 770000.0), ("관리비", 4430525.0), ("손익", 953431.0)]


def _raw(block=_BLOCK, lead=2):
    rows = [("프로젝트A", 1.0)] * lead + list(block)
    return pd.DataFrame({"part": [r[0] for r in rows], "plan_initial": [r[1] for r in rows]})


def test_reads_mgmt_and_profit():
    out = perf._plan_mgmt_profit_from_block(_raw(), 32129100.0, 19350640.0)
    assert out == {"mgmt": 4430525.0, "profit": 953431.0, "labor": 5361140.0}


def test_none_when_block_sums_differ_from_project_rows():
    assert perf._plan_mgmt_profit_from_block(_raw(), 32000000.0, 19350640.0) is None


def test_none_when_profit_identity_breaks():
    bad = [(k, v + 5000 if k == "손익" else v) for k, v in _BLOCK]
    assert perf._plan_mgmt_profit_from_block(_raw(bad), 32129100.0, 19350640.0) is None


def test_none_when_block_order_differs_or_missing():
    swapped = [_BLOCK[0], _BLOCK[1], _BLOCK[2], _BLOCK[5], _BLOCK[4], _BLOCK[3], _BLOCK[6]]
    assert perf._plan_mgmt_profit_from_block(_raw(swapped), 32129100.0, 19350640.0) is None
    assert perf._plan_mgmt_profit_from_block(_raw(_BLOCK[:3]), 32129100.0, 19350640.0) is None
