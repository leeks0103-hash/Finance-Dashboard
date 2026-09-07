"""
대시보드 서버 시작/종료 토글 스크립트
--------------------------------------
실행 시 이미 켜져 있으면 종료, 꺼져 있으면 시작.
상태 판단은 PID 파일이 아니라 **포트 실제 응답 여부**로 한다
(npm run dev 는 껍데기 프로세스라 PID 추적이 어긋나 vite 가 orphan 으로 남는 문제 회피).

사용:
    python dashboard_manager.py          # 토글 (시작 or 종료)
    python dashboard_manager.py --status # 현재 상태만 출력 (running / stopped)
"""

import json
import re
import socket
import subprocess
import sys
import time
from pathlib import Path

ROOT     = Path(__file__).parent
PID_FILE = ROOT / "dashboard.pids.json"
PYTHON   = r"C:\Python314\python.exe"
FRONTEND = ROOT / "frontend"

BACKEND_PORT  = 5000
FRONTEND_PORT = 5188
PORTS = {"backend": BACKEND_PORT, "frontend": FRONTEND_PORT}


# ── 포트 기반 상태 확인 ────────────────────────────────────────────
def _port_alive(port: int, timeout: float = 0.5) -> bool:
    """127.0.0.1:port 로 TCP 연결이 되면 서비스가 살아있는 것으로 본다."""
    try:
        with socket.create_connection(("127.0.0.1", port), timeout):
            return True
    except OSError:
        return False


def _pids_listening_on(port: int) -> set[int]:
    """해당 포트를 LISTENING 중인 프로세스 PID 집합 (netstat 파싱)."""
    try:
        out = subprocess.run(
            ["netstat", "-ano", "-p", "TCP"],
            capture_output=True, text=True, timeout=10,
        ).stdout
    except Exception:
        return set()

    pids: set[int] = set()
    for line in out.splitlines():
        if "LISTENING" not in line:
            continue
        m = re.search(rf":{port}\s+\S+\s+LISTENING\s+(\d+)", line)
        if m:
            pids.add(int(m.group(1)))
    return pids


def _kill_tree(pid: int):
    subprocess.run(["taskkill", "/F", "/T", "/PID", str(pid)], capture_output=True)


def save_pids(data: dict):
    """상태 판단엔 안 쓰고 디버깅/외부 도구 참고용으로만 기록."""
    try:
        PID_FILE.write_text(json.dumps(data))
    except Exception:
        pass


def is_running() -> bool:
    """백엔드 또는 프론트 포트 중 하나라도 응답하면 running (반쪽 상태도 running 으로 봐서 stop 이 정리)."""
    return any(_port_alive(p) for p in PORTS.values())


# ── 시작 / 종료 ───────────────────────────────────────────────────
def _free_ports() -> list[int]:
    """대상 포트를 잡고 있는 프로세스를 트리째 종료. 종료한 PID 목록 반환."""
    killed = []
    for name, port in PORTS.items():
        for pid in _pids_listening_on(port):
            _kill_tree(pid)
            killed.append(pid)
            print(f"[OK] {name}(:{port}) 점유 프로세스 종료 (PID={pid})")
    # PID 파일에 남은 잔여 프로세스도 정리 (혹시 LISTENING 안 잡히는 경우 대비)
    if PID_FILE.exists():
        try:
            for pid in json.loads(PID_FILE.read_text()).values():
                if isinstance(pid, int):
                    _kill_tree(pid)
        except Exception:
            pass
    return killed


def _wait_ports_free(timeout: float = 10.0):
    deadline = time.time() + timeout
    while time.time() < deadline:
        if not any(_port_alive(p) for p in PORTS.values()):
            return
        time.sleep(0.5)


def _wait_port_up(port: int, timeout: float) -> bool:
    deadline = time.time() + timeout
    while time.time() < deadline:
        if _port_alive(port):
            return True
        time.sleep(0.5)
    return False


def start():
    flags = subprocess.CREATE_NEW_CONSOLE | subprocess.CREATE_NEW_PROCESS_GROUP

    print("[0/3] 이전 인스턴스/포트 정리...")
    _free_ports()
    _wait_ports_free()

    print(f"[1/3] Flask 백엔드 시작 (port {BACKEND_PORT})...")
    subprocess.Popen([PYTHON, str(ROOT / "app.py")], cwd=str(ROOT), creationflags=flags)

    print(f"[2/3] 프론트엔드 시작 (port {FRONTEND_PORT})...")
    # vite.config.ts 가 port 5188 + strictPort + /api 프록시를 이미 지정 → npm run dev 유지
    subprocess.Popen("npm run dev", cwd=str(FRONTEND), shell=True, creationflags=flags)

    print("[3/3] 기동 대기...")
    be_ok = _wait_port_up(BACKEND_PORT, timeout=25)
    fe_ok = _wait_port_up(FRONTEND_PORT, timeout=40)  # vite dev 콜드스타트(deps prebundle) 여유

    # 실제 LISTENING PID 를 기록 (디버깅/외부 도구용 — 상태 판단엔 안 씀)
    real_pids = {
        name: sorted(_pids_listening_on(port))[:1] or None
        for name, port in PORTS.items()
    }
    save_pids({k: (v[0] if v else None) for k, v in real_pids.items()})

    print(f"[{'OK' if be_ok else 'WARN'}] 백엔드  http://localhost:{BACKEND_PORT}  {'응답 OK' if be_ok else '기동 확인 실패(로그 확인)'}")
    print(f"[{'OK' if fe_ok else 'WARN'}] 프론트  http://localhost:{FRONTEND_PORT}  {'응답 OK' if fe_ok else '기동 확인 실패(로그 확인)'}")
    if not (be_ok and fe_ok):
        sys.exit(1)


def stop():
    if not is_running() and not _pids_listening_on(BACKEND_PORT) and not _pids_listening_on(FRONTEND_PORT):
        print("[INFO] 실행 중인 프로세스 없음")
        PID_FILE.unlink(missing_ok=True)
        return

    killed = _free_ports()
    _wait_ports_free()
    PID_FILE.unlink(missing_ok=True)

    if any(_port_alive(p) for p in PORTS.values()):
        print("[WARN] 일부 포트가 아직 응답 — 수동 확인 필요")
        sys.exit(1)
    print(f"[OK] 대시보드 서버 종료 완료 (프로세스 {len(killed)}개 정리)")


def main():
    if "--status" in sys.argv:
        print("running" if is_running() else "stopped")
        return

    if is_running():
        print("[대시보드 서버 종료]")
        stop()
        sys.exit(0)
    else:
        print("[대시보드 서버 시작]")
        start()
        sys.exit(0)


if __name__ == "__main__":
    main()
