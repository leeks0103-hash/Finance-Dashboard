"""
실적(사업계획 통합관리) 엑셀의 월별 시트 헤더를 비교해 컬럼 밀림을 자동 탐지.

지난달 시트와 이번달 시트의 헤더 "라벨 텍스트"를 나란히 놓고 diff(LCS)로 맞춰서:
  - 그대로인 컬럼: 예전 인덱스 -> 새 인덱스 매핑
  - 새로 삽입된 컬럼: 어디에 몇 개 끼어들었는지
  - 사라진 컬럼: 혹시 삭제된 게 있는지
를 보여주고, app.py의 _PERF_COL_MAPS에 바로 붙여넣을 수 있는 코드 초안까지 출력한다.

값(숫자)까지 비교하면 매달 실적 수치가 달라서 매칭이 깨지므로, 라벨 텍스트만 비교한다.
자동 생성된 매핑은 반드시 사람이 눈으로 한 번 확인 후 반영할 것 — 헤더 문구가 우연히
같은 값을 재사용하는 경우(예: "(원가율)"가 여러 번 등장) 오탐 가능성이 있다.

사용법:
  단일 시트 헤더만 보기:
    python scripts/check_perf_headers.py "<엑셀경로>" "<시트명>"

  두 시트 간 밀림 자동 비교 (같은 파일 또는 다른 파일):
    python scripts/check_perf_headers.py "<이전달 경로>" "<이전달 시트>" --vs "<이번달 경로>" "<이번달 시트>"
    python scripts/check_perf_headers.py "<경로>" "<이전달 시트>" --vs "<경로>" "<이번달 시트>"   (같은 파일이면 경로 반복)
"""
import sys, io, os
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
import difflib
import pandas as pd


def read_header_labels(path, sheet):
    """헤더 3행(그룹라벨/서브라벨/값)에서 텍스트 라벨만 추출 (값은 제외 — 매달 달라짐)."""
    df = pd.read_excel(path, sheet_name=sheet, header=None, skiprows=10, nrows=3)
    labels = []
    for c in range(df.shape[1]):
        parts = []
        for r in range(2):  # 0,1행만 = 그룹라벨/서브라벨 텍스트. 2행은 숫자 값이라 제외
            v = df.iloc[r, c]
            if pd.notna(v) and not isinstance(v, (int, float)):
                parts.append(str(v).replace("\n", " ").strip())
        labels.append(" / ".join(parts))
    return labels


def print_single(path, sheet):
    labels = read_header_labels(path, sheet)
    for i, label in enumerate(labels):
        print(f"col{i}: {label}")


def compare(old_path, old_sheet, new_path, new_sheet):
    old_labels = read_header_labels(old_path, old_sheet)
    new_labels = read_header_labels(new_path, new_sheet)

    sm = difflib.SequenceMatcher(a=old_labels, b=new_labels, autojunk=False)
    opcodes = sm.get_opcodes()

    idx_map = {}   # old_idx -> new_idx (동일하다고 판단된 컬럼만)
    report_lines = []

    for tag, i1, i2, j1, j2 in opcodes:
        if tag == "equal":
            for k in range(i2 - i1):
                idx_map[i1 + k] = j1 + k
        elif tag == "insert":
            report_lines.append(
                f"[신규 삽입] new col {j1}~{j2-1}: {new_labels[j1:j2]}"
            )
        elif tag == "delete":
            report_lines.append(
                f"[삭제됨] old col {i1}~{i2-1}: {old_labels[i1:i2]} (새 시트에 대응 없음 — 확인 필요)"
            )
        elif tag == "replace":
            report_lines.append(
                f"[변경/불일치] old col {i1}~{i2-1} {old_labels[i1:i2]} "
                f"-> new col {j1}~{j2-1} {new_labels[j1:j2]}"
            )

    print(f"기존 컬럼수={len(old_labels)}, 신규 컬럼수={len(new_labels)}\n")

    print("=== 변경 사항 ===")
    if not report_lines:
        print("(구조 변경 없음 — 완전히 동일)")
    for line in report_lines:
        print(line)

    print("\n=== 인덱스 이동 요약 (기존idx -> 새idx, shift != 0 인 것만) ===")
    shifted = {k: v for k, v in idx_map.items() if k != v}
    if not shifted:
        print("(밀린 컬럼 없음)")
    else:
        # 연속된 동일 shift 구간을 묶어서 출력
        keys = sorted(shifted.keys())
        start = keys[0]
        prev = keys[0]
        prev_shift = shifted[keys[0]] - keys[0]
        for k in keys[1:]:
            cur_shift = shifted[k] - k
            if k == prev + 1 and cur_shift == prev_shift:
                prev = k
                continue
            print(f"  old col {start}~{prev} : shift {prev_shift:+d}")
            start = prev = k
            prev_shift = cur_shift
        print(f"  old col {start}~{prev} : shift {prev_shift:+d}")

    print("\n=== app.py에 붙여넣을 코드 초안 ===")
    print("_PERF_COL_MAP_NEW = {")
    print("    # 기존 맵 키 -> 새 인덱스로 이동 (자동 생성, 값 검증 후 사용할 것)")
    ranges = []
    if shifted:
        keys = sorted(shifted.keys())
        start = keys[0]; prev = keys[0]; prev_shift = shifted[keys[0]] - keys[0]
        for k in keys[1:]:
            cur_shift = shifted[k] - k
            if k == prev + 1 and cur_shift == prev_shift:
                prev = k
                continue
            ranges.append((start, prev, prev_shift))
            start = prev = k; prev_shift = cur_shift
        ranges.append((start, prev, prev_shift))
    for start, end, shift in ranges:
        cond = f"{start} <= idx <= {end}" if start != end else f"idx == {start}"
        print(f"    # {cond}: shift {shift:+d}")
    print("    idx + SHIFT: name for idx, name in _PERF_COL_MAP_OLD.items()")
    print("    # 위 SHIFT 조건들을 참고해 실제 시프트 표현식으로 바꿔서 사용")
    print("}")
    if any(tag in ("insert",) for tag, *_ in opcodes):
        print("\n※ 신규 삽입 컬럼은 기존 필드와 매칭이 없어 자동 매핑 대상에서 제외됨 — 필요하면 수동 추가.")


if __name__ == "__main__":
    args = sys.argv[1:]
    if "--vs" in args:
        split = args.index("--vs")
        old_path, old_sheet = args[0], args[1]
        new_path, new_sheet = args[split + 1], args[split + 2]
        compare(old_path, old_sheet, new_path, new_sheet)
    elif len(args) >= 2:
        print_single(args[0], args[1])
    else:
        print(__doc__)
