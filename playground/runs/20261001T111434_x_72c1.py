
import json
from openai import OpenAI
client = OpenAI()
q = "Where is my refund for order A-1001?"
messages = [{"role": "system", "content": 'You are a support assistant. Reply as JSON with keys "intent" and "order_id".'},
            {"role": "user", "content": q}]
r = client.chat.completions.create(model="gpt-4o-mini", messages=messages)
print(r.choices[0].message.content)
