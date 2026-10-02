import asyncio, json, sys
from mcp import ClientSession, StdioServerParameters
from mcp.client.stdio import stdio_client

CRM = StdioServerParameters(command=sys.executable, args=["-m", "prep_world.mcp_server"])

async def list_tools():
    async with stdio_client(CRM) as (r, w), ClientSession(r, w) as s:
        await s.initialize()
        return (await s.list_tools()).tools

tools = asyncio.run(list_tools())
print([t.name for t in tools])
def schema(t):
    params = getattr(t, "input_schema", None) or t.inputSchema
    return {"type": "function", "function": {"name": t.name, "description": t.description, "parameters": params}}

SCHEMAS = [schema(t) for t in tools]
print(json.dumps(SCHEMAS[0])[:90] + "…")
from openai import OpenAI

call = OpenAI().chat.completions.create(
    model="gpt-4o-mini", tools=SCHEMAS,
    messages=[{"role": "user", "content": "Find the company lotus-logistics.example in the CRM."}],
).choices[0].message.tool_calls[0]
print(call.function.name, call.function.arguments)
async def call_tool(name, args):
    async with stdio_client(CRM) as (r, w), ClientSession(r, w) as s:
        await s.initialize()
        return await s.call_tool(name, args)

result = asyncio.run(call_tool(call.function.name, json.loads(call.function.arguments)))
print(result.content[0].text[:120])