import json
import os
from openai import OpenAI

client = OpenAI()
MODEL = os.getenv("SEMINAR_MODEL", "gpt-4o-mini")


def refund_status(order: str) -> str:  return f"refund for {order}: approved, 3 days"
def payment_link(amount: str) -> str:  return f"payment link for {amount}: https://pay.example/abc"


def handle(message: str) -> str:
    r = client.chat.completions.create(model=MODEL, temperature=0, messages=[{"role": "user", "content":
        'Reply with JSON only: {"intent": "refund" | "payment" | "question"}\nMessage: ' + message}])
    intent = json.loads(r.choices[0].message.content)["intent"]
    if intent == "refund":                    # every path is written down — you can test each one
        return refund_status("A-1001")
    if intent == "payment":
        return payment_link("2,000,000 VND")
    return "Please call the hotline."


for m in ["Where is my refund?", "I want to pay today", "Hello?"]:
    print(f"{m:<22} → {handle(m)}")
