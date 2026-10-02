import asyncio
import operonx
from operonx import Operon
from operonx.agents import agent_result, build_react_agent, get_tool_definitions, tool
from operonx.agents.ops.model_ops import make_llm_caller


@tool(name="get_weather", description="Current weather for a city.",
      schema={"type": "object", "properties": {"city": {"type": "string"}}, "required": ["city"]},
      readonly=True)
async def get_weather(city: str) -> dict:
    return {"temp_c": 31, "sky": "humid", "city": city}


async def main():
    operonx.bootstrap(resources="resources.yaml")
    call_model = make_llm_caller("gpt-4o-mini", tools=get_tool_definitions())
    agent = build_react_agent(call_model=call_model, max_turns=5)(messages=None)
    result = await Operon(agent).run(inputs={"messages": [{"role": "user", "content": "What's the weather in Hanoi?"}]})
    answer = agent_result(result, agent)
    print(answer["final"]["content"])
    print(f"{answer['turns']} turns, stopped_early={answer['stopped_early']}")

asyncio.run(main())
