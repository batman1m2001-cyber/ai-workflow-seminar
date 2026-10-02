import urllib.parse
import urllib.request
from langchain.tools import tool
from langchain_openai import ChatOpenAI


@tool
def web_search(query: str) -> str:
    """Search the web. Returns titles, links and snippets."""
    return urllib.request.urlopen("http://127.0.0.1:8100/search?" + urllib.parse.urlencode({"q": query})).read().decode()


msg = ChatOpenAI(model="gpt-4o-mini").bind_tools([web_search]).invoke("Find out about Lotus Logistics news.")
print("text:", repr(msg.content))
print("tool calls:", msg.tool_calls)
