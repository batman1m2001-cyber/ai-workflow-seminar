from langchain.agents import create_agent
from langchain.agents.middleware import (HumanInTheLoopMiddleware, ModelCallLimitMiddleware,
                                         ModelRetryMiddleware, ToolCallLimitMiddleware)
from langchain.tools import tool
from langchain_openai import ChatOpenAI
from langgraph.checkpoint.memory import InMemorySaver


@tool
def send_email(to: str, subject: str, body: str) -> str:
    """Send an email."""
    return f"sent to {to}"


agent = create_agent(
    ChatOpenAI(model="gpt-4o-mini"), tools=[send_email],
    middleware=[
        ModelRetryMiddleware(max_retries=2),                             # retries
        ModelCallLimitMiddleware(run_limit=5),                           # budgets
        ToolCallLimitMiddleware(run_limit=3),
        HumanInTheLoopMiddleware(interrupt_on={"send_email": True}),     # approval
    ],
    checkpointer=InMemorySaver(),                                        # checkpoints
)
config = {"configurable": {"thread_id": "inbox-1"}}
result = agent.invoke({"messages": [{"role": "user", "content": 'Send an email to abc@company.com saying "Xin chào"'}]}, config)
print("paused for a human:", "__interrupt__" in result)
for i in result.get("__interrupt__", []):
    print(i.value["action_requests"][0]["name"], i.value["action_requests"][0]["args"])
