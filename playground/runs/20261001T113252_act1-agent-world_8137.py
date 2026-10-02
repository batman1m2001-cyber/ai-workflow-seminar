from langchain_core.prompts import ChatPromptTemplate
from langchain_core.vectorstores import InMemoryVectorStore
from langchain_openai import ChatOpenAI, OpenAIEmbeddings

store = InMemoryVectorStore.from_texts([
    "Refunds are paid to the original card within 5 business days.",
    "Orders can be cancelled free of charge before they ship.",
    "Gift cards cannot be refunded.",
], OpenAIEmbeddings(model="text-embedding-3-small"))
retriever = store.as_retriever(search_kwargs={"k": 1})

question = "When will my refund be paid?"
context = retriever.invoke(question)[0].page_content
prompt = ChatPromptTemplate.from_template("Answer from the context only.\n\nContext:\n{context}\n\nQuestion: {question}")
print("retrieved:", context)
print((prompt | ChatOpenAI(model="gpt-4o-mini")).invoke({"context": context, "question": question}).content)
