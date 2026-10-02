import asyncio, json, operonx
from operonx import END, PARENT, START, Operon, graph, op
from operonx.core.ops import if_
from operonx.providers import LLMOp
from operonx.agents import agent_result, build_react_agent, get_tool_definitions, tool, ToolPolicy
from operonx.agents.ops.model_ops import make_llm_caller

@tool(name="list_files", description="List files in the workspace.", schema={"type":"object","properties":{}}, readonly=True)
async def list_files() -> dict:
    return {"files": ["report.csv", "old.log"]}

@tool(name="delete_file", description="Delete a file.", schema={"type":"object","properties":{"path":{"type":"string"}},"required":["path"]}, destructive=True)
async def delete_file(path: str) -> dict:
    return {"deleted": path}

async def main():
    operonx.bootstrap(resources="resources.yaml")
    call_model = make_llm_caller("gpt-4o-mini", tools=get_tool_definitions())
    agent = build_react_agent(call_model=call_model, max_turns=5, policy=ToolPolicy(default="allow", destructive="deny"))(messages=None)
    res = await Operon(agent).run(inputs={"messages": [{"role": "user", "content": "Please delete old.log"}]})
    a = agent_result(res, agent)
    for m in a["messages"]:
        print(m.get("role"), "|", str(m.get("content"))[:100], "|", m.get("tool_calls"))
    print("final:", a["final"], "turns:", a["turns"], a.get("stopped_early"))
asyncio.run(main())
