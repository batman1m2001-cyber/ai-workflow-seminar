import json
import httpx
from openai import OpenAI
from prep_world import WEB, golden
from prep_world.guard import visible_text
from prep_world.mail import as_email

client, calls = OpenAI(), 0
def llm(**kw):
    global calls
    calls += 1
    return client.chat.completions.create(model="gpt-4o-mini", **kw).choices[0].message

email = as_email(next(g for g in golden() if g["id"] == "lotus-intro"))
lead = json.loads(llm(messages=[
    {"role": "system", "content": 'Reply as JSON with keys "is_lead" and "company".'},
    {"role": "user", "content": f"From: {email['from_name']} <{email['from']}>\n\n{email['text']}"}]).content)
print(lead)
if lead["is_lead"]:
    hits = httpx.get(f"{WEB}/search", params={"q": f"{lead['company']} news"}).json()
    facts = visible_text(httpx.get(hits[0]["url"]).text)
else:
    facts = None
print(facts[:120] if facts else "skipped: not a lead")
brief = llm(messages=[{"role": "user", "content": f"Write a meeting brief.\n\nCompany: {lead['company']}\n\nEvidence:\n{facts}"}]).content
print(brief[:160])
print(f"model calls: {calls} · path picked by: code")