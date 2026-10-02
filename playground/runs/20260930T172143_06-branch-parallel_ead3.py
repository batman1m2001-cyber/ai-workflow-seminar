import asyncio
import json
import os
import time
from openai import AsyncOpenAI

client = AsyncOpenAI()
MODEL = os.getenv("SEMINAR_MODEL", "gpt-4o-mini")

CALL = "Agent: Mày ngu à, trả tiền đi! Card 4111 1111 1111 1111."


async def check(name: str, rule: str) -> tuple:
    r = await client.chat.completions.create(
        model=MODEL, temperature=0,
        messages=[{"role": "user", "content":
                   f'Rule: {rule}\nReply with JSON only: {{"violation": true | false}}\nCall: {CALL}'}])
    return name, json.loads(r.choices[0].message.content)["violation"]


CHECKS = {"politeness": "The agent must not insult the customer.",
          "card_number": "The agent must not read a full card number.",
          "disclosure": "The agent must state their name."}


async def main():
    t = time.perf_counter()
    for name, rule in CHECKS.items():                            # one after another
        await check(name, rule)
    print(f"sequential: {time.perf_counter() - t:.2f} s")

    t = time.perf_counter()
    results = await asyncio.gather(*(check(n, r) for n, r in CHECKS.items()))   # all at once
    print(f"parallel:   {time.perf_counter() - t:.2f} s")
    for name, violation in results:
        print(f"  {name:>12}: {'VIOLATION' if violation else 'ok'}")

asyncio.run(main())
