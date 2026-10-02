import json

def order_status(order_id: str) -> str:
    return f"{order_id}: delivered, refund of $42 approved on 28 Sep"

SCHEMA = {"type": "function", "function": {
    "name": "order_status", "description": "Look up an order: its status and any refund.",
    "parameters": {"type": "object", "properties": {"order_id": {"type": "string"}}, "required": ["order_id"]}}}
print(json.dumps(SCHEMA)[:80] + "…")
from openai import OpenAI

msg = OpenAI().chat.completions.create(
    model="gpt-4o-mini", tools=[SCHEMA],
    messages=[{"role": "user", "content": "Where is my refund for order A-1001?"}],
).choices[0].message
call = msg.tool_calls[0]
print(call.function.name, call.function.arguments)
args = json.loads(call.function.arguments)
print(args)
result = {"order_status": order_status}[call.function.name](**args)
print(result)