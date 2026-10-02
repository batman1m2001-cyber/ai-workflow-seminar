import json
import os
from openai import OpenAI

client = OpenAI()
MODEL = os.getenv("SEMINAR_MODEL", "gpt-4o-mini")


def calculator(expression: str) -> dict:
    return {"result": eval(expression, {"__builtins__": {}})}


SCHEMAS = [{"type": "function", "function": {"name": "calculator", "description": "Evaluate arithmetic.",
            "parameters": {"type": "object", "properties": {"expression": {"type": "string"}}, "required": ["expression"]}}}]


def agent(question: str) -> str:
    messages = [{"role": "user", "content": question}]
    for _ in range(4):
        msg = client.chat.completions.create(model=MODEL, messages=messages, tools=SCHEMAS).choices[0].message
        if not msg.tool_calls:
            return msg.content
        messages.append({"role": "assistant", "content": msg.content, "tool_calls": [
            {"id": c.id, "type": "function", "function": {"name": c.function.name, "arguments": c.function.arguments}}
            for c in msg.tool_calls]})
        for c in msg.tool_calls:
            out = calculator(**json.loads(c.function.arguments))          # no try/except
            messages.append({"role": "tool", "tool_call_id": c.id, "content": json.dumps(out)})


for q in ["What is 6 * 7?", "What is 10 / 0?", "What is 2 + 2?"]:      # the third never runs
    print(q, "→", agent(q))
