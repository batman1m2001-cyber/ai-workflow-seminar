from langchain_core.output_parsers import JsonOutputParser
from langchain_core.prompts import ChatPromptTemplate
from langchain_openai import ChatOpenAI
from prep_world import golden
from prep_world.mail import as_email

email = as_email(next(g for g in golden() if g["id"] == "lotus-intro"))

prompt = ChatPromptTemplate.from_messages([
    ("system", 'Read the email. Reply as JSON with keys "company", "domain", "intent" and "contact".'),
    ("user", "From: {name} <{sender}>\n\n{text}"),
])
chain = prompt | ChatOpenAI(model="gpt-4o-mini") | JsonOutputParser()
print(chain.invoke({"name": email["from_name"], "sender": email["from"], "text": email["text"]}))
