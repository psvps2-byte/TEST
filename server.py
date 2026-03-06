#!/usr/bin/env python3
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
import os

port = int(os.getenv("PORT", "8080"))
httpd = ThreadingHTTPServer(("0.0.0.0", port), SimpleHTTPRequestHandler)
print(f"Serving on 0.0.0.0:{port}")
httpd.serve_forever()
