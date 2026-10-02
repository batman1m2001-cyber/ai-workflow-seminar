import asyncio, operonx
from operonx.core import END, PARENT, START, Operon, graph, op
from operonx.providers import LLMOp

@graph
def intent(message):
    llm = LLMOp.of(resource="gpt-4o-mini", prompt="Give the intent of: {message}. Reply as <intent>...</intent>",
                   fields=["intent: str"], message=message)
    START >> llm >> END

async def main():
    operonx.bootstrap(resources="resources.yaml")
    out = await Operon(intent(message=PARENT["message"]), trace=["trace_local:default"]).run(inputs={"message": "I want a refund for my order"})
    print({k: v for k, v in out.items() if not k.startswith("$")}, out.get("$errors"))
asyncio.run(main())
