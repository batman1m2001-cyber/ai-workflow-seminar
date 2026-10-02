import numpy as np
from openai import OpenAI

client = OpenAI()

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


doc_vecs = embed(DOCS)                                   # done once, offline, in real life
question = "The customer promised to pay. What must the agent record?"
q = embed([question])[0]

scores = doc_vecs @ q / (np.linalg.norm(doc_vecs, axis=1) * np.linalg.norm(q))
for i in np.argsort(-scores)[:3]:
    print(f"{scores[i]:.3f}  {DOCS[i]}")
