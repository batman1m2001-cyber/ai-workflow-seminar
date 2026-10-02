"""agent.py: Linh's email in, a brief for sales out. From scratch: no agent framework."""

import json
import os

import httpx
from prep_world import golden
from prep_world.mail import as_email

API, KEY = os.environ["OPENAI_BASE_URL"], os.environ["OPENAI_API_KEY"]
MODEL = os.environ.get("AGENT_MODEL", "gpt-4o-mini")


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


def prepare(email):
    """The whole job, step by step."""
    lead = parse(llm(build_prompt(email)))
    return lead


print(prepare(read_email()))
