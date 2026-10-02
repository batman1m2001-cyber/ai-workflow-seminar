import json
import os
from openai import OpenAI

client = OpenAI()
MODEL = os.getenv("SEMINAR_MODEL", "gpt-4o-mini")


def calculator(expression: str) -> dict:
    return {"result": eval(expression, {"__builtins__": {}})}     # demo only — never eval untrusted input


TOOLS = {"calculator": calculator}
SCHEMAS = [{
    "type": "function",
    "function": {
        "name": "calculator",
        "description": "Evaluate an arithmetic expression.",
        "parameters": {"type": "object",
                       "properties": {"expression": {"type": "string"}},
                       "required": ["expression"]},
    },
}]

messages = [{"role": "user", "content": "What is 25 * 4 + 100?"}]

# 1. the model proposes
msg = client.chat.completions.create(model=MODEL, messages=messages, tools=SCHEMAS).choices[0].message
print("model content :", msg.content)
for call in msg.tool_calls:
    print("model wishes  :", call.function.name, call.function.arguments)

# 2. your code executes — and decides whether to
messages.append({"role": "assistant", "content": msg.content, "tool_calls": [
    {"id": c.id, "type": "function",
     "function": {"name": c.function.name, "arguments": c.function.arguments}} for c in msg.tool_calls]})
for call in msg.tool_calls:
    result = TOOLS[call.function.name](**json.loads(call.function.arguments))
    print("tool returned :", result)
    messages.append({"role": "tool", "tool_call_id": call.id, "content": json.dumps(result)})

# 3. the model reads the results
final = client.chat.completions.create(model=MODEL, messages=messages, tools=SCHEMAS).choices[0].message
print("final answer  :", final.content)
