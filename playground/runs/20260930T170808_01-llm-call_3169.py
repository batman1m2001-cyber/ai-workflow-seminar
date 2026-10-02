import os
from openai import OpenAI

client = OpenAI()
MODEL = os.getenv("SEMINAR_MODEL", "gpt-4o-mini")

r = client.chat.completions.create(
    model=MODEL,
    messages=[{"role": "user", "content": "Say hello to the seminar."}],
)
choice = r.choices[0]
print("finish_reason:", choice.finish_reason)
print("usage:        ", r.usage)
print("content:      ", choice.message.content)
