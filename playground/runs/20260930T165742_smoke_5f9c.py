import os, json
from openai import OpenAI
c = OpenAI()
r = c.chat.completions.create(model=os.getenv('SEMINAR_MODEL'), messages=[{'role':'user','content':'What is 25 * 4 + 100, and tell me about Python?'}], tools=[{'type':'function','function':{'name':'calculator','description':'math','parameters':{'type':'object','properties':{}}}},{'type':'function','function':{'name':'search','description':'search the web','parameters':{'type':'object','properties':{}}}}])
m = r.choices[0].message
print([ (t.function.name, t.function.arguments) for t in m.tool_calls])
