FILES = {"calc.py": "def add(a, b):\n    return a - b\n"}          # the bug


# ── tools ──────────────────────────────────────────────────────────────
def run_tests() -> str:
    scope = {}
    exec(FILES["calc.py"], scope)
    got = scope["add"](2, 3)
    return "PASS" if got == 5 else f"FAIL: add(2, 3) returned {got}, expected 5"


def read_file(path: str) -> str:
    return FILES[path]


def write_file(path: str, content: str) -> str:
    FILES[path] = content
    return f"wrote {len(content)} bytes to {path}"


TOOLS = {"run_tests": run_tests, "read_file": read_file, "write_file": write_file}


# ── the "model": scripted here; an LLM in real life ───────────────────
def scripted_model(history: list) -> dict:
    last = history[-1]["content"] if history else ""
    if not history:
        return {"tool": "run_tests", "args": {}}
    if last.startswith("FAIL"):
        return {"tool": "read_file", "args": {"path": "calc.py"}}
    if last.startswith("def add"):
        return {"tool": "write_file", "args": {"path": "calc.py", "content": last.replace("a - b", "a + b")}}
    if last.startswith("wrote"):
        return {"tool": "run_tests", "args": {}}
    return {"done": "Fixed add(): it subtracted instead of adding. Tests pass."}


# ── the loop ───────────────────────────────────────────────────────────
history = []
for turn in range(1, 8):
    action = scripted_model(history)
    if "done" in action:
        print(f"turn {turn}: DONE — {action['done']}")
        break
    result = TOOLS[action["tool"]](**action["args"])
    print(f"turn {turn}: {action['tool']}({', '.join(action['args'])}) -> {result.splitlines()[0]}")
    history.append({"tool": action["tool"], "content": result})

print("\ncalc.py now:\n" + FILES["calc.py"])
