import json
from openai import OpenAI

client, calls = OpenAI(), 0
def llm(**kw):
    global calls
    calls += 1
    return client.chat.completions.create(model="gpt-4o-mini", **kw).choices[0].message

question = "Where is my refund for order A-1001?"
data = json.loads(llm(messages=[{"role": "system", "content": 'Reply as JSON with keys "intent" and "order_id".'},
                               {"role": "user", "content": question}]).content)
print(data)
def order_status(order_id): return f"{order_id}: delivered, refund of $42 approved on 28 Sep"
def faq(question):          return "Orders ship within 2 days."

if data["intent"] == "refund" and data.get("order_id"):
    facts = order_status(data["order_id"])
else:
    facts = faq(question)
print(facts)
answer = llm(messages=[{"role": "user", "content": f"Answer from the context only.\n\nContext:\n{facts}\n\nQuestion: {question}"}]).content
print(answer)
print(f"model calls: {calls} · path picked by: code")