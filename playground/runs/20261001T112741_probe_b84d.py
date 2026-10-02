from langchain.agents import create_agent
from langchain.agents.middleware import (HumanInTheLoopMiddleware, ModelCallLimitMiddleware,
                                         ModelRetryMiddleware, PIIMiddleware, ToolCallLimitMiddleware)
from langchain.tools import tool
from langchain_openai import ChatOpenAI
from langgraph.checkpoint.memory import InMemorySaver


@tool
def issue_refund(order_id: str, amount: float) -> str:
    """Pay a refund to the customer's card."""
    return f"refunded {amount} for {order_id}"


agent = create_agent(
    ChatOpenAI(model="gpt-4o-mini"), tools=[issue_refund],
    middleware=[
        ModelRetryMiddleware(max_retries=2),                                  # retries
        ModelCallLimitMiddleware(run_limit=5),                                # budget
        ToolCallLimitMiddleware(run_limit=3),
        PIIMiddleware("credit_card", strategy="redact"),                      # guardrail
        HumanInTheLoopMiddleware(interrupt_on={"issue_refund": True}),        # approval
    ],
    checkpointer=InMemorySaver(),                                             # checkpoints
)
config = {"configurable": {"thread_id": "ticket-1001"}}
result = agent.invoke({"messages": [{"role": "user", "content": "Refund $42 for order A-1001 please"}]}, config)
print("paused for approval:", "__interrupt__" in result)
for i in result.get("__interrupt__", []):
    print(str(i.value)[:200])
