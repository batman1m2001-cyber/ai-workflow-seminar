question = "Where is my refund for order A-1001?"
messages = [
    {"role": "system", "content": 'You are a support assistant. Reply as JSON with keys "intent" and "order_id".'},
    {"role": "user", "content": question},
]
print(question)
from openai import OpenAI

reply = OpenAI().chat.completions.create(model="gpt-4o-mini", messages=messages)
raw = reply.choices[0].message.content
print(raw)
import json

data = json.loads(raw)
assert data.get("intent"), "the model gave no intent"
print(data)