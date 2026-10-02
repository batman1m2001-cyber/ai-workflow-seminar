import asyncio
import time
from operonx import END, START, Operon, graph, op

IN_FLIGHT = {"now": 0, "peak": 0}


@op
def calls(n: int):
    for i in range(n):
        yield {"call_id": f"call-{i:02d}"}


@op
async def score(call_id: str) -> dict:
    IN_FLIGHT["now"] += 1
    IN_FLIGHT["peak"] = max(IN_FLIGHT["peak"], IN_FLIGHT["now"])
    await asyncio.sleep(0.2)                         # an LLM call
    IN_FLIGHT["now"] -= 1
    return {"row": {"call": call_id, "score": 0}}


@op
def report(rows: list) -> dict:
    return {"scored": len(rows)}


@graph
def batch(n):
    c = calls(n=n)
    s = score(call_id=c["call_id"].parallel(max=3))   # at most 3 in flight
    r = report(rows=s["row"].collect())                # once, after the last item
    START >> c >> s >> r >> END


t = time.perf_counter()
out = asyncio.run(Operon(batch, params={"n": None}).run(inputs={"n": 12}))
print(f"scored {out['scored']} calls in {time.perf_counter() - t:.2f} s, peak in flight: {IN_FLIGHT['peak']}")
