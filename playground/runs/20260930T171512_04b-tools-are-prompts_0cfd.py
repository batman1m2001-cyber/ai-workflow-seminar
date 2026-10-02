import os
from openai import OpenAI

client = OpenAI()
MODEL = os.getenv("SEMINAR_MODEL", "gpt-4o-mini")

tools = [{"type": "function", "function": {
    "name": "get_weather", "description": "Current weather for a city.",
    "parameters": {"type": "object", "properties": {"city": {"type": "string"}}, "required": ["city"]}}}]

msg = client.chat.completions.create(
    model=MODEL, tools=tools,
    messages=[{"role": "user", "content": "What's the weather in Hanoi?"}],
).choices[0].message

print(msg.tool_calls[0].function.name, msg.tool_calls[0].function.arguments)   # ...magic?
