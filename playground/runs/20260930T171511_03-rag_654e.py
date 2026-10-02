import os
import numpy as np
from openai import OpenAI

client = OpenAI()
MODEL = os.getenv("SEMINAR_MODEL", "gpt-4o-mini")

DOCS = [
    "Agents must not call customers before 7am or after 9pm.",
    "Never disclose the debt to a third party who answers the phone.",
    "Agents must state their full name and the bank's name at the start of the call.",
    "A promise to pay must include an amount and a date.",
    "Insulting or threatening the customer is a serious violation.",
    "Card numbers must never be read out in full; only the last four digits.",
]


def embed(texts):
    r = client.embeddings.create(model="text-embedding-3-small", input=texts)
    return np.array([d.embedding for d in r.data])


DOC_VECS = embed(DOCS)


def rag(question: str, k: int = 2) -> str:
    q = embed([question])[0]                                          # 1. embed
    scores = DOC_VECS @ q / (np.linalg.norm(DOC_VECS, axis=1) * np.linalg.norm(q))
    hits = np.argsort(-scores)[:k]                                    # 2. retrieve
    context = "\n".join(DOCS[i] for i in hits)                        # 3. assemble
    r = client.chat.completions.create(                               # 4. generate
        model=MODEL, temperature=0,
        messages=[{"role": "system", "content": "Answer using only the context. If it is not there, say so."},
                  {"role": "user", "content": f"Context:\n{context}\n\nQuestion: {question}"}])
    return r.choices[0].message.content


for q in ["Can the agent tell the customer's brother about the debt?",
          "What time is too late to call?"]:
    print("Q:", q)
    print("A:", rag(q), "\n")
