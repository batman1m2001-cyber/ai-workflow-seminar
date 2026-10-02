import json
import os
import httpx
from openai import OpenAI


def spy(request: httpx.Request):
    body = json.loads(request.content)
    print(f"POST {request.url.path}")
    print(json.dumps({k: body[k] for k in ("model", "messages", "tools") if k in body}, indent=2))


client = OpenAI(http_client=httpx.Client(event_hooks={"request": [spy]}))

tools = [{"type": "function", "function": {
    "name": "get_weather", "description": "Current weather for a city.",
    "parameters": {"type": "object", "properties": {"city": {"type": "string"}}, "required": ["city"]}}}]

r = client.chat.completions.create(
    model=os.getenv("SEMINAR_MODEL", "gpt-4o-mini"), tools=tools,
    messages=[{"role": "user", "content": "What's the weather in Hanoi?"}])
print("\nfinish_reason:", r.choices[0].finish_reason)
