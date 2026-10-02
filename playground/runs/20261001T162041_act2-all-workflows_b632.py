import json
from typing import TypedDict
from langgraph.graph import END, START, StateGraph
from openai import OpenAI
from prep_world import golden
from prep_world.mail import as_email

llm = OpenAI()


class State(TypedDict):
    email: dict
    is_lead: bool
    result: str


def triage(s: State):
    e = s["email"]
    raw = llm.chat.completions.create(model="gpt-4o-mini", messages=[
        {"role": "system", "content": 'Reply as JSON with keys "is_lead".'},
        {"role": "user", "content": f"From: {e['from_name']} <{e['from']}>

{e['text']}"}])
    return {"is_lead": json.loads(raw.choices[0].message.content)["is_lead"]}

def research(s: State): return {"result": "research the company, write a brief"}
def skip(s: State):     return {"result": "not a lead: leave it"}


g = StateGraph(State)
g.add_node("triage", triage)
g.add_node("research", research)
g.add_node("skip", skip)
g.add_edge(START, "triage")
g.add_conditional_edges("triage", lambda s: "research" if s["is_lead"] else "skip", ["research", "skip"])
g.add_edge("research", END)
g.add_edge("skip", END)
app = g.compile()

for gid in ["lotus-intro", "newsletter"]:
    print(gid, "->", app.invoke({"email": as_email(next(x for x in golden() if x["id"] == gid))})["result"])
for e in app.get_graph().edges:
    print(f"  {e.source:>9} -> {e.target:<9} {'(branch)' if e.conditional else ''}")
