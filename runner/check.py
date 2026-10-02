"""Run every playground on every page through the local runner.

    uv run python -m runner.check              # mock model
    uv run python -m runner.check --real       # your endpoint from .env
    uv run python -m runner.check 09           # only pages whose file starts with 09

The rehearsal before the talk: a playground that fails here fails on stage.
Needs the runner up (`uv run python -m runner.server`).
"""
from __future__ import annotations

import html
import textwrap
import json
import re
import sys
import urllib.request
from pathlib import Path

SITE = Path(__file__).resolve().parent.parent / "site"
BLOCK = re.compile(r'<div class="playground"([^>]*)><script type="text/plain">(.*?)</script></div>', re.S)
# a pipeline of cards is one program: its steps' code, in order (as site/assets/cards.js runs it)
PIPE = re.compile(r'<div class="pipeline"([^>]*)>(.*?)\n</div>', re.S)
STEP = re.compile(r'<div class="step"[^>]*>\s*<script type="text/plain">(.*?)</script>', re.S)


def blocks(text: str) -> list:
    out = BLOCK.findall(text)
    for attrs, inner in PIPE.findall(text):
        steps = [textwrap.dedent(s.strip("\n")) for s in STEP.findall(inner)]
        out.append((attrs.replace('data-title="', 'data-title="cards: '), "\n".join(steps)))
    return out


def main(argv: list) -> int:
    sys.stdout.reconfigure(encoding="utf-8")
    mode = "real" if "--real" in argv else "mock"
    only = [a for a in argv if not a.startswith("-")]
    pages = sorted(SITE.glob("pages/*.html"))
    failed = 0
    for page in pages:
        if only and not any(page.name.startswith(o) for o in only):
            continue
        for k, (attrs, code) in enumerate(blocks(page.read_text(encoding="utf-8")), 1):
            if 'data-runtime="none"' in attrs:
                continue
            title = re.search(r'data-title="([^"]*)"', attrs)
            body = json.dumps({"code": code.lstrip("\n"), "mode": mode, "page": page.stem}).encode()
            req = urllib.request.Request("http://127.0.0.1:8000/api/run", body, {"content-type": "application/json"})
            res = json.load(urllib.request.urlopen(req, timeout=120))
            ok = (res["exit"] != 0) if 'data-expect="error"' in attrs else (res["exit"] == 0)
            failed += not ok
            name = html.unescape(title.group(1)) if title else f"#{k}"
            print(f"{'ok ' if ok else 'ERR'} {res['ms']:>6} ms  {page.stem} · {name}")
            if not ok or "-v" in argv:
                text = (res["stdout"] + res["stderr"]).strip().splitlines()
                print("      " + "\n      ".join(text[-12:]))
    print(f"\n{failed} failed")
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
