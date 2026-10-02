"""agent.py: Linh's email in, a brief for sales out. From scratch: no agent framework."""

import json
import os

import httpx
from prep_world import golden
from prep_world import db
from prep_world.mail import as_email

API, KEY = os.environ["OPENAI_BASE_URL"], os.environ["OPENAI_API_KEY"]
MODEL = os.environ.get("AGENT_MODEL", "gpt-4o-mini")
EMBED_MODEL = os.environ.get("SEMINAR_EMBED_MODEL", "text-embedding-3-small")


def read_email(email_id="lotus-intro"):
    """This morning's mail, as a dict."""
    return as_email(next(g for g in golden() if g["id"] == email_id))


def build_prompt(email):
    """Prompt engineering: an f-string."""
    return [{"role": "system", "content": "Read the email. Reply with JSON only: "
                                          '{"company": "...", "domain": "...", "intent": "...", "contact": "..."}'},
            {"role": "user", "content": f"From: {email['from_name']} <{email['from']}>\n\n{email['text']}"}]


def llm(messages):
    """The model: one HTTP POST. Messages in, text out."""
    r = httpx.post(f"{API}/chat/completions", headers={"Authorization": f"Bearer {KEY}"},
                   json={"model": MODEL, "messages": messages}, timeout=60)
    return r.json()["choices"][0]["message"]["content"]


def parse(reply):
    """Structured output: json.loads, plus a check."""
    lead = json.loads(reply)
    assert lead.get("company"), "the model named no company"
    return lead


def embed(text):
    """Text to a vector of numbers: one HTTP POST."""
    r = httpx.post(f"{API}/embeddings", headers={"Authorization": f"Bearer {KEY}"},
                   json={"model": EMBED_MODEL, "input": [text]}, timeout=60)
    return r.json()["data"][0]["embedding"]


def recall(question, k=3):
    """RAG: our notes nearest to the question. The "vector store" is a table."""
    q = "[" + ",".join(map(str, embed(question))) + "]"
    return db.rows("SELECT content, embedding <=> %s::vector AS distance FROM kb_chunks "
                   "ORDER BY distance LIMIT %s", q, k)


def brief_prompt(lead, notes):
    """The brief's prompt: the lead and our notes, pasted in."""
    evidence = "\n".join(f"- {n['content']}" for n in notes)
    return [{"role": "system", "content": "Write a one-page meeting brief for sales, in short bullets. "
                                          "Use only the evidence. No placeholders like [Insert date]: "
                                          "if a fact is missing, leave the line out."},
            {"role": "user", "content": f"Lead: {json.dumps(lead)}\n\nEvidence:\n{evidence}"}]


def prepare(email):
    """The whole job, step by step."""
    lead = parse(llm(build_prompt(email)))
    notes = recall(f"{lead['company']}: {lead['intent']}")
    return llm(brief_prompt(lead, notes))


print(prepare(read_email()))
