import json
import os
from openai import OpenAI

client = OpenAI()
MODEL = os.getenv("SEMINAR_MODEL", "gpt-4o-mini")


def refund_status(order: str) -> dict:  return {"status": f"refund for {order}: approved, 3 days"}
def payment_link(amount: str) -> dict:  return {"link": f"payment link for {amount}: https://pay.example/abc"}


TOOLS = {"refund_status": refund_status, "payment_link": payment_link}
SCHEMAS = [
    {"type": "function", "function": {"name": "refund_status", "description": "Look up a refund. Use for refund questions.",
      "parameters": {"type": "object", "properties": {"order": {"type": "string"}}, "required": ["order"]}}},
    {"type": "function", "function": {"name": "payment_link", "description": "Create a payment link. Use when the customer wants to pay.",
      "parameters": {"type": "object", "properties": {"amount": {"type": "string"}}, "required": ["amount"]}}},
]


def handle(message: str) -> str:
    messages = [{"role": "user", "content": message}]
    for _ in range(4):                        # the path is whatever the model chooses
        msg = client.chat.completions.create(model=MODEL, messages=messages, tools=SCHEMAS).choices[0].message
        if not msg.tool_calls:
            return msg.content
        messages.append({"role": "assistant", "content": msg.content, "tool_calls": [
            {"id": c.id, "type": "function", "function": {"name": c.function.name, "arguments": c.function.arguments}}
            for c in msg.tool_calls]})
        for c in msg.tool_calls:
            out = TOOLS[c.function.name](**json.loads(c.function.arguments))
            messages.append({"role": "tool", "tool_call_id": c.id, "content": json.dumps(out)})
    return "gave up"


for m in ["Where is my refund for order A-1001?", "I want to pay 2,000,000 VND today"]:
    print(f"{m} →\n    {handle(m)}\n")
