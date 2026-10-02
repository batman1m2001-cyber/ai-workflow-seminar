import time as _t
def _mark(i, ev): print(f'{i}:{ev}:{_t.perf_counter():.4f}', flush=True)

_mark(0, 's')
import inspect, json
from openai import OpenAI

def order_status(order_id: str) -> str:
    """Look up an order: its status and any refund."""
    return f"{order_id}: delivered, refund of $42 approved on 28 Sep"

def refund_policy(topic: str) -> str:
    """Search the refund policy."""
    return "Refunds are paid to the original card within 5 business days."

def faq(topic: str) -> str:
    """Answer common shipping questions."""
    return "Orders ship within 2 days."

TOOLS = {f.__name__: f for f in (order_status, refund_policy, faq)}
SCHEMAS = [{"type": "function", "function": {"name": n, "description": f.__doc__, "parameters": {"type": "object",
            "properties": {p: {"type": "string"} for p in inspect.signature(f).parameters}}}} for n, f in TOOLS.items()]
print(list(TOOLS))
_mark(0, 'e')

_mark(1, 's')
client, calls = OpenAI(), 0
messages = [{"role": "user", "content": "Where is my refund for order A-1001?"}]
while True:
    calls += 1
    msg = client.chat.completions.create(model="gpt-4o-mini", messages=messages, tools=SCHEMAS).choices[0].message
    if not msg.tool_calls:
        break
    messages.append(msg.model_dump(exclude_none=True))
    for c in msg.tool_calls:
        print(f"model picked: {c.function.name}")
        out = TOOLS[c.function.name](**json.loads(c.function.arguments))
        messages.append({"role": "tool", "tool_call_id": c.id, "content": out})
_mark(1, 'e')

_mark(2, 's')
print(msg.content)
print(f"model calls: {calls} · path picked by: the model")
_mark(2, 'e')
