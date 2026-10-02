"""agent.py: the meeting-prep assistant, from scratch. Linh's email in, a brief for sales out."""

import itertools
import json
import os
import subprocess
import sys
from pathlib import Path

import httpx
from prep_world import WEB, golden
from prep_world import db
from prep_world.guard import visible_text
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


# ── company_info: what we already know (layer 2: RAG · layer 3: MCP) ───────────────────────

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


def company_info(crm, company, lead):
    """Our past notes, plus the CRM's people and history (over MCP)."""
    notes = recall(f"{lead['company']}: {lead['intent']}")
    people = [f"Contact: {p['name']}, {p['title']}" for p in mcp_tool(crm, "crm_contacts", company_id=company["id"])]
    history = [f"History {h['date']}: {h['note']}" for h in mcp_tool(crm, "crm_history", company_id=company["id"])]
    return notes + people + history


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


# ── MCP: the CRM and the calendar are another program (layer 3) ─────────────

IDS = itertools.count(1)


def start_mcp():
    """Start the CRM's MCP server, then talk JSON-RPC over its stdin and stdout."""
    server = subprocess.Popen([sys.executable, "-m", "prep_world.mcp_server"], text=True,
                              stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.DEVNULL)
    mcp_request(server, "initialize", {"protocolVersion": "2025-06-18", "capabilities": {},
                                       "clientInfo": {"name": "agent.py", "version": "1"}})
    server.stdin.write(json.dumps({"jsonrpc": "2.0", "method": "notifications/initialized"}) + "\n")
    return server


def mcp_request(server, method, params):
    """One JSON-RPC line out, one line back: that is all MCP is, on the wire."""
    msg = {"jsonrpc": "2.0", "id": next(IDS), "method": method, "params": params}
    server.stdin.write(json.dumps(msg) + "\n")
    server.stdin.flush()
    while True:
        reply = json.loads(server.stdout.readline())
        if reply.get("id") == msg["id"]:
            return reply["result"]


def mcp_tool(server, name, **args):
    """MCP tools/call: our code calls a tool on the server and reads its JSON."""
    result = mcp_request(server, "tools/call", {"name": name, "arguments": args})
    if "structuredContent" in result:                      # a list comes back as {"result": [...]}
        return result["structuredContent"].get("result", result["structuredContent"])
    return json.loads(result["content"][0]["text"]) if result["content"] else None


def extract_company(crm, email):
    """Who is it? The sender's domain, looked up in the CRM."""
    return mcp_tool(crm, "crm_find_company", domain_or_name=email["from"].rpartition("@")[2])


def calendar(crm, company):
    """Meetings already booked with this company."""
    return [f"Meeting {m['starts_at']}: {m['title']}" for m in mcp_tool(crm, "calendar_meetings", company_id=company["id"])]


# ── web_research: the model picks the tools (layer 3, the loop in layer 4) ────

def web_search(query):
    """Search the web. Returns titles, links and snippets."""
    return httpx.get(f"{WEB}/search", params={"q": query}).text


def fetch_page(url):
    """Read a web page: the text a person would see."""
    return visible_text(httpx.get(url).text)[:4000]


TOOLS = {"web_search": web_search, "fetch_page": fetch_page}


def tools_prompt(task):
    """Function calling, opened: the tools are text in the prompt, and so is the reply format."""
    listing = "\n".join(json.dumps({"name": n, "description": f.__doc__, "arguments": list(f.__code__.co_varnames[:f.__code__.co_argcount])})
                        for n, f in TOOLS.items())
    return [{"role": "system", "content": "You can use these tools:\n" + listing + "\n\n"
                                          'To use one, reply with one line of JSON only: {"tool": "<name>", "args": {...}}\n'
                                          "When you know enough, reply with your answer in plain text."},
            {"role": "user", "content": task}]


def parse_tool_call(reply):
    """The model's reply: a tool call (JSON) or its answer (text)."""
    try:
        call = json.loads(reply)
    except ValueError:
        return None
    return call if isinstance(call, dict) and "tool" in call else None


def run_tool(call):
    """Our code runs the tool the model asked for. The model never runs anything."""
    return TOOLS[call["tool"]](**call["args"])


def research(task, max_turns=8):
    """The agent: ask the model, run the tool it picks, show it the result, repeat until it answers."""
    messages = tools_prompt(task)
    for turn in range(1, max_turns + 1):
        reply = llm(assemble_context(messages))
        call = parse_tool_call(reply)
        if call is None:                                    # no tool asked for: the model is done
            print(f"research: {turn} requests to the model\n", end="")
            return reply
        result = run_tool(call)
        messages += [{"role": "assistant", "content": reply},
                     {"role": "user", "content": f"Result of {call['tool']}:\n{result}"}]
    return "(out of turns)"


def web_research(lead):
    """Research the company on the web: the one real agent."""
    return research(f"Research {lead['company']} ({lead['domain']}) for a sales meeting: "
                    "web_search for news, then fetch_page the best result, then answer.")


# ── context: what the model sees each turn (layer 5) ────────────────────────

MEMORY = Path("site/assets/py/agent/AGENTS.md")


def tokens(messages):
    return sum(len(m["content"]) for m in messages) // 4


def assemble_context(messages):
    """Standing notes from a file; results already read shrink to one line; the newest stays whole."""
    last = max((i for i, m in enumerate(messages) if m["content"].startswith("Result of ")), default=-1)
    seen = [dict(m, content=m["content"].split("\n")[0] + " (already read: cleared)")
            if m["content"].startswith("Result of ") and i != last else m for i, m in enumerate(messages)]
    context = seen[:1] + [{"role": "system", "content": "Standing notes (AGENTS.md):\n" + MEMORY.read_text()}] + seen[1:]
    print(f"context: {tokens(messages)} -> {tokens(context)} tokens\n", end="")
    return context


def memory_agent(*sources):
    """Merge every source into one evidence pack, each fact once: code, not a model."""
    facts = [f for s in sources for f in (s if isinstance(s, list) else [s])]
    return list(dict.fromkeys(facts))



# ── prepare: the flow, box by box ─────────────────────────────────────────────
def prepare(email):
    lead = email_agent(email)
    crm = start_mcp()
    company = extract_company(crm, email)
    info = company_info(crm, company, lead)
    meetings = calendar(crm, company)
    found = web_research(lead)
    evidence = memory_agent(info, meetings, found)
    brief = report_agent(lead, evidence)
    return brief


print(prepare(read_email()))
