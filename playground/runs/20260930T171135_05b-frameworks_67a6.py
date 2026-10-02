import os
from langchain.agents import create_agent
from langchain.tools import tool
from langchain_openai import ChatOpenAI


@tool
def calculator(expression: str) -> str:
    """Evaluate an arithmetic expression."""
    return str(eval(expression, {"__builtins__": {}}))


@tool
def search(query: str) -> str:
    """Search the knowledge base."""
    return "Machine learning is fitting models to data to make predictions."


model = ChatOpenAI(model=os.getenv("SEMINAR_MODEL", "gpt-4o-mini"))
agent = create_agent(model, tools=[calculator, search])

result = agent.invoke({"messages": [{"role": "user",
                                     "content": "What is 15 * 7, and also tell me about machine learning?"}]})
for m in result["messages"]:
    calls = [c["name"] for c in getattr(m, "tool_calls", []) or []]
    print(f"{type(m).__name__:>12} | {str(m.content)[:70]} {calls or ''}")
