import os
from openai import OpenAI

client = OpenAI()
MODEL = os.getenv("SEMINAR_MODEL", "gpt-4o-mini")

SYSTEMS = {
    "neutral":  "You are a helpful assistant.",
    "terse":    "Answer in at most five words.",
    "QC coach": "You coach call-centre agents. Be concrete and polite.",
}
question = "The customer says they will pay next week. What should I say?"

for name, system in SYSTEMS.items():
    r = client.chat.completions.create(
        model=MODEL, temperature=0,
        messages=[{"role": "system", "content": system},
                  {"role": "user", "content": question}])
    print(f"[{name}] {r.choices[0].message.content}\n")
