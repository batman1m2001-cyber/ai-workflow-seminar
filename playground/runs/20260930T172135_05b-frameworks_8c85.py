import os
from agents import Agent, Runner, function_tool, set_default_openai_api, set_tracing_disabled

set_default_openai_api("chat_completions")   # talk to any chat-completions endpoint (the mock too)
set_tracing_disabled(True)                   # no upload to OpenAI's trace service


@function_tool
def calculator(expression: str) -> str:
    """Evaluate an arithmetic expression."""
    return str(eval(expression, {"__builtins__": {}}))


agent = Agent(name="assistant", instructions="Use tools when useful.",
              model=os.getenv("SEMINAR_MODEL", "gpt-4o-mini"), tools=[calculator])

result = Runner.run_sync(agent, "What is 25 * 4 + 100?")
for item in result.new_items:
    print(type(item).__name__)
print("final:", result.final_output)
