"""agent.py: the meeting-prep assistant, from scratch. Linh's email in, a brief for sales out."""

import json
import os

import httpx
from prep_world import golden
from prep_world.mail import as_email

API, KEY = os.environ["OPENAI_BASE_URL"], os.environ["OPENAI_API_KEY"]
MODEL = os.environ.get("AGENT_MODEL", "gpt-4o-mini")


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



# ── prepare: the flow, box by box ─────────────────────────────────────────────
def prepare(email):
    lead = email_agent(email)
    return lead


print(prepare(read_email()))
