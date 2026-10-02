import json

# Three replies a real model might send for three calls that ARE violations.
REPLIES = {
    "call-1": '{"violation": true, "reason": "insult"}',
    "call-2": 'Sure! Here is the JSON: {"violation": true}',   # chatty prefix
    "call-3": '{"Violation": true}',                           # wrong key casing
}


def naive(reply: str):
    try:
        return json.loads(reply).get("violation")    # missing key -> None
    except Exception:
        return None                                  # "safe default"


def strict(reply: str) -> bool:
    data = json.loads(reply)                         # raises -> the call is an ERROR
    if "violation" not in data:
        raise KeyError(f"no 'violation' in {data}")
    return bool(data["violation"])


print("naive:")
for call, reply in REPLIES.items():
    print(f"  {call}: {'VIOLATION' if naive(reply) else 'clean'}")

print("\nstrict:")
for call, reply in REPLIES.items():
    try:
        print(f"  {call}: {'VIOLATION' if strict(reply) else 'clean'}")
    except Exception as exc:
        print(f"  {call}: ERROR — {type(exc).__name__}: {exc}")
