import asyncio
import operonx
from operonx import END, PARENT, START, Operon, graph, op
from operonx.core.registry import ResourceHub
from operonx.providers import DocFetchOp, EmbeddingOp, LLMOp, VectorSearchOp

POLICIES = [
    {"id": 1, "title": "Calling hours", "content": "Agents must not call customers before 7am or after 9pm."},
    {"id": 2, "title": "Third parties", "content": "Never disclose the debt to a third party who answers the phone."},
    {"id": 3, "title": "Introduction", "content": "Agents must state their full name and the bank's name at the start."},
    {"id": 4, "title": "Promise to pay", "content": "A promise to pay must include an amount and a date."},
    {"id": 5, "title": "Card numbers", "content": "Card numbers must never be read out in full."},
]


@op
def build_context(rows: list) -> dict:
    return {"context": "\n".join(f"[{r['title']}] {r['content']}" for r in rows or [])}


@graph
def rag(question):
    q = EmbeddingOp.of(resource="openai", texts=question)
    hits = VectorSearchOp.of(resource="docs-faiss", query_vector=q["embeddings"][0], top_k=2)
    docs = DocFetchOp.of(resource="corpus", ids=hits["ids"], collection="docs",
                         fields=["id", "title", "content"])
    ctx = build_context(rows=docs["rows"])
    answer = LLMOp.of(resource="gpt-4o-mini",
                      prompt={"system": "Answer using only the context.",
                              "user": "Question: {question}\n\nContext:\n{context}"},
                      question=question, context=ctx["context"])
    START >> q >> hits >> docs >> ctx >> answer >> END
    answer["content"] >> PARENT["answer"]


async def seed():
    """What an ingestion job does: the index gets vectors, the store gets the text."""
    hub = ResourceHub.instance()
    vectors = (await hub.get("embedding:openai").run([f"{d['title']}. {d['content']}" for d in POLICIES]))["embeddings"]
    await hub.get("vector_store:docs-faiss").upsert(ids=[d["id"] for d in POLICIES], vectors=vectors)
    hub.get("doc_store:corpus").put(POLICIES, collection="docs")


async def main():
    operonx.bootstrap(resources="resources.yaml")
    await seed()
    engine = Operon(rag(question=PARENT["question"]))
    for q in ["What time is too late to call?", "What must a promise to pay include?"]:
        out = await engine.run(inputs={"question": q})
        print("Q:", q, "\nA:", out["answer"], "\n")

asyncio.run(main())
