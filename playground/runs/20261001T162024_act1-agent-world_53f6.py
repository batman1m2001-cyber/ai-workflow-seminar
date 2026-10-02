import inspect, json
import httpx
from openai import OpenAI
from prep_world import WEB
from prep_world.guard import visible_text

def web_search(query: str) -> str:
    """Search the web. Returns titles, links and snippets."""
    return httpx.get(f"{WEB}/search", params={"q": query}).text

def fetch_page(url: str) -> str:
    """Read a web page: its visible text."""
    return visible_text(httpx.get(url).text)

TOOLS = {f.__name__: f for f in (web_search, fetch_page)}
SCHEMAS = [{"type": "function", "function": {"name": n, "description": f.__doc__, "parameters": {"type": "object",
            "properties": {p: {"type": "string"} for p in inspect.signature(f).parameters}}}} for n, f in TOOLS.items()]
print(list(TOOLS))
messages = [{"role": "system", "content": "You research companies for sales meetings."},
            {"role": "user", "content": "Find out about Lotus Logistics news."}]
print(f"{len(messages)} messages")
client = OpenAI()
for turn in range(1, 9):                                   # the "agent"
    msg = client.chat.completions.create(model="gpt-4o-mini", messages=messages, tools=SCHEMAS).choices[0].message
    if not msg.tool_calls:                                 # the model says: done
        break
    messages.append(msg.model_dump(exclude_none=True))
    for c in msg.tool_calls:
        out = TOOLS[c.function.name](**json.loads(c.function.arguments))
        messages.append({"role": "tool", "tool_call_id": c.id, "content": out})
        print(f"turn {turn}: {c.function.name} -> {len(out)} chars")
print(f"turn {turn}: answer")
print(msg.content[:300])