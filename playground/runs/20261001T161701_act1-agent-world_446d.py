call = {"tool": "send_email", "args": {"to": "abc@company.com", "subject": "Hi", "body": "Xin chào"},
        "caller": "research-agent", "token": "tok-research"}
REQUIRED = {"send_email": {"to", "subject", "body"}}
missing = REQUIRED[call["tool"]] - set(call["args"])
verdict = f"bad arguments: {missing}" if missing else None
print("schema ok" if not missing else verdict)
TOKENS = {"tok-research": "research-agent", "tok-sales": "sales-team"}
verdict = verdict or (None if TOKENS.get(call["token"]) == call["caller"] else "unknown caller")
print(f"caller: {TOKENS.get(call['token'])}")
SCOPES = {"research-agent": {"web:read", "crm:read"}, "sales-team": {"mail:send"}}
NEEDS = {"send_email": "mail:send"}
if not verdict and NEEDS[call["tool"]] not in SCOPES[call["caller"]]:
    verdict = f"{call['caller']} has no {NEEDS[call['tool']]} scope"
print(verdict or "allowed")
import time
WINDOW, LIMIT, recent = 60, 10, []
recent = [t for t in recent if t > time.time() - WINDOW]
verdict = verdict or (None if len(recent) < LIMIT else "rate limited")
print(f"{len(recent)}/{LIMIT} calls this minute")
import json
AUDIT = [{"t": round(time.time()), **call, "args": call["args"] | {"body": "…"}, "verdict": verdict or "run"}]
print(json.dumps(AUDIT[-1])[:110])
print("NOT executed:", verdict) if verdict else print("executed")