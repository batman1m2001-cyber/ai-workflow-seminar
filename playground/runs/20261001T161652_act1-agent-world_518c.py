from prep_world import db

question = "Have we worked with Saigon Fresh Foods on invoices before?"
q = db.embed([question])[0]
print(f"{len(q)} numbers")
hits = db.rows(
    "SELECT company_id, content, (embedding <=> %s::vector)::float AS distance "
    "FROM kb_chunks ORDER BY distance LIMIT 2", db.vec(q))
for h in hits:
    print(round(h["distance"], 3), h["content"][:70])
from openai import OpenAI

context = "\n".join(h["content"] for h in hits)
prompt = f"Answer from the context only.\n\nContext:\n{context}\n\nQuestion: {question}"
print(OpenAI().chat.completions.create(model="gpt-4o-mini",
      messages=[{"role": "user", "content": prompt}]).choices[0].message.content)