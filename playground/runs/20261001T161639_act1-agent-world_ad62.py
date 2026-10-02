from langchain_core.vectorstores import InMemoryVectorStore
from langchain_openai import OpenAIEmbeddings
from prep_world import db

notes = [r["content"] for r in db.rows("SELECT content FROM kb_chunks")]
store = InMemoryVectorStore.from_texts(notes, OpenAIEmbeddings(model="text-embedding-3-small"))

question = "Have we worked with Saigon Fresh Foods on invoices before?"
for doc in store.as_retriever(search_kwargs={"k": 1}).invoke(question):
    print(doc.page_content)
