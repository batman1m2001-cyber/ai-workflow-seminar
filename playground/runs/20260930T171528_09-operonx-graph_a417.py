import asyncio
import time
from operonx import END, START, Operon, graph, op


@op
async def politeness(call: str) -> dict:
    await asyncio.sleep(0.5)                       # stands in for an LLM call
    return {"ok": "ngu" not in call}


@op
async def disclosure(call: str) -> dict:
    await asyncio.sleep(0.5)
    return {"ok": "em là" in call}


@op
async def card_number(call: str) -> dict:
    await asyncio.sleep(0.5)
    return {"ok": "4111" not in call}


@op
def merge(polite: bool, disclosed: bool, card: bool) -> dict:
    return {"verdict": {"politeness": polite, "disclosure": disclosed, "card_number": card}}


@graph
def qc(call):
    p, d, c = politeness(call=call), disclosure(call=call), card_number(call=call)
    m = merge(polite=p["ok"], disclosed=d["ok"], card=c["ok"])
    START >> [p, d, c] >> m >> END


t = time.perf_counter()
out = asyncio.run(Operon(qc, params={"call": None}).run(inputs={"call": "Chào anh, em là Lan. Số thẻ 4111..."}))
print(out["verdict"])
print(f"{time.perf_counter() - t:.2f} s for three 0.5 s checks")
