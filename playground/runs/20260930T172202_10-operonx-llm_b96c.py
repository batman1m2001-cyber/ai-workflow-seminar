import asyncio
import operonx
from operonx import END, PARENT, START, Operon, graph
from operonx.providers import LLMOp


@graph
def answer(question):
    llm = LLMOp.of(resource="gpt-4o-mini",
                   prompt={"system": "Answer in one sentence.", "user": "{question}"},
                   question=question)
    START >> llm >> END


async def main():
    operonx.bootstrap(resources="resources.yaml")
    out = await Operon(answer(question=PARENT["question"])).run(inputs={"question": "What is a workflow engine?"})
    print(out["content"])
    print("usage:", out["usage"]["total_tokens"], "tokens · finish:", out["finish_reason"])

asyncio.run(main())
