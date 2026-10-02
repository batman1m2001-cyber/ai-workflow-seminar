import json
import os
import httpx
from langchain.agents import create_agent
from langchain.tools import tool
from langchain_openai import ChatOpenAI

turn = 0


def spy(request: httpx.Request):
    global turn
    turn += 1
    body = json.loads(request.content)
    print(f"--- request {turn}: {len(body['messages'])} messages, tools={[t['function']['name'] for t in body.get('tools', [])]}")
    for m in body["messages"]:
        calls = [c["function"]["name"] for c in m.get("tool_calls", [])]
        print(f"      {m['role']:>9} | {str(m.get('content'))[:50]} {calls or ''}")


@tool
def calculator(expression: str) -> str:
    """Evaluate an arithmetic expression."""
    return str(eval(expression, {"__builtins__": {}}))


model = ChatOpenAI(model=os.getenv("SEMINAR_MODEL", "gpt-4o-mini"),
                   http_client=httpx.Client(event_hooks={"request": [spy]}))
agent = create_agent(model, tools=[calculator])
answer = agent.invoke({"messages": [{"role": "user", "content": "What is 25 * 4 + 100?"}]})
print("\nanswer:", answer["messages"][-1].content)
