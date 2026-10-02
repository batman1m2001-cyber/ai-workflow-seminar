import inspect, json
import httpx
from openai import OpenAI
from prep_world import WEB, db
from prep_world.guard import visible_text

def web_search(query: str) -> str:
    """Search the web. Returns titles, links and snippets."""
    return httpx.get(f"{WEB}/search", params={"q": query}).text

def fetch_page(url: str) -> str:
    """Read a web page: its visible text."""
    return visible_text(httpx.get(url).text)

def crm_lookup(domain: str) -> str:
    """Find a company in our CRM by its email domain."""
    return json.dumps(db.find_company(domain) or {})

TOOLS = {f.__name__: f for f in (web_search, fetch_page, crm_lookup)}
SCHEMAS = [{"type": "function", "function": {"name": n, "description": f.__doc__, "parameters": {"type": "object",
            "properties": {p: {"type": "string"} for p in inspect.signature(f).parameters}}}} for n, f in TOOLS.items()]
print(list(TOOLS))
client, calls = OpenAI(), 0
messages = [{"role": "user", "content": "Prepare a brief on lotus-logistics.example. Find out about Lotus Logistics news."}]
while True:
    calls += 1
    msg = client.chat.completions.create(model="gpt-4o-mini", messages=messages, tools=SCHEMAS).choices[0].message
    if not msg.tool_calls:
        break
    messages.append(msg.model_dump(exclude_none=True))
    for c in msg.tool_calls:
        print(f"model picked: {c.function.name}")
        out = TOOLS[c.function.name](**json.loads(c.function.arguments))
        messages.append({"role": "tool", "tool_call_id": c.id, "content": out})
used = [m["tool_calls"][0]["function"]["name"] for m in messages if m.get("tool_calls")]
print(msg.content[:120])
print(f"model calls: {calls} · path picked by: the model · CRM checked: {'crm_lookup' in used}")