import json
import os
from openai import OpenAI

client = OpenAI()
MODEL = os.getenv("SEMINAR_MODEL", "gpt-4o-mini")

KB = {"python": "Python is a programming language created by Guido van Rossum in 1991.",
      "machine learning": "Machine learning is fitting models to data to make predictions."}


def calculator(expression: str) -> dict:
    return {"result": eval(expression, {"__builtins__": {}})}


def search(query: str) -> dict:
    hits = [v for k, v in KB.items() if k in query.lower()]
    return {"result": hits[0] if hits else "no result"}


TOOLS = {"calculator": calculator, "search": search}
SCHEMAS = [
    {"type": "function", "function": {"name": "calculator", "description": "Evaluate arithmetic.",
      "parameters": {"type": "object", "properties": {"expression": {"type": "string"}}, "required": ["expression"]}}},
    {"type": "function", "function": {"name": "search", "description": "Search the knowledge base.",
      "parameters": {"type": "object", "properties": {"query": {"type": "string"}}, "required": ["query"]}}},
]


def agent(question: str, max_turns: int = 5) -> str:
    messages = [{"role": "user", "content": question}]                  # state
    for turn in range(1, max_turns + 1):                                # loop
        msg = client.chat.completions.create(                           # LLM
            model=MODEL, messages=messages, tools=SCHEMAS).choices[0].message
        if not msg.tool_calls:                                          # decision
            print(f"turn {turn}: answer")
            return msg.content
        messages.append({"role": "assistant", "content": msg.content, "tool_calls": [
            {"id": c.id, "type": "function",
             "function": {"name": c.function.name, "arguments": c.function.arguments}}
            for c in msg.tool_calls]})
        for call in msg.tool_calls:                                     # tools
            args = json.loads(call.function.arguments)
            out = TOOLS[call.function.name](**args)
            print(f"turn {turn}: {call.function.name}({args}) -> {out}")
            messages.append({"role": "tool", "tool_call_id": call.id, "content": json.dumps(out)})
    return "gave up: out of turns"


print(agent("What is 15 * 7, and also tell me about machine learning?"))
