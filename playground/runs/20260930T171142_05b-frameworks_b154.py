from typing import TypedDict
from langgraph.graph import END, START, StateGraph


class State(TypedDict):
    message: str
    intent: str
    reply: str


def classify(s: State):                      # an LLM call in real life
    return {"intent": "refund" if "refund" in s["message"].lower() else "other"}


def refund(s: State):  return {"reply": "→ open a refund ticket"}
def other(s: State):   return {"reply": "→ answer from the FAQ"}


g = StateGraph(State)
g.add_node("classify", classify)
g.add_node("refund", refund)
g.add_node("other", other)
g.add_edge(START, "classify")
g.add_conditional_edges("classify", lambda s: s["intent"], {"refund": "refund", "other": "other"})
g.add_edge("refund", END)
g.add_edge("other", END)
app = g.compile()

for msg in ["I want a refund", "What are your hours?"]:
    print(app.invoke({"message": msg}))
