import asyncio
import operonx
from operonx import END, PARENT, START, Operon, graph
from operonx.providers import LLMOp


@graph
def intent(message):
    good = LLMOp.of(resource="gpt-4o-mini", fields=["intent: str"], max_retries=1,
                    prompt="What does the customer want? Reply as <intent>...</intent>\nMessage: {message}",
                    message=message)
    START >> good >> END


@graph
def intent_no_format(message):             # the prompt forgot to say how to answer
    bad = LLMOp.of(resource="gpt-4o-mini", fields=["intent: str"],
                   prompt="What does the customer want?\nMessage: {message}",
                   message=message)
    START >> bad >> END


async def main():
    operonx.bootstrap(resources="resources.yaml")
    for g in (intent, intent_no_format):
        out = await Operon(g(message=PARENT["message"])).run(inputs={"message": "I want a refund for May"})
        print(f"{g.__name__:<17} intent={out['intent']!r:<10} error={out['error']!r}")

asyncio.run(main())
