import asyncio
from operonx import END, START, Operon, graph, op


@op
def parse(reply: str) -> dict:
    if not reply.startswith("{"):
        raise ValueError(f"unparseable model reply: {reply[:30]!r}")
    return {"label": "ok"}


@op
def score(label: str) -> dict:
    return {"offset": 0 if label == "ok" else -25}


@graph
def judge(reply):
    p = parse(reply=reply)
    s = score(label=p["label"])
    START >> p >> s >> END


engine = Operon(judge, params={"reply": None})
for reply in ['{"label": "ok"}', "Sure! Here you go"]:
    out = asyncio.run(engine.run(inputs={"reply": reply}))
    if "$errors" in out:
        op_name, err = next(iter(out["$errors"].items()))
        print(f"{reply!r:<22} → NO VERDICT, {op_name} failed: {err.strip().splitlines()[-1]}")
    else:
        print(f"{reply!r:<22} → offset {out['offset']}")
