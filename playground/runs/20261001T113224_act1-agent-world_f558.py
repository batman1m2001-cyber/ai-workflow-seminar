from langchain.agents import create_agent
from langchain.agents.middleware import ClearToolUsesEdit, ContextEditingMiddleware, SummarizationMiddleware
from langchain.tools import tool
from langchain_openai import ChatOpenAI


@tool
def order_status(order_id: str) -> str:
    """Look up an order: its status and any refund."""
    return f"{order_id}: delivered, refund of $42 approved on 28 Sep"


model = ChatOpenAI(model="gpt-4o-mini")
agent = create_agent(model, tools=[order_status], middleware=[
    SummarizationMiddleware(model=model, trigger=("tokens", 300), keep=("messages", 4)),   # compaction
    ContextEditingMiddleware(edits=[ClearToolUsesEdit(trigger=200, keep=1)]),             # clearing
])

history = []
for i in range(12):                                   # a long earlier conversation
    history += [{"role": "user", "content": f"Earlier question {i} about shipping times and delivery windows."},
                {"role": "assistant", "content": f"Earlier answer {i}: standard shipping takes 3 to 5 days."}]
history.append({"role": "user", "content": "Where is my refund for order A-1001?"})

result = agent.invoke({"messages": history})
print("messages in:", len(history), "-> kept:", len(result["messages"]))
print("first message now:", str(result["messages"][0].content)[:110])
print("answer:", result["messages"][-1].content[:90])
