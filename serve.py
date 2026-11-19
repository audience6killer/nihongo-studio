#!/usr/bin/env python3
"""Static file server for Nihongo Studio.

Usage:
    python serve.py [--port 8765] [--host 127.0.0.1] [--root .]

Python stdlib only, by design: the project has no installable dependencies.
Adds the MIME types a plain http.server gets wrong on Windows and disables
caching so edits show up immediately.
"""
from __future__ import annotations

import argparse
import functools
import http.server
import os
import socketserver
import sys

EXTRA_TYPES = {
    ".webmanifest": "application/manifest+json",
    ".json": "application/json; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".mjs": "text/javascript; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".svg": "image/svg+xml",
    ".woff2": "font/woff2",
}


class Handler(http.server.SimpleHTTPRequestHandler):
    extensions_map = {
        **http.server.SimpleHTTPRequestHandler.extensions_map,
        **EXTRA_TYPES,
    }

    def end_headers(self) -> None:
        self.send_header("Cache-Control", "no-store, max-age=0")
        self.send_header("Service-Worker-Allowed", "/")
        super().end_headers()

    def log_message(self, fmt: str, *args) -> None:  # quieter, still useful
        sys.stderr.write("  %s\n" % (fmt % args))


def main() -> int:
    root = os.path.dirname(os.path.abspath(__file__))
    ap = argparse.ArgumentParser(description="Serve Nihongo Studio locally.")
    ap.add_argument("--port", type=int, default=8765)
    ap.add_argument("--host", default="127.0.0.1")
    ap.add_argument("--root", default=root)
    args = ap.parse_args()

    handler = functools.partial(Handler, directory=args.root)
    socketserver.TCPServer.allow_reuse_address = True
    with socketserver.TCPServer((args.host, args.port), handler) as httpd:
        url = f"http://{args.host}:{args.port}"
        print(f"Nihongo Studio serving {args.root}")
        print(f"  -> {url}")
        print("  Ctrl+C to stop")
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\nstopped")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
