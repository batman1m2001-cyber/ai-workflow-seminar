import os
from langchain_openai import ChatOpenAI
from langchain.agents import create_agent
from langchain.tools import tool

@tool
def calculator(expression: str) -> str:
    """Evaluate an arithmetic expression."""
    return str(eval(expression, {"__builtins__": {}}))

@tool
def search(query: str) -> str:
    """Search the knowledge base."""
    return "Machine learning is fitting models to data."

model = ChatOpenAI(model=os.getenv("SEMINAR_MODEL", "gpt-4o-mini"))
agent = create_agent(model, tools=[calculator, search])
out = agent.invoke({"messages": [{"role": "user", "content": "What is 15 * 7, and also tell me about machine learning?"}]})
for m in out["messages"]:
    print(type(m).__name__, "|", (m.content or "")[:80], "|", getattr(m, "tool_calls", None))
