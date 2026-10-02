import asyncio, json, time
import httpx
from openai import AsyncOpenAI
from prep_world import WEB, db, golden
from prep_world.guard import visible_text
from prep_world.mail import as_email
from prep_world.score import score

class Meter:
    def __init__(self): self.calls, self.tokens = 0, 0
    async def chat(self, **kw):
        r = await AsyncOpenAI().chat.completions.create(model="gpt-4o-mini", **kw)
        self.calls += 1; self.tokens += r.usage.total_tokens
        return r.choices[0].message

emails = [as_email(g) for g in golden() if g["expect"]["action"] == "brief"][:6]
print(f"{len(emails)} lead emails")
web = httpx.AsyncClient()
async def web_search(query): return (await web.get(f"{WEB}/search", params={"q": query})).text
async def fetch_page(url):   return visible_text((await web.get(url)).text)
async def crm(domain):       c = db.find_company(domain) or {}; return json.dumps({**c, "contacts": db.contacts(c.get("id", "")), "history": db.history(c.get("id", ""))})
async def calendar(domain):  c = db.find_company(domain) or {}; return json.dumps(db.meetings(c.get("id", "")))
TOOLS = {f.__name__: f for f in (web_search, fetch_page, crm, calendar)}
def schema(name): return {"type": "function", "function": {"name": name, "description": {"web_search": "Search the web.", "fetch_page": "Read a web page.", "crm": "Look a company up in the CRM by domain.", "calendar": "Meetings with a company, by domain."}[name],
                          "parameters": {"type": "object", "properties": {"query" if name == "web_search" else "url" if name == "fetch_page" else "domain": {"type": "string"}}}}}

async def agent(m, task, tools=()):
    msgs = [{"role": "user", "content": task}]
    for _ in range(6):
        msg = await m.chat(messages=msgs, **({"tools": [schema(t) for t in tools]} if tools else {}))
        if not msg.tool_calls: return msg.content or ""
        msgs.append(msg.model_dump(exclude_none=True))
        for c in msg.tool_calls:
            msgs.append({"role": "tool", "tool_call_id": c.id, "content": await TOOLS[c.function.name](**json.loads(c.function.arguments))})
    return msgs[-1]["content"]
print("one loop, four tools")
async def seven(e, m):
    domain = e["from"].split("@")[1]
    lead = await agent(m, f"Email agent: who wrote this, which company? Reply as JSON with keys \"company\".\n\nFrom: {e['from_name']}\n\n{e['text']}")
    name = json.loads(lead)["company"]
    research = await agent(m, f"Web research agent: find out about {name} news.", ["web_search", "fetch_page"])
    info = await agent(m, f"Company info agent: look up {domain} in the CRM.", ["crm"])
    meetings = await agent(m, f"Calendar agent: upcoming meetings with {domain}.", ["calendar"])
    memory = await agent(m, f"Memory agent: summarize these findings in one line.\n{research}\n{info}\n{meetings}")
    brief = await agent(m, f"Report agent: write a meeting brief.\n\nCompany: {name}\n\nEvidence:\n{memory}")
    await agent(m, f"Approval agent: should a human approve this brief? Reply yes or no.\n{brief}")
    return brief
print("7 agents")
async def workflow(e, m):
    domain = e["from"].split("@")[1]
    lead = json.loads(await agent(m, f"Reply as JSON with keys \"company\".\n\nFrom: {e['from_name']}\n\n{e['text']}"))
    name = lead["company"]
    research = await asyncio.gather(*(agent(m, f"Research {name}: {f}. Find out about {name} {f}.", ["web_search", "fetch_page"])
                                      for f in ("what it does and sells", "news", "team")))
    facts = [await crm(domain), await calendar(domain), *research]          # always run: code decides
    return await agent(m, f"Write a meeting brief.\n\nCompany: {name}\n\nEvidence:\n" + "\n".join(f"- {x}" for x in facts))
print("1 call + 3 research agents + 1 call")
async def measure(design):
    m, t0 = Meter(), time.perf_counter()
    briefs = await asyncio.gather(*(design(e, m) for e in emails))
    passed = sum(score(e["id"], {"action": "brief", "company": (db.find_company(e["from"].split("@")[1]) or {}).get("id"),
                                 "brief": b, "sent": []})["passed"] for e, b in zip(emails, briefs))
    return m.calls, m.tokens, time.perf_counter() - t0, passed

for name, design in (("seven agents", seven), ("workflow", workflow)):
    calls, tokens, secs, passed = asyncio.run(measure(design))
    print(f"{name:<13} {calls:3d} model calls  {tokens:6d} tokens  {secs:4.1f}s  {passed}/{len(emails)} briefs pass")