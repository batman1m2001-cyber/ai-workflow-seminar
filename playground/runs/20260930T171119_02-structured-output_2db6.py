import json
import os
from openai import OpenAI

client = OpenAI()
MODEL = os.getenv("SEMINAR_MODEL", "gpt-4o-mini")

PROMPT = """Classify the agent's utterance from a debt-collection call.
Reply with JSON only: {"label": "ok" | "violation", "reason": "<one sentence>"}

Utterance: """

r = client.chat.completions.create(
    model=MODEL, temperature=0,
    messages=[{"role": "user", "content": PROMPT + "Mày ngu à, trả tiền đi!"}])
raw = r.choices[0].message.content
data = json.loads(raw)

print("raw   :", raw)
print("parsed:", data)
print("label :", data["label"])
