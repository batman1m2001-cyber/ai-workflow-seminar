import asyncio, operonx
from operonx import END, PARENT, START, Operon, graph, op
from operonx.providers import LLMOp

@graph
def two(message):
    good = LLMOp.of(resource="gpt-4o-mini", prompt="Intent of: {message}. Reply as <intent>...</intent>", fields=["intent: str"], message=message)
    bad = LLMOp.of(resource="gpt-4o-mini", prompt="Intent of: {message}. One word.", fields=["intent: str"], message=message)
    START >> [good, bad] >> END

@op
def boom(x: int) -> dict:
    raise ValueError("model reply unparseable")
    return {"y": x}

@op
def after(y: int) -> dict:
    return {"z": y + 1}

@graph
def failing(x):
    b = boom(x=x); a = after(y=b["y"])
    START >> b >> a >> END

TOOLS=[{"type":"function","function":{"name":"calculator","description":"math","parameters":{"type":"object","properties":{"expression":{"type":"string"}},"required":["expression"]}}}]
@graph
def tc(q):
    llm = LLMOp.of(resource="gpt-4o-mini", messages=[{"role":"user","content":"What is 2 * 21?"}], tools=TOOLS)
    START >> llm >> END

async def main():
    operonx.bootstrap(resources="resources.yaml")
    g = two(message=PARENT["message"])
    out = await Operon(g).run(inputs={"message": "I want a refund"})
    print({k: v for k, v in out.items() if k in ("intent", "error", "$errors")})
    print(await Operon(g).run(inputs={"message": "refund"}) .__class__)
    out = await Operon(failing, params={"x": None}).run(inputs={"x": 1})
    print("failing:", {k: v for k, v in out.items() if k != "$state"})
    out = await Operon(tc, params={"q": None}).run(inputs={"q": 1})
    print("tool_calls:", out["tool_calls"])
asyncio.run(main())
