"""agent.py: the meeting-prep assistant, from scratch. Linh's email in, a brief for sales out."""

import json
import os

import httpx
from prep_world import golden
from prep_world import db
from prep_world.mail import as_email

API, KEY = os.environ["OPENAI_BASE_URL"], os.environ["OPENAI_API_KEY"]
MODEL = os.environ.get("AGENT_MODEL", "gpt-4o-mini")
EMBED_MODEL = os.environ.get("SEMINAR_EMBED_MODEL", "text-embedding-3-small")


# ── the model: one HTTP POST, messages in, text out ─────────────────────────

def llm(messages):
    r = httpx.post(f"{API}/chat/completions", headers={"Authorization": f"Bearer {KEY}"},
                   json={"model": MODEL, "messages": messages}, timeout=60)
    return r.json()["choices"][0]["message"]["content"]


# ── email_agent: is this email a lead? (layer 1) ────────────────────────────

def read_email(email_id="lotus-intro"):
    """This morning's mail, as a dict."""
    return as_email(next(g for g in golden() if g["id"] == email_id))


def triage_prompt(email):
    """Prompt engineering: an f-string."""
    return [{"role": "system", "content": "Read the email. Reply with JSON only: "
                                          '{"is_lead": true, "company": "...", "domain": "...", "intent": "...", "contact": "..."}'},
            {"role": "user", "content": f"From: {email['from_name']} <{email['from']}>\n\n{email['text']}"}]


def parse(reply):
    """Structured output: json.loads, plus a check."""
    lead = json.loads(reply)
    assert lead.get("company"), "the model named no company"
    return lead


def email_agent(email):
    """One LLM call reads the letter; code checks what it says."""
    return parse(llm(triage_prompt(email)))


# ── company_info: what we already know (layer 2: RAG) ───────────────────────

def embed(text):
    """Text to a vector of numbers: one HTTP POST."""
    r = httpx.post(f"{API}/embeddings", headers={"Authorization": f"Bearer {KEY}"},
                   json={"model": EMBED_MODEL, "input": [text]}, timeout=60)
    return r.json()["data"][0]["embedding"]


def recall(question, k=3):
    """Our notes nearest to the question. The "vector store" is a table."""
    q = "[" + ",".join(map(str, embed(question))) + "]"
    return [r["content"] for r in db.rows("SELECT content, embedding <=> %s::vector AS distance FROM kb_chunks "
                                          "ORDER BY distance LIMIT %s", q, k)]


def company_info(lead):
    """Our past notes about this company."""
    return recall(f"{lead['company']}: {lead['intent']}")


# ── report_agent: write the brief (layer 2) ─────────────────────────────────

def brief_prompt(lead, evidence):
    """The brief's prompt: the lead and the evidence, pasted in."""
    facts = "\n".join(f"- {e}" for e in evidence)
    return [{"role": "system", "content": "Write a one-page meeting brief for sales, in short bullets. Use only the evidence. "
                                          "No placeholders like [Insert date]: if a fact is missing, leave the line out."},
            {"role": "user", "content": f"Lead: {json.dumps(lead)}\n\nEvidence:\n{facts}"}]


def report_agent(lead, evidence):
    """One LLM call writes the brief."""
    return llm(brief_prompt(lead, evidence))



# ── prepare: the flow, box by box ─────────────────────────────────────────────
def prepare(email):
    lead = email_agent(email)
    notes = company_info(lead)
    return report_agent(lead, notes)


print(prepare(read_email()))
