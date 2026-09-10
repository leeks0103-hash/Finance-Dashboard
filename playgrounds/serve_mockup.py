"""
목업 HTML에 실데이터를 물리기 위한 초경량 로컬 프록시 서버.
- 정적 파일: 이 스크립트가 있는 playgrounds/ 폴더에서 서빙
- /api/* 요청: 실제 Flask 백엔드(기본 http://localhost:5000)로 그대로 프록시
  → 브라우저 입장에선 같은 오리진이라 CORS 설정 없이 그대로 fetch 가능
  → 실제 app.py/frontend 코드는 전혀 건드리지 않음 (목업 전용 스크립트)

사용법:
    python playgrounds/serve_mockup.py
    → http://localhost:5199/playground-ngx-admin-clone.html 접속
"""
import http.server
import os
import urllib.request
import urllib.error

BACKEND = os.environ.get("BACKEND_URL", "http://localhost:5000")
PORT = int(os.environ.get("MOCKUP_PORT", "5199"))
STATIC_DIR = os.path.dirname(os.path.abspath(__file__))


class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=STATIC_DIR, **kwargs)

    def do_GET(self):
        if self.path.startswith("/api/"):
            self._proxy()
        else:
            super().do_GET()

    def _proxy(self):
        url = BACKEND + self.path
        try:
            with urllib.request.urlopen(url, timeout=10) as resp:
                body = resp.read()
                self.send_response(resp.status)
                self.send_header("Content-Type", resp.headers.get("Content-Type", "application/json"))
                self.send_header("Content-Length", str(len(body)))
                self.end_headers()
                self.wfile.write(body)
        except urllib.error.URLError as e:
            self.send_response(502)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(f'{{"error": "backend unreachable: {e}"}}'.encode())

    def log_message(self, fmt, *args):
        pass  # 콘솔 노이즈 줄이기


if __name__ == "__main__":
    print(f"목업 서버: http://localhost:{PORT}/playground-ngx-admin-clone.html")
    print(f"백엔드 프록시 대상: {BACKEND} (다르면 BACKEND_URL 환경변수로 지정)")
    http.server.ThreadingHTTPServer(("0.0.0.0", PORT), Handler).serve_forever()
