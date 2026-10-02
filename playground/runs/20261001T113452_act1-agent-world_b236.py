history = []
for i in range(12):
    history += [{"role": "user", "content": f"Earlier question {i} about shipping times and delivery windows."},
                {"role": "assistant", "content": f"Earlier answer {i}: standard shipping takes 3 to 5 days."}]
history.append({"role": "user", "content": "Where is my refund for order A-1001?"})
tokens = lambda msgs: sum(len(m["content"]) for m in msgs) // 4      # ~4 characters a token
print(f"{len(history)} messages, ~{tokens(history)} tokens")
MEMORY = """# AGENTS.md
- Customers are paid back to the original card.
- Never promise a date the policy doesn't give."""
print(MEMORY.splitlines()[0], f"({len(MEMORY.splitlines()) - 1} rules)")
from openai import OpenAI

BUDGET = 150
old, recent = history[:-4], history[-4:]
if tokens(history) > BUDGET:
    text = "\n".join(m["content"] for m in old)
    summary = OpenAI().chat.completions.create(model="gpt-4o-mini", messages=[
        {"role": "user", "content": f"Summarize this conversation in one line:\n{text}"}]).choices[0].message.content
print(summary)
context = [{"role": "system", "content": "You are a refund assistant.\n" + MEMORY},
           {"role": "user", "content": summary}, *recent]
print(f"{len(history)} messages, ~{tokens(history)} tokens  ->  {len(context)} messages, ~{tokens(context)} tokens")