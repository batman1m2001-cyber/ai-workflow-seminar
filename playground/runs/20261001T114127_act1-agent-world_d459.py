from langchain.tools import tool
from langchain_openai import ChatOpenAI


@tool
def order_status(order_id: str) -> str:
    """Look up an order: its status and any refund."""
    return f"{order_id}: delivered, refund of $42 approved on 28 Sep"


model = ChatOpenAI(model="gpt-4o-mini").bind_tools([order_status])
msg = model.invoke("Where is my refund for order A-1001?")
print("text:", repr(msg.content))
print("tool calls:", msg.tool_calls)
