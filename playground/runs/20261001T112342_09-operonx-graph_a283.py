import asyncio
from operonx import END, START, Operon, graph, op


@op
def clean(text: str) -> dict:
    return {"text": " ".join(text.split())}


@op
def count(text: str) -> dict:
    return {"words": len(text.split()), "chars": len(text)}


@graph
def pipeline(text):
    c = clean(text=text)
    n = count(text=c["text"])            # data flows through the ref...
    START >> c >> n >> END               # ...order flows through >>


out = asyncio.run(Operon(pipeline, params={"text": None}).run(inputs={"text": "  hello    operonx   world  "}))
print(out["words"], "words,", out["chars"], "chars")
