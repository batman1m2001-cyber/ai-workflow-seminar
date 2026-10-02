import asyncio
import operonx
from operonx import Operon
from operonx.agents import ToolPolicy, agent_result, build_react_agent, get_tool_definitions, tool
from operonx.agents.ops.model_ops import make_llm_caller


@tool(name="list_files", description="List files in the workspace.",
      schema={"type": "object", "properties": {}}, readonly=True)
async def list_files() -> dict:
    return {"files": ["report.csv", "old.log"]}


@tool(name="delete_file", description="Delete a file.",
      schema={"type": "object", "properties": {"path": {"type": "string"}}, "required": ["path"]},
      destructive=True)
async def delete_file(path: str) -> dict:
    return {"deleted": path}


async def main():
    operonx.bootstrap(resources="resources.yaml")
    agent = build_react_agent(
        call_model=make_llm_caller("gpt-4o-mini", tools=get_tool_definitions()),
        policy=ToolPolicy(default="allow", destructive="deny"),        # or "ask" → a human approves
        max_turns=5)(messages=None)
    result = await Operon(agent).run(inputs={"messages": [{"role": "user", "content": "Please delete old.log"}]})
    for m in agent_result(result, agent)["messages"]:
        calls = [c["function"]["name"] for c in m.get("tool_calls") or []]
        print(f"{m['role']:>9} | {str(m.get('content') or '')[:90]} {calls or ''}")

asyncio.run(main())
