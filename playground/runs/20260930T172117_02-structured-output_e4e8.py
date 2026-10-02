import json
import os
from openai import OpenAI

client = OpenAI()
MODEL = os.getenv("SEMINAR_MODEL", "gpt-4o-mini")
LABELS = {"ok", "violation"}


def classify(text: str) -> dict:
    r = client.chat.completions.create(
        model=MODEL, temperature=0,
        messages=[{"role": "user", "content":
                   'Reply with JSON only: {"label": "ok" | "violation", "reason": "..."}\n'
                   f"Utterance: {text}"}])
    data = json.loads(r.choices[0].message.content)        # raises on non-JSON
    if data.get("label") not in LABELS:
        raise ValueError(f"label outside the contract: {data!r}")   # never guess
    return data


for text in ["Dạ em chào anh, em gọi từ ngân hàng ạ.",
             "Mày ngu à, trả tiền đi!",
             "Anh vui lòng thanh toán trước ngày 15 giúp em."]:
    print(f"{classify(text)['label']:>9}  ←  {text}")
