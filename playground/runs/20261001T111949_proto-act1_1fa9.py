import time as _t
def _mark(i, ev): print(f'{i}:{ev}:{_t.perf_counter():.4f}', flush=True)

_mark(0, 's')
docs = [
    "Refunds are paid to the original card within 5 business days.",
    "Orders can be cancelled free of charge before they ship.",
    "Gift cards cannot be refunded.",
]
print(f"{len(docs)} documents")
_mark(0, 'e')

_mark(1, 's')
import numpy as np
from openai import OpenAI

client = OpenAI()

def embed(texts):
    r = client.embeddings.create(model="text-embedding-3-small", input=texts)
    return np.array([d.embedding for d in r.data])

question = "Where is my refund?"
doc_vecs, q_vec = embed(docs), embed([question])[0]
print(f"vectors: {doc_vecs.shape}")
_mark(1, 'e')

_mark(2, 's')
scores = doc_vecs @ q_vec
best = docs[int(scores.argmax())]
print(best)
_mark(2, 'e')

_mark(3, 's')
prompt = f"Answer using only this policy:\n{best}\n\nQuestion: {question}"
reply = client.chat.completions.create(model="gpt-4o-mini", messages=[{"role": "user", "content": prompt}])
print(reply.choices[0].message.content)
_mark(3, 'e')
