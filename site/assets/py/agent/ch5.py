"""agent.py: Linh's email in, a brief for sales out. From scratch: no agent framework."""

import inspect
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
                                          "Use only the evidence. No placeholders like [Insert date]: "
                                          "if a fact is missing, leave the line out."},
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


def web_search(query):
    """Search the web. Returns titles, links and snippets."""
    return httpx.get(f"{WEB}/search", params={"q": query}).text


def fetch_page(url):
    """Read a web page: the text a person would see."""
    return visible_text(httpx.get(url).text)[:4000]


LOCAL = {f.__name__: f for f in (web_search, fetch_page)}
LOCAL_TOOLS = [{"name": n, "description": f.__doc__,
                "inputSchema": {"properties": {p: {"type": "string"} for p in inspect.signature(f).parameters},
                                "required": list(inspect.signature(f).parameters)}} for n, f in LOCAL.items()]


def run_tool(server, call):
    """Our code runs the tool: a local function, or the MCP server."""
    if call["tool"] in LOCAL:
        return LOCAL[call["tool"]](**call["args"])
    return call_tool(server, call)


MEMORY = Path("site/assets/py/agent/AGENTS.md")


def tokens(messages):
    return sum(len(m["content"]) for m in messages) // 4


def assemble_context(messages):
    """Context engineering: what the model sees this turn. Standing notes come from a file;
    results already read shrink to one line; the newest one stays whole."""
    last = max((i for i, m in enumerate(messages) if m["content"].startswith("Result of ")), default=-1)
    seen = [dict(m, content=m["content"].split("\n")[0] + " (already read: cleared)")
            if m["content"].startswith("Result of ") and i != last else m for i, m in enumerate(messages)]
    context = seen[:1] + [{"role": "system", "content": "Standing notes (AGENTS.md):\n" + MEMORY.read_text()}] + seen[1:]
    print(f"context: {tokens(messages)} -> {tokens(context)} tokens\n", end="")
    return context


def research(server, tools, task, max_turns=8):
    """The agent: ask the model, run the tool it picks, show it the result, repeat until it answers."""
    messages = tools_prompt(tools, task)
    for turn in range(1, max_turns + 1):
        reply = llm(assemble_context(messages))
        call = parse_tool_call(reply)
        if call is None:                                    # no tool asked for: the model is done
            print(f"requests to the model: {turn}\n", end="")
            return reply
        result = run_tool(server, call)
        messages += [{"role": "assistant", "content": reply},
                     {"role": "user", "content": f"Result of {call['tool']}:\n{result}"}]
    return "(out of turns)"


def prepare(email):
    """The whole job, step by step."""
    lead = parse(llm(build_prompt(email)))
    notes = recall(f"{lead['company']}: {lead['intent']}")
    crm = start_mcp()
    tools = list_tools(crm) + LOCAL_TOOLS
    findings = research(crm, tools, f"Research {lead['company']} ({lead['domain']}) for a sales meeting: "
                                    "find it in the CRM, then web_search for news, then fetch_page the best result, then answer.")
    return llm(brief_prompt(lead, notes, findings))


print(prepare(read_email()))
