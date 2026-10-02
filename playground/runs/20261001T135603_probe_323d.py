import json
from typing import TypedDict
from langgraph.graph import END, START, StateGraph
from openai import OpenAI

llm = OpenAI()


class State(TypedDict):
    question: str
    intent: str
    answer: str


def classify(s: State):
    raw = llm.chat.completions.create(model="gpt-4o-mini", messages=[
        {"role": "system", "content": 'Reply as JSON with keys "intent".'}, {"role": "user", "content": s["question"]}])
    return {"intent": json.loads(raw.choices[0].message.content)["intent"]}

def refund(s: State): return {"answer": "A-1001: refund of $42 approved on 28 Sep"}
def faq(s: State):    return {"answer": "See our help centre."}


g = StateGraph(State)
g.add_node("classify", classify)
g.add_node("refund", refund)
g.add_node("faq", faq)
g.add_edge(START, "classify")
g.add_conditional_edges("classify", lambda s: s["intent"] if s["intent"] == "refund" else "faq", ["refund", "faq"])
g.add_edge("refund", END)
g.add_edge("faq", END)
app = g.compile()

print(app.invoke({"question": "Where is my refund for order A-1001?"}))
graph = app.get_graph()
print("nodes:", list(graph.nodes))
for e in graph.edges:
    print(f"  {e.source:>9} -> {e.target:<8} {'(branch)' if e.conditional else ''}")
