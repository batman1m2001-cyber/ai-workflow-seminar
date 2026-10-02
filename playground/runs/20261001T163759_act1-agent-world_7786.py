from prep_world import golden
from prep_world.mail import as_email

email = as_email(next(g for g in golden() if g["id"] == "lotus-intro"))
print(email["from"], "|", email["subject"])
messages = [
    {"role": "system", "content": 'Read the email. Reply as JSON with keys "company", "domain", "intent" and "contact".'},
    {"role": "user", "content": f"From: {email['from_name']} <{email['from']}>\n\n{email['text']}"},
]
print(messages[1]["content"].splitlines()[0])
from openai import OpenAI

raw = OpenAI().chat.completions.create(model="gpt-4o-mini", messages=messages).choices[0].message.content
print(raw)
import json

lead = json.loads(raw)
assert lead.get("company"), "the model named no company"
print(lead)