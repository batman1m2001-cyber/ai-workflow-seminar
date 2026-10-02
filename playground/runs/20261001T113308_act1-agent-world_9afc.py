import inspect, json
from openai import OpenAI

def order_status(order_id: str) -> str:
    """Look up an order: its status and any refund."""
    return f"{order_id}: delivered, refund of $42 approved on 28 Sep"

def refund_policy(topic: str) -> str:
    """Search the refund policy."""
    return "Refunds are paid to the original card within 5 business days."

TOOLS = {f.__name__: f for f in (order_status, refund_policy)}
SCHEMAS = [{"type": "function", "function": {"name": n, "description": f.__doc__, "parameters": {"type": "object",
            "properties": {p: {"type": "string"} for p in inspect.signature(f).parameters}}}} for n, f in TOOLS.items()]
print(list(TOOLS))
messages = [{"role": "system", "content": "You are a refund assistant."},
            {"role": "user", "content": "Where is my refund for order A-1001?"}]
print(f"{len(messages)} messages")
client = OpenAI()
for turn in range(1, 9):                                   # the "agent"
    msg = client.chat.completions.create(model="gpt-4o-mini", messages=messages, tools=SCHEMAS).choices[0].message
    if not msg.tool_calls:                                 # the model says: done
        break
    messages.append(msg.model_dump(exclude_none=True))
    for c in msg.tool_calls:
        out = TOOLS[c.function.name](**json.loads(c.function.arguments))
        messages.append({"role": "tool", "tool_call_id": c.id, "content": out})
        print(f"turn {turn}: {c.function.name} -> {out[:40]}")
print(f"turn {turn}: answer")
print(msg.content)