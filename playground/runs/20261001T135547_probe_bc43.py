import json
from openai import OpenAI
client = OpenAI()
calls = 0
def llm(**kw):
    global calls
    calls += 1
    return client.chat.completions.create(model="gpt-4o-mini", **kw).choices[0].message

def order_status(order_id: str) -> str:
    return f"{order_id}: delivered, refund of $42 approved on 28 Sep"
def faq(topic: str) -> str:
    return "Orders ship within 2 days."
question = "Where is my refund for order A-1001?"
data = json.loads(llm(messages=[{"role": "system", "content": 'Reply as JSON with keys "intent" and "order_id".'},
                               {"role": "user", "content": question}]).content)
print(data)
if data["intent"] == "refund" and data.get("order_id"):
    facts = order_status(data["order_id"]); path = "refund"
else:
    facts = faq(question); path = "faq"
print("code chose:", path)
answer = llm(messages=[{"role": "user", "content": f"Answer from the context only.\n\nContext:\n{facts}\n\nQuestion: {question}"}]).content
print(answer)
print(f"model calls: {calls} · path chosen by: code")
