import pandas as pd
import pytest

import finance
from app import app as flask_app


@pytest.fixture
def client():
    flask_app.testing = True
    with flask_app.test_client() as c:
        yield c


@pytest.fixture
def make_finance_excel(tmp_path):
    """finance.EXCEL_COLS 순서의 row 리스트를 받아 '취합' 시트 xlsx 파일을 만들고 경로를 반환."""
    def _make(rows, filename="test.xlsx"):
        df = pd.DataFrame(rows, columns=finance.EXCEL_COLS)
        path = tmp_path / filename
        df.to_excel(path, sheet_name="취합", index=False, engine="openpyxl")
        return str(path)
    return _make


@pytest.fixture
def load_finance_fixture(monkeypatch, make_finance_excel):
    """rows를 임시 엑셀로 만들어 finance.EXCEL_PATH를 그쪽으로 돌리고 load_excel()을 실행."""
    def _load(rows, filename="test.xlsx"):
        path = make_finance_excel(rows, filename)
        monkeypatch.setattr(finance, "EXCEL_PATH", path)
        return finance.load_excel()
    return _load
