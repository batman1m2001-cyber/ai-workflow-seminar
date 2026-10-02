import asyncio
import operonx
from operonx import END, PARENT, START, Operon, graph, op
from operonx.providers import LLMOp


@op
def clean(ticket: str) -> dict:
    return {"text": " ".join(ticket.split())}


@graph
def triage(ticket):
    c = clean(ticket=ticket)
    llm = LLMOp.of(resource="gpt-4o-mini", fields=["intent: str"],
                   prompt="Reply as <intent>...</intent>\nMessage: {text}", text=c["text"])
    START >> c >> llm >> END


async def main():
    operonx.bootstrap(resources="resources.yaml")
    engine = Operon(triage(ticket=PARENT["ticket"]), trace=["trace_local:default"])   # ← recorded
    for t in ["I want a refund", "I will pay tomorrow", "Hello?"]:
        out = await engine.run(inputs={"ticket": t})
        print(f"{t:<22} → {out['intent']}")
    print("\nRecorded under .operonx/runs — open the project in Studio → Runs.")

asyncio.run(main())
