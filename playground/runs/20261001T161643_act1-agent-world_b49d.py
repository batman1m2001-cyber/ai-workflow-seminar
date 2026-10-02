import httpx
from langchain.agents import create_agent
from langchain.tools import tool
from langchain_openai import ChatOpenAI
from prep_world import WEB
from prep_world.guard import visible_text

requests = 0
def count(request):
    global requests
    requests += 1


@tool
def web_search(query: str) -> str:
    """Search the web. Returns titles, links and snippets."""
    return httpx.get(f"{WEB}/search", params={"q": query}).text


@tool
def fetch_page(url: str) -> str:
    """Read a web page: its visible text."""
    return visible_text(httpx.get(url).text)


model = ChatOpenAI(model="gpt-4o-mini", http_client=httpx.Client(event_hooks={"request": [count]}))
agent = create_agent(model, tools=[web_search, fetch_page], system_prompt="You research companies for sales meetings.")
result = agent.invoke({"messages": [{"role": "user", "content": "Find out about Lotus Logistics news."}]})
for m in result["messages"]:
    calls = [c["name"] for c in getattr(m, "tool_calls", []) or []]
    print(f"{type(m).__name__:>12} | {str(m.content)[:50]!r} {calls or ''}")
print("HTTP requests:", requests)
