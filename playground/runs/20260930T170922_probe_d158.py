import os
from agents import Agent, Runner, function_tool, set_default_openai_api, set_tracing_disabled
set_default_openai_api("chat_completions")
set_tracing_disabled(True)

@function_tool
def calculator(expression: str) -> str:
    """Evaluate an arithmetic expression."""
    return str(eval(expression, {"__builtins__": {}}))

agent = Agent(name="assistant", instructions="Use tools when useful.", model=os.getenv("SEMINAR_MODEL", "gpt-4o-mini"), tools=[calculator])
result = Runner.run_sync(agent, "What is 25 * 4 + 100?")
print(result.final_output)
for item in result.new_items: print(type(item).__name__)
