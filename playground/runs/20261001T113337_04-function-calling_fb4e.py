import os
from openai import OpenAI

client = OpenAI()
MODEL = os.getenv("SEMINAR_MODEL", "gpt-4o-mini")

SCHEMAS = [
    {"type": "function", "function": {"name": "calculator", "description": "Evaluate arithmetic.",
      "parameters": {"type": "object", "properties": {"expression": {"type": "string"}}, "required": ["expression"]}}},
    {"type": "function", "function": {"name": "search", "description": "Search the knowledge base.",
      "parameters": {"type": "object", "properties": {"query": {"type": "string"}}, "required": ["query"]}}},
]

msg = client.chat.completions.create(
    model=MODEL, tools=SCHEMAS,
    messages=[{"role": "user", "content": "What is 15 * 7, and also tell me about machine learning?"}],
).choices[0].message

for call in msg.tool_calls:
    print(f"{call.function.name:>10}  {call.function.arguments}")
