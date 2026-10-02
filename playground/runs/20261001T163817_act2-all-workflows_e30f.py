company = "Lotus Logistics"
focuses = ["what it does and sells", "news", "team"]
print(focuses)
import asyncio, json, time
import httpx
from openai import AsyncOpenAI
from prep_world import WEB
from prep_world.guard import visible_text

SCHEMAS = [{"type": "function", "function": {"name": n, "description": d, "parameters": {"type": "object",
            "properties": {a: {"type": "string"}}}}} for n, d, a in
           [("web_search", "Search the web. Returns titles, links and snippets.", "query"),
            ("fetch_page", "Read a web page: its visible text.", "url")]]

async def tool(name, args, web):
    if name == "web_search":
        return (await web.get(f"{WEB}/search", params={"q": args["query"]})).text
    return visible_text((await web.get(args["url"])).text)

async def worker(focus, client, web):
    messages = [{"role": "user", "content": f"Research {company}: {focus}. Find out about {company} {focus}."}]
    for turn in range(1, 6):
        msg = (await client.chat.completions.create(model="gpt-4o-mini", messages=messages, tools=SCHEMAS)).choices[0].message
        if not msg.tool_calls:
            return focus, turn, msg.content
        messages.append(msg.model_dump(exclude_none=True))
        for c in msg.tool_calls:
            messages.append({"role": "tool", "tool_call_id": c.id,
                             "content": await tool(c.function.name, json.loads(c.function.arguments), web)})
    return focus, turn, "(out of turns)"

async def team():
    async with httpx.AsyncClient() as web:
        return await asyncio.gather(*(worker(f, AsyncOpenAI(), web) for f in focuses))

t0 = time.perf_counter()
results = asyncio.run(team())
for focus, turns, _ in results:
    print(f"{focus:<24} {turns} model calls")
print(f"three agents in {time.perf_counter() - t0:.1f}s, side by side")
merged = "\n".join(f"- {focus}: {answer[:60]}" for focus, _, answer in results)
print(merged)