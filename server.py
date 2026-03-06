#!/usr/bin/env python3
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
import os
from pathlib import Path
from functools import partial

port = int(os.getenv("PORT", "8080"))

# Always serve files from this project directory, regardless of runtime cwd.
project_dir = Path(__file__).resolve().parent
handler = partial(SimpleHTTPRequestHandler, directory=str(project_dir))

httpd = ThreadingHTTPServer(("0.0.0.0", port), handler)
print(f"Serving on 0.0.0.0:{port}")
httpd.serve_forever()
