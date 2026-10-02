import os
from openai import OpenAI

client = OpenAI()                                   # key + base URL come from the environment
MODEL = os.getenv("SEMINAR_MODEL", "gpt-4o-mini")


def llm(prompt: str, system: str = "You are a helpful assistant.") -> str:
    r = client.chat.completions.create(
        model=MODEL,
        messages=[{"role": "system", "content": system},
                  {"role": "user", "content": prompt}],
    )
    return r.choices[0].message.content


print(llm("Explain what an AI agent is, in one sentence."))
