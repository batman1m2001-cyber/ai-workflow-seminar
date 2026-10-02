docs = [
    "Refunds are paid to the original card within 5 business days.",
    "Orders can be cancelled free of charge before they ship.",
    "Gift cards cannot be refunded.",
]
print(f"{len(docs)} documents")
import numpy as np
from openai import OpenAI

client = OpenAI()

def embed(texts):
    r = client.embeddings.create(model="text-embedding-3-small", input=texts)
    return np.array([d.embedding for d in r.data])

question = "When will my refund be paid?"
doc_vecs, q_vec = embed(docs), embed([question])[0]
print(f"vectors: {doc_vecs.shape}")
scores = doc_vecs @ q_vec
best = docs[int(scores.argmax())]
print(best)
prompt = f"Answer from the context only.\n\nContext:\n{best}\n\nQuestion: {question}"
reply = client.chat.completions.create(model="gpt-4o-mini", messages=[{"role": "user", "content": prompt}])
print(reply.choices[0].message.content)