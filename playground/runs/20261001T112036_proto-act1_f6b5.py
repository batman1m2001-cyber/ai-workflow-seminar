import time as _t
def _mark(i, ev): print(f'{i}:{ev}:{_t.perf_counter():.4f}', flush=True)

_mark(0, 's')
question = "Where is my refund for order A-1001?"
messages = [
    {"role": "system", "content": 'You are a support assistant. Reply as JSON with keys "intent" and "order_id".'},
    {"role": "user", "content": question},
]
print(question)
_mark(0, 'e')

_mark(1, 's')
from openai import OpenAI

reply = OpenAI().chat.completions.create(model="gpt-4o-mini", messages=messages)
raw = reply.choices[0].message.content
print(raw)
_mark(1, 'e')

_mark(2, 's')
import json

data = json.loads(raw)
assert data.get("intent"), "the model gave no intent"
print(data)
_mark(2, 'e')
