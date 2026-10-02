import json
import os
from openai import OpenAI

client = OpenAI()
MODEL = os.getenv("SEMINAR_MODEL", "gpt-4o-mini")


def intent(message: str) -> str:
    r = client.chat.completions.create(
        model=MODEL, temperature=0,
        messages=[{"role": "user", "content":
                   'Reply with JSON only: {"intent": "refund" | "payment" | "question"}\n'
                   f"Message: {message}"}])
    return json.loads(r.choices[0].message.content)["intent"]


def handle_refund(m):   return "→ open a refund ticket"
def handle_payment(m):  return "→ send the payment link"
def handle_other(m):    return "→ answer from the FAQ"


for message in ["I want a refund for last month's fee",
                "I will pay the debt tomorrow",
                "What are your opening hours?"]:
    label = intent(message)                        # the model fills in a value
    if label == "refund":                          # your code picks the path
        action = handle_refund(message)
    elif label == "payment":
        action = handle_payment(message)
    else:
        action = handle_other(message)
    print(f"{label:>8} {action}   ({message})")
