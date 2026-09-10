"""
재무 PPT 파일 구조 검사 스크립트
extract_financial_ppt.py 가 기대하는 테이블 구조와 다른 파일을 식별한다.

기대 구조:
  - 슬라이드 제목에 "[내부용①] 재무관점 필수 데이터" 포함
  - 해당 슬라이드에 테이블 존재
  - 테이블 컬럼 수: 10개(구 템플릿) 또는 11개(신 템플릿, 재경비 컬럼 추가)
  - 컬럼 10개 미만 → 추출 스크립트에서 ValueError 발생 (즉각 실패)
  - 1행: 헤더, 2행~: 데이터
  - 데이터 행 col[0]=프로젝트코드, col[1]=구분, col[2~]=숫자
"""

import os
import re
import sys

BASE_DIR = r"C:\Users\aaa\Desktop\기술교육실_프로젝트 보고서 수집"
TITLE_KEYWORD = "[내부용①] 재무관점 필수 데이터"
MIN_COL_COUNT = 10          # 이 미만이면 추출 스크립트가 ValueError
EXPECTED_COL_COUNTS = {10, 11}  # 정상 범위

# 헤더 1행에 있어야 하는 키워드들 (부분 매칭)
HEADER_KEYWORDS = ["코드", "구분", "매출", "지출", "원가", "인건비", "이익"]

# 숫자로 변환해야 하는 컬럼 인덱스 (0-based, col[2] 이후)
# 구 템플릿: col 2~8 / 신 템플릿: col 2~9
NUMERIC_COL_RANGE_START = 2


def get_shape_all_text(shape):
    """도형 전체 텍스트 추출."""
    try:
        if shape.has_text_frame:
            return " ".join(p.text for p in shape.text_frame.paragraphs).strip()
    except Exception:
        pass
    return ""


def clean_for_numeric(text):
    """숫자 파싱 가능 여부 판단용 정규화."""
    t = text.strip()
    if t in ("", "-", "0"):
        return "0"
    t = t.replace(",", "").replace(" ", "")
    t = t.replace("％", "%").replace("（", "(").replace("）", ")")
    t = t.replace("▲", "-").replace("△", "-").replace("▼", "-").replace("▽", "-")
    t = t.replace("＋", "+").replace("－", "-")
    t = re.sub(r"(?i)%p?$", "", t)
    if t.startswith("(") and t.endswith(")"):
        t = "-" + t[1:-1]
    m = re.search(r"[-+]?\d+(?:\.\d+)?", t)
    return m.group(0) if m else None


def check_pptx(filepath):
    """
    Returns list of issue strings. Empty list = 정상.
    """
    from pptx import Presentation  # import here to keep top-level clean

    issues = []

    try:
        prs = Presentation(filepath)
    except Exception as e:
        return [f"파일 열기 실패: {e}"]

    target_slides = []
    for slide_idx, slide in enumerate(prs.slides, 1):
        full_text = " ".join(get_shape_all_text(shp) for shp in slide.shapes)
        if TITLE_KEYWORD in full_text:
            target_slides.append((slide_idx, slide))

    # ── 1. 대상 슬라이드 없음 ──
    if not target_slides:
        return [f"대상 슬라이드 없음 (키워드 '{TITLE_KEYWORD}' 미발견)"]

    for slide_idx, slide in target_slides:
        tables = [shp.table for shp in slide.shapes if shp.has_table]

        # ── 2. 테이블 없음 ──
        if not tables:
            issues.append(f"슬라이드 {slide_idx}: 테이블 없음")
            continue

        table = tables[0]
        row_count = len(table.rows)
        col_count = len(table.columns)

        # ── 3. 컬럼 수 이상 ──
        if col_count < MIN_COL_COUNT:
            issues.append(
                f"슬라이드 {slide_idx}: 컬럼 수 부족 → {col_count}개 "
                f"(최소 {MIN_COL_COUNT}개 필요, 추출 스크립트 ValueError)"
            )
        elif col_count not in EXPECTED_COL_COUNTS:
            issues.append(
                f"슬라이드 {slide_idx}: 비표준 컬럼 수 → {col_count}개 "
                f"(정상: 10개 또는 11개)"
            )

        # ── 4. 데이터 행 없음 ──
        if row_count < 2:
            issues.append(
                f"슬라이드 {slide_idx}: 데이터 행 없음 (총 {row_count}행, 헤더만 존재)"
            )
            continue

        # ── 5. 헤더 키워드 검사 ──
        header_cells = [c.text.strip() for c in table.rows[0].cells]
        header_text = " ".join(header_cells)
        missing_kw = [kw for kw in HEADER_KEYWORDS if kw not in header_text]
        if missing_kw:
            issues.append(
                f"슬라이드 {slide_idx}: 헤더에서 키워드 누락 {missing_kw} "
                f"/ 실제 헤더: {header_cells}"
            )

        # ── 6. 숫자 컬럼에 파싱 불가 텍스트 검사 ──
        numeric_end = col_count - 1  # 마지막 컬럼(비고)은 제외
        bad_cells = []

        for row_idx in range(1, row_count):  # 헤더 제외
            try:
                cells = [c.text.strip() for c in table.rows[row_idx].cells]
            except Exception:
                continue

            # 프로젝트코드, 구분 모두 비어있으면 빈 행 → 스킵
            if not cells[0] and (len(cells) < 2 or not cells[1]):
                continue

            for col_idx in range(NUMERIC_COL_RANGE_START, min(numeric_end, len(cells))):
                val = cells[col_idx]
                if not val or val in ("-", "0", ""):
                    continue
                parsed = clean_for_numeric(val)
                if parsed is None:
                    bad_cells.append(
                        f"행{row_idx + 1}/열{col_idx + 1}: {repr(val)}"
                    )

        if bad_cells:
            sample = bad_cells[:5]
            suffix = f" 외 {len(bad_cells) - 5}건" if len(bad_cells) > 5 else ""
            issues.append(
                f"슬라이드 {slide_idx}: 숫자 컬럼에 파싱 불가 값 → {sample}{suffix}"
            )

        # ── 7. 컬럼 수 OK인데 값이 밀려있는지 검사 ──
        # 마지막 비고 컬럼 직전(이익율 위치)에 숫자 있어야 하고,
        # 가장 앞 두 컬럼(코드, 구분)은 숫자가 아니어야 함
        if col_count >= MIN_COL_COUNT:
            code_as_number_rows = []
            for row_idx in range(1, row_count):
                try:
                    cells = [c.text.strip() for c in table.rows[row_idx].cells]
                except Exception:
                    continue
                if not cells:
                    continue
                code_val = cells[0]
                if not code_val or code_val in ("-", "0"):
                    continue
                # 프로젝트 코드가 순수 숫자면 의심 (밀림)
                if re.match(r"^\d+$", code_val) and len(code_val) > 6:
                    code_as_number_rows.append(f"행{row_idx + 1}: 코드={repr(code_val)}")

            if code_as_number_rows:
                issues.append(
                    f"슬라이드 {slide_idx}: 프로젝트코드 열에 큰 숫자값 (컬럼 밀림 의심) "
                    f"→ {code_as_number_rows[:3]}"
                )

    return issues


def main():
    if not os.path.isdir(BASE_DIR):
        print(f"[오류] 디렉터리 없음: {BASE_DIR}")
        sys.exit(1)

    from pptx import Presentation  # noqa: F401 — ensure importable

    problem_files = []
    no_target_files = []  # 키워드 없는 PPT (정상적으로 재무 데이터 없는 파일일 수 있음)
    ppt_old_format = []
    total = 0
    errors = []

    for root, _dirs, files in os.walk(BASE_DIR):
        for name in sorted(files):
            if name.startswith("~$"):
                continue
            ext = os.path.splitext(name)[1].lower()
            if ext not in (".ppt", ".pptx"):
                continue

            full_path = os.path.join(root, name)
            rel_path = os.path.relpath(full_path, BASE_DIR)
            total += 1

            if ext == ".ppt":
                ppt_old_format.append(rel_path)
                continue  # python-pptx .ppt 미지원

            issues = check_pptx(full_path)

            if not issues:
                continue  # 정상

            # 키워드 없음은 별도 분류 (재무 데이터 없는 정상 파일일 가능성)
            if len(issues) == 1 and "대상 슬라이드 없음" in issues[0]:
                no_target_files.append(rel_path)
            else:
                problem_files.append((rel_path, issues))

    # ── 결과 출력 ──
    print(f"\n총 검사 파일: {total}개")
    print(f"  - .ppt 구형식(python-pptx 미지원, 건너뜀): {len(ppt_old_format)}개")
    print(f"  - 키워드 '{TITLE_KEYWORD}' 없는 파일 (재무 데이터 없음): {len(no_target_files)}개")
    print(f"  - 구조 이상 파일: {len(problem_files)}개")
    print()

    if not problem_files:
        print("이상 파일 없음")
    else:
        print("=" * 80)
        print("구조 이상 파일 목록")
        print("=" * 80)
        for i, (rel_path, issues) in enumerate(problem_files, 1):
            print(f"\n[{i}] {rel_path}")
            for issue in issues:
                print(f"    - {issue}")

    if ppt_old_format:
        print("\n" + "=" * 80)
        print(".ppt 구형식 파일 목록 (python-pptx 미지원, win32com 필요)")
        print("=" * 80)
        for p in ppt_old_format:
            print(f"  {p}")

    if no_target_files:
        print(f"\n키워드 없는 파일 {len(no_target_files)}개 (재무 슬라이드 없는 것으로 보임):")
        for p in no_target_files:
            print(f"  {p}")

    print(f"\n완료.")


if __name__ == "__main__":
    main()
