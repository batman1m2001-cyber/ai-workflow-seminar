import asyncio
from operonx import END, PARENT, START, Operon, graph, op
from operonx.core.ops import if_


@op
def attempt(n: int) -> dict:
    ok = n + 1 >= 3                               # pretend attempts 1 and 2 fail validation
    print(f"attempt {n + 1}: {'passed' if ok else 'failed, retrying'}")
    return {"n": n + 1, "done": ok}


@graph
def retry():
    PARENT.declare(n=0)                           # loop state: a cell
    a = attempt(n=PARENT["n"])
    a["n"] >> PARENT["n"]                         # write it back every iteration
    START >> a >> if_(a["done"] == True, END).else_(a)  # noqa: E712 — else_ is the back-edge


out = asyncio.run(Operon(retry).run(inputs={}))
print("values of n per iteration:", out["n"])
