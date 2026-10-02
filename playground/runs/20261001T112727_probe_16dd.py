from langchain_core.prompts import ChatPromptTemplate
from langchain_core.vectorstores import InMemoryVectorStore
from langchain_openai import ChatOpenAI, OpenAIEmbeddings

store = InMemoryVectorStore.from_texts([
    "Refunds are paid to the original card within 5 business days.",
    "Orders can be cancelled free of charge before they ship.",
    "Gift cards cannot be refunded.",
], OpenAIEmbeddings(model="text-embedding-3-small"))
retriever = store.as_retriever(search_kwargs={"k": 1})

prompt = ChatPromptTemplate.from_template("Answer using only this policy:\n{context}\n\nQuestion: {question}")
question = "When will my refund be paid?"
docs = retriever.invoke(question)
print("retrieved:", docs[0].page_content)
print((prompt | ChatOpenAI(model="gpt-4o-mini")).invoke({"context": docs[0].page_content, "question": question}).content)
