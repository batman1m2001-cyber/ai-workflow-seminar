from langchain_core.output_parsers import JsonOutputParser
from langchain_core.prompts import ChatPromptTemplate
from langchain_openai import ChatOpenAI

prompt = ChatPromptTemplate.from_messages([
    ("system", 'You are a support assistant. Reply as JSON with keys "intent" and "order_id".'),
    ("user", "{question}"),
])
chain = prompt | ChatOpenAI(model="gpt-4o-mini") | JsonOutputParser()
print(chain.invoke({"question": "Where is my refund for order A-1001?"}))
