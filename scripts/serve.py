#!/usr/bin/env python3
"""
BreakingTrades Dashboard Server
Serves static files + proxies Yahoo Finance search API (CORS workaround)
"""
import http.server, json, urllib.request, urllib.parse, os, sys

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8888
DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36"

class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *a, **kw):
        super().__init__(*a, directory=DIR, **kw)

    def do_GET(self):
        if self.path.startswith('/api/search?'):
            self.handle_search()
        else:
            super().do_GET()

    def handle_search(self):
        qs = urllib.parse.parse_qs(urllib.parse.urlparse(self.path).query)
        q = qs.get('q', [''])[0]
        if not q:
            self.send_json([])
            return
        try:
            url = f"https://query1.finance.yahoo.com/v1/finance/search?q={urllib.parse.quote(q)}&quotesCount=8&newsCount=0&listsCount=0"
            req = urllib.request.Request(url, headers={"User-Agent": UA})
            with urllib.request.urlopen(req, timeout=5) as resp:
                data = json.loads(resp.read())
            quotes = [
                {"symbol": r.get("symbol",""), "shortname": r.get("shortname",""), "longname": r.get("longname",""), "quoteType": r.get("quoteType",""), "exchange": r.get("exchange","")}
                for r in (data.get("quotes") or [])
                if r.get("quoteType") in ("EQUITY","ETF","INDEX","CRYPTOCURRENCY","FUTURE")
            ][:8]
            self.send_json(quotes)
        except Exception as e:
            self.send_json({"error": str(e)}, 500)

    def send_json(self, obj, code=200):
        body = json.dumps(obj).encode()
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", len(body))
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, fmt, *args):
        pass  # silent

if __name__ == "__main__":
    print(f"BreakingTrades Dashboard → http://localhost:{PORT}")
    http.server.HTTPServer(("", PORT), Handler).serve_forever()
