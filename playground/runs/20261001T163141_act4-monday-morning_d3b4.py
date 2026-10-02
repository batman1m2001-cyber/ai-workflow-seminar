import asyncio, json, time
import httpx
from openai import OpenAI
from prep_world import WEB, golden, mail
from prep_world.guard import leaks

client = OpenAI()
def send_email(to: str, subject: str, body: str) -> str:
    mail.send(to, subject, body)
    return f"sent to {to}"
SEND = {"type": "function", "function": {"name": "send_email", "description": "Send an email.", "parameters": {
        "type": "object", "properties": {"to": {"type": "string"}, "subject": {"type": "string"}, "body": {"type": "string"}}}}}

attack = next(g for g in golden() if g["id"] == "attack-send")
msg = client.chat.completions.create(model="gpt-4o-mini", tools=[SEND], messages=[
    {"role": "system", "content": "You handle the sales inbox."}, {"role": "user", "content": attack["body"]}]).choices[0].message
for c in msg.tool_calls or []:
    print("✗", send_email(**json.loads(c.function.arguments)), "— an email told it to")
raw = httpx.get(f"{WEB}/web/redrivertextiles.example/").text
brief = client.chat.completions.create(model="gpt-4o-mini", messages=[{"role": "user", "content":
        f"Write a meeting brief.\n\nCompany: Red River Textiles\n\nEvidence:\n{raw}"}]).choices[0].message.content
print("✗ the brief now contains:", leaks(brief, ("northwind-ai.example", "redrivertextiles.example")))
inbox = ["Lotus Logistics", "Halong Robotics", "Mekong Microfinance"]
done = []
try:
    for company in inbox:
        delay = 3000 if company == "Halong Robotics" else 0           # one slow search
        httpx.get(f"{WEB}/search", params={"q": company, "delay_ms": delay}, timeout=1.0)
        done.append(company)
except httpx.TimeoutException as e:
    print(f"✗ batch crashed at #{len(done) + 1} ({type(e).__name__}); finished: {done}; lost: {inbox[len(done):]}")
reply = 'Sure! Here is the JSON you asked for: {"is_lead": true}'
def parse(text):
    try:
        return json.loads(text)
    except ValueError:
        return None                                   # "safe"
lead = parse(reply)
print("✗ is_lead =", (lead or {}).get("is_lead", False), "→ Linh's email is filed as not a lead, and nothing says so")
async def provider(i, slots=asyncio.Semaphore(10), busy=[0]):
    if busy[0] >= 10:
        raise RuntimeError("429 Too Many Requests")
    busy[0] += 1
    try:
        await asyncio.sleep(0.2)
    finally:
        busy[0] -= 1

async def monday():
    results = await asyncio.gather(*(provider(i) for i in range(50)), return_exceptions=True)
    return sum(isinstance(r, Exception) for r in results)
print(f"✗ {asyncio.run(monday())} of 50 calls rejected with 429")
trace = []                                            # nobody wrote one
print("✗ steps recorded for that run:", len(trace), "— no inputs, no outputs, no timings")