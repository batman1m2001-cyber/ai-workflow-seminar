import httpx
from langchain.agents import create_agent
from langchain.tools import tool
from langchain_openai import ChatOpenAI

requests = 0
def count(request):
    global requests
    requests += 1


@tool
def order_status(order_id: str) -> str:
    """Look up an order: its status and any refund."""
    return f"{order_id}: delivered, refund of $42 approved on 28 Sep"


@tool
def refund_policy(topic: str) -> str:
    """Search the refund policy."""
    return "Refunds are paid to the original card within 5 business days."


model = ChatOpenAI(model="gpt-4o-mini", http_client=httpx.Client(event_hooks={"request": [count]}))
agent = create_agent(model, tools=[order_status, refund_policy], system_prompt="You are a refund assistant.")
result = agent.invoke({"messages": [{"role": "user", "content": "Where is my refund for order A-1001?"}]})
for m in result["messages"]:
    calls = [c["name"] for c in getattr(m, "tool_calls", []) or []]
    print(f"{type(m).__name__:>12} | {str(m.content)[:55]} {calls or ''}")
print("HTTP requests:", requests)
