ALLOWED = {"order_status", "refund_policy", "issue_refund"}

def permitted(tool: str) -> bool:
    return tool in ALLOWED

print("delete_account allowed?", permitted("delete_account"))
import time

def with_retry(fn, attempts=3):
    for i in range(attempts):
        try:
            return fn()
        except Exception as e:
            print(f"attempt {i + 1} failed: {e}")
            time.sleep(0.1 * 2 ** i)
    raise RuntimeError("gave up")

flaky = iter([TimeoutError("model timed out"), "ok"])
def call():
    x = next(flaky)
    if isinstance(x, Exception):
        raise x
    return x
print("result:", with_retry(call))
import json, pathlib, tempfile

state = {"ticket": "1001", "messages": 7, "step": "issue_refund"}
ckpt = pathlib.Path(tempfile.gettempdir()) / "ticket-1001.json"
ckpt.write_text(json.dumps(state))
print("resumed:", json.loads(ckpt.read_text()))
def needs_approval(tool: str, args: dict) -> bool:
    return tool == "issue_refund" and float(args["amount"]) > 20

request = ("issue_refund", {"order_id": "A-1001", "amount": "42"})
print("waiting for a human" if needs_approval(*request) else "auto-approved", request)
trace = []
def log(step, **data):
    trace.append({"t": round(time.time(), 2), "step": step, **data})

log("llm", tokens=212); log("tool", name="order_status"); log("llm", tokens=260)
print(f"{len(trace)} events; last: {trace[-1]}")
from openai import OpenAI

GOLDEN = [("Where is my refund for order A-1001?", "refund"), ("I want to cancel order B-2002", "cancel"),
          ("My refund for C-3003 never arrived", "refund"), ("How do I reset my password?", "account"),
          ("Can I pay by bank transfer?", "payment")]
client = OpenAI()
def intent(q):
    raw = client.chat.completions.create(model="gpt-4o-mini", messages=[
        {"role": "system", "content": 'Reply as JSON with keys "intent".'}, {"role": "user", "content": q}])
    return json.loads(raw.choices[0].message.content)["intent"]

passed = sum(intent(q) == want for q, want in GOLDEN)
print(f"{passed}/{len(GOLDEN)} pass  ->  {'deploy' if passed / len(GOLDEN) >= 0.9 else 'blocked'}")