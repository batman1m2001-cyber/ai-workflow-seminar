import json
import os
import re
from openai import OpenAI

client = OpenAI()
MODEL = os.getenv("SEMINAR_MODEL", "gpt-4o-mini")


def calculator(expression: str) -> dict:
    return {"result": eval(expression, {"__builtins__": {}})}


def get_weather(city: str) -> dict:
    return {"city": city, "temp_c": 31, "sky": "humid"}


TOOLS = {"calculator": calculator, "get_weather": get_weather}

SYSTEM = """You can use these tools:
- calculator(expression: str): evaluate arithmetic
- get_weather(city: str): current weather for a city

To use a tool, reply ONLY with one line per call:
<tool_call>{"name": "<tool>", "arguments": {...}}</tool_call>
Tool results come back as <tool_result>...</tool_result>. Then answer normally."""


def ask(question: str, max_turns: int = 4) -> str:
    messages = [{"role": "system", "content": SYSTEM}, {"role": "user", "content": question}]
    for turn in range(max_turns):
        text = client.chat.completions.create(model=MODEL, messages=messages).choices[0].message.content
        calls = re.findall(r"<tool_call>(.*?)</tool_call>", text, re.S)       # the parser
        if not calls:
            return text
        messages.append({"role": "assistant", "content": text})
        results = []
        for raw in calls:
            call = json.loads(raw)
            out = TOOLS[call["name"]](**call["arguments"])
            print(f"turn {turn + 1}: {call['name']}({call['arguments']}) -> {out}")
            results.append(f"<tool_result>{json.dumps(out)}</tool_result>")
        messages.append({"role": "user", "content": "\n".join(results)})       # results go back as text
    return "gave up"


print(ask("What's the weather in Hanoi?"))
print(ask("What is 12 * 12 + 1?"))
