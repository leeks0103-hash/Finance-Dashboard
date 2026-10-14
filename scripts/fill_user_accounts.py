"""
임직원 명단 엑셀 → .env USER_ACCOUNTS(일반 회원) 한 줄 채우기(2026-10-14).

엑셀 머리글(첫 행)에 필요한 열: 사번, 비밀번호 / 있으면 씀: 이름
  - 지금 받은 '임직원_비밀번호_68명.xlsx'(No., 비밀번호)에 사번·이름 열만 추가하면 됨
  - 관리자(ADMIN_ACCOUNTS)는 건드리지 않음. 명단에 관리자 사번이 있으면 일반 회원에서 뺌(관리자로 남음)
  - 비밀번호는 화면에 찍지 않음. 형식을 깨는 글자(쉼표·콜론)·빈 값·사번 중복은 오류로 멈춤

사용:
  python scripts/fill_user_accounts.py "<엑셀 경로>"            # 미리보기(바꾸지 않음)
  python scripts/fill_user_accounts.py "<엑셀 경로>" --apply    # .env의 USER_ACCOUNTS 줄 교체
적용 후 Flask 재시작해야 로그인에 반영됨.
"""
import io
import os
import sys

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")

import openpyxl

ENV_PATH = os.environ.get("FILL_ENV_PATH") or os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), ".env")


def _cell(v) -> str:
    if v is None:
        return ""
    if isinstance(v, float) and v.is_integer():
        v = int(v)
    return str(v).strip()


def read_roster(path: str) -> list[tuple[str, str, str]]:
    wb = openpyxl.load_workbook(path, read_only=True, data_only=True)
    rows = list(wb.worksheets[0].iter_rows(values_only=True))
    head = [_cell(h) for h in rows[0]]
    for need in ("사번", "비밀번호"):
        if need not in head:
            sys.exit(f"[중단] 머리글에 '{need}' 열이 없습니다. 지금 머리글: {head}")
    i_emp, i_pw = head.index("사번"), head.index("비밀번호")
    i_name = head.index("이름") if "이름" in head else None

    out, seen, errors = [], set(), []
    for n, r in enumerate(rows[1:], start=2):
        emp, pw = _cell(r[i_emp]), _cell(r[i_pw])
        name = _cell(r[i_name]) if i_name is not None else ""
        if not emp and not pw:
            continue   # 빈 줄
        if not emp or not pw:
            errors.append(f"{n}행: 사번 또는 비밀번호 빈 값")
        elif any(ch in emp + pw + name for ch in ",:"):
            errors.append(f"{n}행: 쉼표(,)·콜론(:)은 쓸 수 없음(.env 형식 구분자)")
        elif emp in seen:
            errors.append(f"{n}행: 사번 {emp} 중복")
        else:
            seen.add(emp)
            out.append((emp, pw, name))
    if errors:
        sys.exit("[중단] 명단 오류\n  " + "\n  ".join(errors))
    return out


def _env_items(line: str) -> list[str]:
    """KEY="a:b,c:d" → ["a:b", "c:d"] — 따옴표로 감싼 값도"""
    v = line.split("=", 1)[1].strip().strip('"').strip("'")
    return [p.strip() for p in v.split(",") if p.strip()]


def env_admin_ids(lines: list[str]) -> set[str]:
    for line in lines:
        if line.startswith("ADMIN_ACCOUNTS="):
            return {p.split(":")[0].strip() for p in _env_items(line)}
    return set()


def main():
    if len(sys.argv) < 2:
        sys.exit(__doc__)
    path, apply = sys.argv[1], "--apply" in sys.argv
    roster = read_roster(path)

    with open(ENV_PATH, encoding="utf-8") as f:
        lines = f.read().splitlines()
    admins = env_admin_ids(lines)
    users = [r for r in roster if r[0] not in admins]
    skipped = len(roster) - len(users)

    value = ",".join(f"{e}:{p}:{n}" if n else f"{e}:{p}" for e, p, n in users)
    new_line = f'USER_ACCOUNTS="{value}"'

    idx = next((i for i, l in enumerate(lines) if l.startswith("USER_ACCOUNTS=")), None)
    old_n = len(_env_items(lines[idx])) if idx is not None else 0

    print(f"명단 {len(roster)}명 → 일반 회원 {len(users)}명" + (f" (관리자라 제외 {skipped}명)" if skipped else ""))
    print(f"이름 있는 사람 {sum(1 for u in users if u[2])}명 / 지금 .env 일반 회원 {old_n}명 → 교체")
    print("예시(비밀번호 가림):", ", ".join(f"{e}:****{':' + n if n else ''}" for e, _, n in users[:3]))
    if not apply:
        print("\n미리보기만 했습니다. 바꾸려면 끝에 --apply")
        return

    if idx is None:
        lines.append(new_line)
    else:
        lines[idx] = new_line
    with open(ENV_PATH, "w", encoding="utf-8", newline="\n") as f:
        f.write("\n".join(lines) + "\n")
    print("\n.env USER_ACCOUNTS 교체 완료 — Flask 재시작해야 반영됩니다(ADMIN_ACCOUNTS는 그대로)")


if __name__ == "__main__":
    main()
