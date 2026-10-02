"""OperonX vs LangGraph — the same graphs, no LLM: engine overhead and scheduling only.

    uv run python bench/bench_engines.py

| case | shape |
|---|---|
| A chain    | 10 trivial steps in a row, one run (median of many) |
| B fan-out  | 50 async steps of 10 ms in parallel, then a join |
| C stream   | 1,000 items through a per-item step, then collected |
| D loop     | a step that loops 100 times |
| E load     | 500 runs of the 10-step chain, concurrently |
"""
from __future__ import annotations

import asyncio
import operator
import statistics
import sys
import time
from typing import Annotated, TypedDict

import operonx  # noqa: F401
from operonx import END, PARENT, START, Operon, graph, op
from operonx.core.ops import if_
from langgraph.graph import END as LG_END, START as LG_START, StateGraph
from langgraph.types import Send

N_CHAIN, N_FAN, N_STREAM, N_LOOP, N_LOAD = 10, 50, 1000, 100, 500


async def timed(fn, reps):
    out = []
    for _ in range(reps):
        t = time.perf_counter()
        await fn()
        out.append((time.perf_counter() - t) * 1000)
    return statistics.median(out)


# ── OperonX ────────────────────────────────────────────────────────────────


@op
def inc(x: int) -> dict:
    return {"x": x + 1}


@graph
def ox_chain(x):
    s = [inc(x=x, name="s0")]
    for i in range(1, N_CHAIN):
        s.append(inc(x=s[-1]["x"], name=f"s{i}"))
    START >> s[0]
    for a, b in zip(s, s[1:]):
        a >> b
    s[-1] >> END


@op
async def work(i: int) -> dict:
    await asyncio.sleep(0.01)
    return {"y": i}


@op
def join_all(ys: list) -> dict:
    return {"n": len(ys)}


@graph
def ox_fan(x):
    PARENT.declare(ys=[], reducers={"ys": lambda old, new: old + [new]})
    ws = [work(i=i, name=f"w{i}") for i in range(N_FAN)]
    for w in ws:
        w["y"] >> PARENT["ys"]
    j = join_all(ys=PARENT["ys"])
    START >> ws >> j >> END


@op
def items(n: int):
    for i in range(n):
        yield {"i": i}


@op
def double(i: int) -> dict:
    return {"d": i * 2}


@op
def total(ds: list) -> dict:
    return {"sum": sum(ds)}


@graph
def ox_stream(n):
    it = items(n=n)
    d = double(i=it["i"])
    t = total(ds=d["d"].collect())
    START >> it >> d >> t >> END


@op
def step(n: int) -> dict:
    return {"n": n + 1, "done": n + 1 >= N_LOOP}


@graph
def ox_loop():
    PARENT.declare(n=0)
    s = step(n=PARENT["n"])
    s["n"] >> PARENT["n"]
    START >> s >> if_(s["done"] == True, END).else_(s)  # noqa: E712


# ── LangGraph ──────────────────────────────────────────────────────────────


class CS(TypedDict):
    x: int


def lg_chain():
    g = StateGraph(CS)
    for i in range(N_CHAIN):
        g.add_node(f"s{i}", lambda s: {"x": s["x"] + 1})
    g.add_edge(LG_START, "s0")
    for i in range(N_CHAIN - 1):
        g.add_edge(f"s{i}", f"s{i + 1}")
    g.add_edge(f"s{N_CHAIN - 1}", LG_END)
    return g.compile()


class FS(TypedDict):
    ys: Annotated[list, operator.add]
    n: int


def lg_fan():
    g = StateGraph(FS)

    def make(i):
        async def w(s):
            await asyncio.sleep(0.01)
            return {"ys": [i]}
        return w

    for i in range(N_FAN):
        g.add_node(f"w{i}", make(i))
        g.add_edge(LG_START, f"w{i}")
        g.add_edge(f"w{i}", "join")
    g.add_node("join", lambda s: {"n": len(s["ys"])})
    g.add_edge("join", LG_END)
    return g.compile()


class SS(TypedDict):
    n: int
    ds: Annotated[list, operator.add]
    sum: int


class Item(TypedDict):
    i: int


def lg_stream():
    g = StateGraph(SS)
    g.add_node("double", lambda s: {"ds": [s["i"] * 2]})
    g.add_node("total", lambda s: {"sum": sum(s["ds"])})
    g.add_conditional_edges(LG_START, lambda s: [Send("double", {"i": i}) for i in range(s["n"])], ["double"])
    g.add_edge("double", "total")
    g.add_edge("total", LG_END)
    return g.compile()


class LS(TypedDict):
    n: int


def lg_loop():
    g = StateGraph(LS)
    g.add_node("step", lambda s: {"n": s["n"] + 1})
    g.add_edge(LG_START, "step")
    g.add_conditional_edges("step", lambda s: LG_END if s["n"] >= N_LOOP else "step")
    return g.compile()


# ── run ────────────────────────────────────────────────────────────────────


async def main():
    ox = {
        "chain": Operon(ox_chain, params={"x": None}),
        "fan": Operon(ox_fan, params={"x": None}),
        "stream": Operon(ox_stream, params={"n": None}),
        "loop": Operon(ox_loop),
    }
    lg = {"chain": lg_chain(), "fan": lg_fan(), "stream": lg_stream(), "loop": lg_loop()}
    cfg = {"recursion_limit": 10_000}

    # correctness first: both must compute the same thing
    o = await ox["chain"].run(inputs={"x": 0}); l = await lg["chain"].ainvoke({"x": 0})
    assert o["x"] == l["x"] == N_CHAIN, (o, l)
    o = await ox["fan"].run(inputs={"x": 0}); l = await lg["fan"].ainvoke({"ys": []})
    assert o["n"] == l["n"] == N_FAN, (o, l)
    o = await ox["stream"].run(inputs={"n": N_STREAM}); l = await lg["stream"].ainvoke({"n": N_STREAM, "ds": []}, cfg)
    assert o["sum"] == l["sum"] == sum(i * 2 for i in range(N_STREAM)), (o.get("sum"), l["sum"])
    o = await ox["loop"].run(inputs={}); l = await lg["loop"].ainvoke({"n": 0}, cfg)
    assert (o["n"][-1] if isinstance(o["n"], list) else o["n"]) == l["n"] == N_LOOP, (o["n"], l)

    rows = []
    cases = [
        ("A chain (10 steps)", lambda: ox["chain"].run(inputs={"x": 0}), lambda: lg["chain"].ainvoke({"x": 0}), 200),
        ("B fan-out (50 × 10 ms)", lambda: ox["fan"].run(inputs={"x": 0}), lambda: lg["fan"].ainvoke({"ys": []}), 20),
        ("C stream (1,000 items)", lambda: ox["stream"].run(inputs={"n": N_STREAM}),
         lambda: lg["stream"].ainvoke({"n": N_STREAM, "ds": []}, cfg), 10),
        ("D loop (100 iterations)", lambda: ox["loop"].run(inputs={}), lambda: lg["loop"].ainvoke({"n": 0}, cfg), 20),
    ]
    for name, fo, fl, reps in cases:
        await fo(); await fl()                                   # warm-up
        rows.append((name, await timed(fo, reps), await timed(fl, reps)))

    async def load(f):
        await asyncio.gather(*(f() for _ in range(N_LOAD)))
    rows.append(("E load (500 chains, concurrent)",
                 await timed(lambda: load(lambda: ox["chain"].run(inputs={"x": 0})), 3),
                 await timed(lambda: load(lambda: lg["chain"].ainvoke({"x": 0})), 3)))

    from importlib.metadata import version
    print(f"operonx {version('operonx')} · langgraph {version('langgraph')} · python {sys.version.split()[0]}")
    print(f"{'case':<34}{'OperonX ms':>12}{'LangGraph ms':>14}{'ratio':>9}")
    for name, a, b in rows:
        print(f"{name:<34}{a:>12.1f}{b:>14.1f}{b / a:>8.1f}x")


if __name__ == "__main__":
    asyncio.run(main())
