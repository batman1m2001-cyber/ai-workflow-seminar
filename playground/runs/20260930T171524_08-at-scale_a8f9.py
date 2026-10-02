import json
import os
import time
from openai import OpenAI

client = OpenAI()
MODEL = os.getenv("SEMINAR_MODEL", "gpt-4o-mini")
LOG = []                                                        # observability, the poor man's way


def calculator(expression: str) -> dict:
    return {"result": eval(expression, {"__builtins__": {}})}


SCHEMAS = [{"type": "function", "function": {"name": "calculator", "description": "Evaluate arithmetic.",
            "parameters": {"type": "object", "properties": {"expression": {"type": "string"}}, "required": ["expression"]}}}]


def run_tool(call) -> dict:
    try:
        return calculator(**json.loads(call.function.arguments))
    except Exception as exc:                                    # 1. a failure becomes a message
        return {"error": f"{type(exc).__name__}: {exc}"}


def agent(question: str, max_turns: int = 4) -> str:
    messages = [{"role": "user", "content": question}]
    for turn in range(1, max_turns + 1):                        # 2. a budget
        t = time.perf_counter()
        msg = client.chat.completions.create(model=MODEL, messages=messages, tools=SCHEMAS).choices[0].message
        LOG.append({"q": question, "turn": turn, "ms": round((time.perf_counter() - t) * 1000),
                    "calls": [c.function.arguments for c in msg.tool_calls or []]})   # 3. a record
        if not msg.tool_calls:
            return msg.content
        messages.append({"role": "assistant", "content": msg.content, "tool_calls": [
            {"id": c.id, "type": "function", "function": {"name": c.function.name, "arguments": c.function.arguments}}
            for c in msg.tool_calls]})
        for c in msg.tool_calls:
            messages.append({"role": "tool", "tool_call_id": c.id, "content": json.dumps(run_tool(c))})
    return "gave up: out of turns"


for q in ["What is 6 * 7?", "What is 10 / 0?", "What is 2 + 2?"]:
    try:
        print(q, "→", agent(q))
    except Exception as exc:                                    # 4. one call never kills the batch
        print(q, "→ ERROR", exc)

print("\nlog:")
for row in LOG:
    print("  ", row)
