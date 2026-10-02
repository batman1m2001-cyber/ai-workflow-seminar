
import asyncio
import re
import operonx
from operonx import END, PARENT, START, Operon, graph, op
from operonx.providers import LLMOp

BROKEN = True          # True: the prompt forgets its output format → the model's reply won't parse

TRANSCRIPT = """Agent: Chào anh, em là Lan gọi từ ngân hàng.
Customer: Tôi chưa có tiền.
Agent: Mày ngu à, trả tiền đi! Số thẻ 4111 1111 1111 1111."""

FORMAT = "" if BROKEN else "Reply as <violation>true or false</violation>.\n"
PROMPT = "Does the agent insult or threaten the customer?\n" + FORMAT + "Transcript: {transcript}"


@op
def disclosure(transcript: str) -> dict:
    ok = bool(re.search(r"em là|tên (?:em|tôi) là", transcript.lower()))
    return {"row": {"case": "disclosure", "violation": not ok, "offset": 0 if ok else -10}}


@op
def card_number(transcript: str) -> dict:
    hit = bool(re.search(r"(?:\d[ -]?){13,19}", transcript))
    return {"row": {"case": "card_number", "violation": hit, "offset": -25 if hit else 0}}


@op
def parsed(violation: str = None, error: str = None) -> dict:
    if error:                                                  # a failure is never a verdict
        raise ValueError(f"model reply unusable: {error}")
    v = str(violation).strip().lower() == "true"
    return {"row": {"case": "politeness", "violation": v, "offset": -25 if v else 0}}


@op
def finalize(disclosure_row: dict, card_row: dict, polite_row: dict) -> dict:
    rows = [disclosure_row, card_row, polite_row]
    return {"rows": rows, "score": sum(r["offset"] for r in rows)}


@graph
def qc(transcript):
    d = disclosure(transcript=transcript)
    c = card_number(transcript=transcript)
    llm = LLMOp.of(resource="gpt-4o-mini", prompt=PROMPT, fields=["violation: str"], transcript=transcript)
    p = parsed(violation=llm["violation"], error=llm["error"])
    f = finalize(disclosure_row=d["row"], card_row=c["row"], polite_row=p["row"])
    START >> [d, c, llm]
    llm >> p
    [d, c, p] >> f
    f >> END


async def main():
    operonx.bootstrap(resources="resources.yaml")
    out = await Operon(qc(transcript=PARENT["transcript"]), trace=["trace_local:default"]).run(
        inputs={"transcript": TRANSCRIPT})
    if "$errors" in out:
        op_name, err = next(iter(out["$errors"].items()))
        print("NO VERDICT — the call is recorded as an error, not as clean:")
        print("  ", op_name, "→", err.strip().splitlines()[-1])
        return
    for r in out["rows"]:
        print(f"  {r['case']:<12} {'VIOLATION' if r['violation'] else 'ok':<10} {r['offset']:>4}")
    print("  score offset:", out["score"])

asyncio.run(main())
