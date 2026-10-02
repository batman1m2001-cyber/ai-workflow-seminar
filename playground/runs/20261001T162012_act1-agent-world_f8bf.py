import json
import httpx
from langchain.agents import create_agent
from langchain.agents.middleware import ClearToolUsesEdit, ContextEditingMiddleware
from langchain.tools import tool
from langchain_openai import ChatOpenAI
from prep_world import WEB
from prep_world.guard import visible_text


@tool
def web_search(query: str) -> str:
    """Search the web. Returns titles, links and snippets."""
    return httpx.get(f"{WEB}/search", params={"q": query}).text


@tool
def fetch_page(url: str) -> str:
    """Read a web page: its visible text."""
    return visible_text(httpx.get(url).text)


sent = []                                   # what the model actually receives, request by request
spy = httpx.Client(event_hooks={"request": [lambda r: sent.append(json.loads(r.content))]})

agent = create_agent(ChatOpenAI(model="gpt-4o-mini", http_client=spy), tools=[web_search, fetch_page], middleware=[
    ContextEditingMiddleware(edits=[ClearToolUsesEdit(trigger=200, keep=1)]),   # keep only the newest result
])
agent.invoke({"messages": [{"role": "user", "content": "Find out about Lotus Logistics news."}]})
print("the last request carried:")
for m in sent[-1]["messages"]:
    if m["role"] == "tool":
        print(f"  tool result: {len(str(m['content'])):5d} chars  {str(m['content'])[:44]!r}")
