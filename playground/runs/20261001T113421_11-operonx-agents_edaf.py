import asyncio
import json
import operonx
from operonx import END, PARENT, START, Operon, graph, op
from operonx.core.ops import if_
from operonx.providers import LLMOp

KB = {"python": "Python is a programming language from 1991.",
      "machine learning": "Machine learning fits models to data."}
TOOLS = {"calculator": lambda expression: {"result": eval(expression, {"__builtins__": {}})},
         "search": lambda query: {"result": next((v for k, v in KB.items() if k in query.lower()), "no result")}}
TOOL_DESCRIPTIONS = [
    {"type": "function", "function": {"name": "calculator", "description": "Evaluate arithmetic.",
      "parameters": {"type": "object", "properties": {"expression": {"type": "string"}}, "required": ["expression"]}}},
    {"type": "function", "function": {"name": "search", "description": "Search the knowledge base.",
      "parameters": {"type": "object", "properties": {"query": {"type": "string"}}, "required": ["query"]}}},
]


@op
def init_agent(query: str) -> dict:
    return {"messages": [{"role": "user", "content": query}], "done": False, "answer": ""}


@op
def process_response(content: str = None, tool_calls: list = None, messages: list = None) -> dict:
    new = list(messages or [])
    if tool_calls:
        new.append({"role": "assistant", "content": content, "tool_calls": tool_calls})
        for tc in tool_calls:
            args = json.loads(tc["function"]["arguments"])
            out = TOOLS[tc["function"]["name"]](**args)
            print(f"  tool {tc['function']['name']}({args}) -> {out}")
            new.append({"role": "tool", "tool_call_id": tc["id"], "content": json.dumps(out)})
        return {"messages": new, "done": False, "answer": ""}
    return {"messages": new, "done": True, "answer": content or ""}


@graph
def agent_loop():
    PARENT.declare(messages=[], done=False, answer="")
    llm = LLMOp.of(resource="gpt-4o-mini", messages=PARENT["messages"], tools=TOOL_DESCRIPTIONS)
    proc = process_response(content=llm["content"], tool_calls=llm["tool_calls"], messages=PARENT["messages"])
    proc["messages"] >> PARENT["messages"]
    proc["done"] >> PARENT["done"]
    proc["answer"] >> PARENT["answer"]
    START >> llm >> proc >> if_(proc["done"] == True, END).else_(llm)  # noqa: E712 — the loop is this edge


@graph
def agent(query):
    init = init_agent(query=query)
    loop = agent_loop()
    init["messages"] >> loop["messages"]
    init["done"] >> loop["done"]
    init["answer"] >> loop["answer"]
    loop["answer"] >> PARENT["answer"]
    START >> init >> loop >> END


@op
def triage(ticket: str) -> dict:
    return {"query": ticket.strip(), "priority": "high" if "urgent" in ticket.lower() else "normal"}


@op
def format_reply(answer: str, priority: str) -> dict:
    return {"reply": f"[{priority}] {answer}"}


@graph
def support(ticket):                               # the workflow
    t = triage(ticket=ticket)
    a = agent(query=t["query"])                    # the agent: one node
    f = format_reply(answer=a["answer"], priority=t["priority"])
    START >> t >> a >> f >> END


async def main():
    operonx.bootstrap(resources="resources.yaml")
    out = await Operon(support(ticket=PARENT["ticket"]), trace=["trace_local:default"]).run(
        inputs={"ticket": "URGENT: what is 15 * 7, and tell me about machine learning?"})
    print(out["reply"])

asyncio.run(main())
