import os, json, httpx
from typing import TypedDict
from langgraph.graph import StateGraph, START, END
from langchain_openai import ChatOpenAI
from langchain.agents import create_agent
from langchain.tools import tool

def spy(request):
    body = json.loads(request.content)
    tools = [t["function"]["name"] for t in body.get("tools", [])]
    print(f"--> POST {request.url.path}  messages={len(body['messages'])}  tools={tools}")
    for m in body["messages"]:
        print("      ", m["role"], "|", str(m.get("content"))[:60], "|", [c["function"]["name"] for c in m.get("tool_calls", [])] or "")

@tool
def calculator(expression: str) -> str:
    """Evaluate an arithmetic expression."""
    return str(eval(expression, {"__builtins__": {}}))

model = ChatOpenAI(model=os.getenv("SEMINAR_MODEL", "gpt-4o-mini"), http_client=httpx.Client(event_hooks={"request": [spy]}))
agent = create_agent(model, tools=[calculator])
print(agent.invoke({"messages": [{"role": "user", "content": "What is 25 * 4 + 100?"}]})["messages"][-1].content)

class S(TypedDict):
    message: str
    intent: str
    reply: str

def classify(s: S):
    return {"intent": "refund" if "refund" in s["message"] else "other"}
def refund(s: S): return {"reply": "open a refund ticket"}
def other(s: S): return {"reply": "answer from the FAQ"}
g = StateGraph(S)
g.add_node("classify", classify); g.add_node("refund", refund); g.add_node("other", other)
g.add_edge(START, "classify")
g.add_conditional_edges("classify", lambda s: s["intent"], {"refund": "refund", "other": "other"})
g.add_edge("refund", END); g.add_edge("other", END)
app = g.compile()
print(app.invoke({"message": "I want a refund"}))
print(app.get_graph().draw_mermaid()[:300])
