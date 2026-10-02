"""agent.py: Linh's email in, a brief for sales out. From scratch: no agent framework."""

import itertools
import json
import os
import subprocess
import sys

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


def brief_prompt(lead, notes, findings):
    """The brief's prompt: the lead, our notes and what research found, pasted in."""
    evidence = "\n".join(f"- {n['content']}" for n in notes) + f"\n- Research: {findings}"
    return [{"role": "system", "content": "Write a one-page meeting brief for sales, in short bullets. "
                                          "Use only the evidence; never write placeholders."},
            {"role": "user", "content": f"Lead: {json.dumps(lead)}\n\nEvidence:\n{evidence}"}]


IDS = itertools.count(1)


def start_mcp():
    """MCP: the CRM is another program. Start it, then talk JSON-RPC over its stdin and stdout."""
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


def list_tools(server):
    """MCP tools/list: the server says what it offers, each tool a JSON schema."""
    return mcp_request(server, "tools/list", {})["tools"]


def call_tool(server, call):
    """MCP tools/call: our code runs the tool. The model never runs anything."""
    result = mcp_request(server, "tools/call", {"name": call["tool"], "arguments": call["args"]})
    return "\n".join(c.get("text", "") for c in result["content"])


def tools_prompt(tools, task):
    """Function calling, opened: the tools are text in the prompt, and so is the reply format."""
    listing = "\n".join(json.dumps({"name": t["name"], "description": t["description"],
                                    "arguments": t["inputSchema"]["properties"]}) for t in tools)
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


def prepare(email):
    """The whole job, step by step."""
    lead = parse(llm(build_prompt(email)))
    notes = recall(f"{lead['company']}: {lead['intent']}")
    crm = start_mcp()
    tools = list_tools(crm)
    call = parse_tool_call(llm(tools_prompt(tools, f"Find {lead['company']} ({lead['domain']}) in the CRM.")))
    findings = call_tool(crm, call)
    return llm(brief_prompt(lead, notes, findings))


print(prepare(read_email()))
