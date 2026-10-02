import asyncio
from operonx import END, START, Operon, graph, op
from operonx.core.ops import if_


@op
def classify(message: str) -> dict:                  # an LLM call on the next page
    return {"refund": "refund" in message.lower()}


@op
def refund(message: str) -> dict:
    return {"reply": "→ open a refund ticket"}


@op
def faq(message: str) -> dict:
    return {"reply": "→ answer from the FAQ"}


@op
def respond(refund_reply: str = None, faq_reply: str = None) -> dict:   # the arm that didn't run sends None
    return {"reply": refund_reply or faq_reply}


@graph
def router(message):
    c = classify(message=message)
    r, f = refund(message=message), faq(message=message)
    out = respond(refund_reply=r["reply"], faq_reply=f["reply"])
    START >> c >> if_(c["refund"] == True, r).else_(f)  # noqa: E712
    r >> out
    f >> out
    out >> END


engine = Operon(router, params={"message": None})
for m in ["I want a refund", "What are your hours?"]:
    print(f"{m:<22}", asyncio.run(engine.run(inputs={"message": m}))["reply"])
