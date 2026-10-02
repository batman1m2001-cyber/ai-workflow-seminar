"""A scripted stand-in for an OpenAI-compatible model.

Deterministic, instant and offline, so every playground runs on stage
without a key. It is not clever — it reads the request the way a demo
needs it read:

| request | reply |
|---|---|
| tools offered, the last turn is the user's | tool calls picked from the question (math → calculator, weather, search, delete) |
| the last turn is a tool result | a final answer quoting the tool results |
| the prompt names `<tag>`s | those tags, filled |
| the prompt asks for JSON | a JSON object with the keys it names |
| the prompt carries `Context:` | an answer quoting the best-matching context line |
| anything else | a short reply that says it is the mock |

Pure standard library: the runner serves it as `/mock/v1`, and the
browser runtime (Pyodide) imports it directly.
"""
from __future__ import annotations

import hashlib
import json
import math
import re
import time
import uuid

EMBED_DIM = 1536
STOP = {"the", "and", "for", "are", "what", "which", "who", "how", "must", "can", "not", "never",
        "with", "that", "this", "their", "they", "from", "into", "about", "does", "did", "will", "your", "you"}
NOT_LEAD = ("unsubscribe", "out of the office", "automatic reply", "lunch at", "@northwind-ai.example")
RUDE = ("ngu", "cút", "mày", "tao", "đồ", "stupid", "idiot", "shut up", "useless")
MATH = re.compile(r"\d+(?:\.\d+)?(?:\s*[-+*/x×]\s*\(?\d+(?:\.\d+)?\)?)+")


# ── helpers ──────────────────────────────────────────────────────────────


def _text(msg) -> str:
    c = msg.get("content") if isinstance(msg, dict) else None
    if isinstance(c, list):
        return " ".join(p.get("text", "") for p in c if isinstance(p, dict))
    return c or ""


def _tool_names(tools) -> list:
    out = []
    for t in tools or []:
        fn = t.get("function", t) if isinstance(t, dict) else {}
        if fn.get("name"):
            out.append((fn["name"], (fn.get("description") or "").lower()))
    return out


def _pick(names, *words):
    for name, desc in names:
        hay = name.lower() + " " + desc
        if any(w in hay for w in words):
            return name
    return None


def _call(name, args):
    return {"id": "call_" + uuid.uuid4().hex[:10], "type": "function",
            "function": {"name": name, "arguments": json.dumps(args, ensure_ascii=False)}}


def _schema(tools, name) -> dict:
    for t in tools or []:
        fn = t.get("function", t)
        if fn.get("name") == name:
            return fn.get("parameters") or {}
    return {}


def _plan_tools(question: str, tools, followup: bool = False) -> list:
    """The calls a model would make for `question`. `followup`: a later turn,
    once results are in — a policy search that waits on an order lookup."""
    names = _tool_names(tools)
    q = question.lower()
    calls = []
    order = next((n for n, _ in names if "order_id" in (_schema(tools, n).get("properties") or {})), None)
    if order and re.search(r"[A-Z]{1,3}-?[0-9]{3,}", question, re.I):
        props = _schema(tools, order).get("properties") or {}
        req = _schema(tools, order).get("required") or list(props)
        calls.append(_call(order, {k: _fill(k, question) for k in req}))
    m = MATH.search(question)
    calc = _pick(names, "calc", "math", "arithmetic")
    if m and calc:
        calls.append(_call(calc, {"expression": m.group(0).replace("×", "*").replace("x", "*")}))
    weather = _pick(names, "weather")
    if weather and "weather" in q:
        city = re.search(r"(?:in|at|ở)\s+([A-ZĐ][\wÀ-ỹ]+(?:\s[A-ZĐ][\wÀ-ỹ]+)?)", question)
        calls.append(_call(weather, {"city": city.group(1) if city else "Hanoi"}))
    delete = _pick(names, "delete", "remove")
    if delete and ("delete" in q or "remove" in q or "xoá" in q or "xóa" in q):
        path = re.search(r"[\w./-]+\.\w+", question)
        calls.append(_call(delete, {"path": path.group(0) if path else "old.log"}))
    listing = _pick(names, "list_files", "list files", "list")
    if listing and ("list" in q or "files" in q) and not calls:
        calls.append(_call(listing, {}))
    search = _pick(names, "search", "lookup", "knowledge")
    topic = (re.search(r"(?:^|\s)about\s+(.+?)[?.!]?$", question, re.I)
             or re.search(r"(?:search(?: for)?|look up|who is)\s+(.+?)[?.!]?$", question, re.I)
             or (None if m else re.search(r"(?:what is|what are|tell me)\s+(.+?)[?.!]?$", question, re.I)))
    if search and order and calls and calls[0]["function"]["name"] == order and search != order:
        if followup:                                # the policy, once the order is known
            calls.append(_call(search, {_main_param(tools, search): "refund" if "refund" in q else question}))
    elif search and (topic or not calls) and not (m and len(calls) == 1 and not topic):
        calls.append(_call(search, {_main_param(tools, search): (topic.group(1) if topic else question).strip()}))
    if not calls and names:
        calls.append(_generic(question, tools))
    return calls


def _main_param(tools, name) -> str:
    props = _schema(tools, name).get("properties") or {}
    req = _schema(tools, name).get("required") or list(props)
    return req[0] if req else "query"


def _fill(prop: str, question: str):
    """A plausible argument for parameter `prop`, read out of the question."""
    p = prop.lower()
    if "domain" in p:
        m = re.search(r"[\w-]+(?:\.[\w-]+)+", question)
        return m.group(0) if m else question
    if p in ("to", "recipient", "email", "address"):
        m = re.search(r"[\w.+-]+@[\w-]+(?:\.[\w-]+)+", question)
        return m.group(0) if m else "someone@example.com"
    if p in ("order", "order_id", "id", "account"):
        m = re.search(r"\b[A-Z]{1,3}-?\d{2,}\b", question, re.I)
        return m.group(0).upper() if m else "A-1001"
    if p in ("amount", "value", "sum"):
        m = re.search(r"\d[\d,.]*\s*(?:VND|vnd|USD|\$|đ)?", question)
        return m.group(0).strip() if m else "0"
    if p in ("city", "location", "place"):
        m = re.search(r"(?:in|at|ở)\s+([A-ZĐ][\wÀ-ỹ]+)", question)
        return m.group(1) if m else "Hanoi"
    if p in ("path", "file", "filename"):
        m = re.search(r"[\w./-]+\.\w+", question)
        return m.group(0) if m else "notes.txt"
    return question


def _generic(question: str, tools) -> dict:
    """The tool whose name and description share most words with the question."""
    words = set(re.findall(r"\w+", question.lower()))
    best, score = None, -1
    for t in tools:
        fn = t.get("function", t)
        hay = set(re.findall(r"[a-z]+", (fn.get("name", "").replace("_", " ") + " " + (fn.get("description") or "")).lower()))
        s = len(words & hay)
        if s > score:
            best, score = fn, s
    props = ((best.get("parameters") or {}).get("properties") or {})
    required = (best.get("parameters") or {}).get("required") or list(props)
    return _call(best["name"], {k: _fill(k, question) for k in required})


def _json_keys(prompt: str) -> list:
    keys = re.findall(r'"(\w+)"\s*:', prompt)
    if not keys:                                    # 'JSON with keys "intent" and "order_id"'
        m = re.search(r"keys?\s+((?:\"\w+\"[\s,]*(?:and\s+)?)+)", prompt, re.I)
        keys = re.findall(r'"(\w+)"', m.group(1)) if m else []
    if not keys:
        m = re.search(r"json[^:\n]*:\s*([\w ,]+)", prompt, re.I)
        if m:
            keys = [k.strip() for k in m.group(1).split(",") if k.strip()]
    return list(dict.fromkeys(keys)) or ["label", "reason"]


def _subject(text: str) -> str:
    """The data the prompt is about — after its last `Message:` / `Utterance:` / `Call:` label."""
    parts = re.split(r"(?:Message|Utterance|Call|Text|Input|Transcript)\s*:", text)
    return parts[-1] if len(parts) > 1 else text


def _violates(prompt: str, subject: str) -> bool:
    p, s = prompt.lower(), subject.lower()
    if "card" in p:
        return bool(re.search(r"(?:\d[ -]?){13,19}", subject))
    if "name" in p and "insult" not in p:
        return not re.search(r"my name|tên (?:em|tôi) là|em là|this is", s)
    return any(w in s for w in RUDE)


def _value(key: str, text: str, prompt: str = ""):
    t = _subject(text).lower()
    rude = any(w in t for w in RUDE)
    k = key.lower()
    if k in ("label", "verdict", "category"):
        return "violation" if rude else "ok"
    if k in ("violation", "is_violation", "flagged"):
        return _violates(prompt or text, _subject(text))
    if k in ("intent",):
        for word, intent in (("refund", "refund"), ("weather", "weather"), ("password", "account"),
                             ("pay", "payment"), ("trả", "payment"), ("cancel", "cancel")):
            if word in t:
                return intent
        return "question"
    if k in ("is_lead", "lead"):
        return not any(w in text.lower() for w in NOT_LEAD)
    if k in ("company", "company_name", "organization"):
        lines = [ln.strip() for ln in text.strip().splitlines() if ln.strip()]
        sig = lines[-1] if lines else ""
        if "," in sig:
            return sig.split(",")[-1].strip()
        m = re.search(r"@([\w-]+)\.", text)
        return m.group(1).replace("-", " ").title() if m else None
    if k in ("domain",):
        m = re.search(r"@([\w.-]+\.\w+)", text)
        return m.group(1) if m else None
    if k in ("contact", "sender_name"):
        m = re.search(r"From:\s*([^<\n]+?)\s*<", text)
        return m.group(1).strip() if m else None
    if k in ("order_id", "order"):
        m = re.search(r"\b[A-Z]{1,3}-?\d{3,}\b", _subject(text), re.I)
        return m.group(0).upper() if m else None
    if k in ("sentiment", "tone"):
        return "negative" if rude else "neutral"
    if k in ("score", "risk", "confidence"):
        return 0.91 if rude else 0.12
    if k in ("reason", "explanation", "why"):
        return "rude wording found" if rude else "no rude wording"
    if k in ("summary",):
        return text.strip().split("\n")[-1][:80]
    return "mock-" + k


def _from_context(prompt: str) -> str:
    ctx = prompt.split("Context:", 1)[1]
    q = re.search(r"(?:Q|Question)\s*:\s*(.+)", prompt)
    question = (q.group(1) if q else "").lower()
    lines = [ln.strip() for ln in ctx.split("\n") if ln.strip() and not ln.strip().lower().startswith(("q:", "question"))]
    words = set(re.findall(r"\w+", question))
    best = max(lines, key=lambda ln: len(words & set(re.findall(r"\w+", ln.lower()))), default="")
    return f"According to the context: {best}" if best else "The context does not cover it."


# ── the two endpoints ────────────────────────────────────────────────────


def _pending(msgs, user, tools) -> list:
    called = {c.get("function", {}).get("name") for m in msgs if m.get("role") == "assistant"
              for c in (m.get("tool_calls") or [])}
    todo = [c for c in _plan_tools(user, tools, followup=True) if c["function"]["name"] not in called]
    # a page reader: open the first link the results so far contain
    fetch = next((n for n, d in _tool_names(tools) if "fetch" in n or "read page" in d or "web page" in d), None)
    if fetch and fetch not in called and not todo:
        found = re.search(r"https?://[^\s'\"\]\),]+", " ".join(_text(m) for m in msgs if m.get("role") == "tool"))
        if found:
            todo.append(_call(fetch, {_main_param(tools, fetch): found.group(0)}))
    return todo


def _brief(prompt: str) -> str:
    """A brief built only from the evidence block — the mock invents nothing."""
    evidence = prompt.split("Evidence:", 1)[1]
    company = re.search(r"Company:\s*(.+)", prompt)
    lines = [ln.strip(" -") for ln in evidence.splitlines() if ln.strip(" -")]
    return (f"# Meeting brief: {company.group(1).strip() if company else 'the company'}\n\n"
            + "\n".join(f"- {ln}" for ln in lines[:60]))


def _summary(prompt: str) -> str:
    words = [w for w in re.findall(r"[a-z]{4,}", prompt.lower()) if w not in STOP and w not in SUMMARY_SKIP]
    top = sorted(set(words), key=lambda w: -words.count(w))[:4]
    return "Summary of the earlier conversation: the customer asked about " + ", ".join(top) + "."


SUMMARY_SKIP = {"summary", "conversation", "messages", "message", "user", "assistant", "role", "content",
                "earlier", "question", "answer", "this", "that", "with", "from", "your", "have", "will"}


def latency(body: dict) -> float:
    """Seconds a reply "takes" — a little, so parallel beats sequential visibly."""
    msgs = body.get("messages") or []
    user = next((_text(m) for m in reversed(msgs) if isinstance(m, dict) and m.get("role") == "user"), "")
    return 0.4 + (len(user) % 5) * 0.05


def chat(body: dict, sleep: bool = True) -> dict:
    """An OpenAI `chat.completions` response for `body`."""
    msgs = [m if isinstance(m, dict) else dict(m) for m in (body.get("messages") or [])]
    tools = body.get("tools")
    last = msgs[-1] if msgs else {}
    prompt = "\n".join(_text(m) for m in msgs)
    user = next((_text(m) for m in reversed(msgs) if m.get("role") == "user"), "")
    if sleep:
        time.sleep(latency(body))

    message: dict = {"role": "assistant", "content": None}
    finish = "stop"
    if tools and body.get("tool_choice") != "none" and last.get("role") == "user":
        message["tool_calls"] = _plan_tools(user, tools)
        finish = "tool_calls"
    elif last.get("role") == "tool" and tools and body.get("tool_choice") != "none" and _pending(msgs, user, tools):
        message["tool_calls"] = _pending(msgs, user, tools)
        finish = "tool_calls"
    elif last.get("role") == "tool":
        results = [m for m in msgs if m.get("role") == "tool"]
        parts = [_text(m) for m in results[-4:]]
        message["content"] = "Here is what I found: " + " | ".join(parts)
    elif '{"tool": "<name>"' in prompt and last.get("role") == "user":
        # agent.py's format: the tools are listed in the prompt; a call is one line of JSON,
        # a result comes back as a user turn "Result of <tool>:"
        results = [_text(m) for m in msgs if m.get("role") == "user" and _text(m).startswith("Result of ")]
        task = next((_text(m) for m in msgs if m.get("role") == "user"), "")
        listed = list(dict.fromkeys(re.findall(r'"name"\s*:\s*"(\w+)"', prompt)))
        urls = re.findall(r'https?://[^\s"\\]+', results[-1]) if results else []
        if not results:
            first = next((n for n in ("crm_find_company", "web_search") if n in listed and
                          (n != "crm_find_company" or "crm" in task.lower())), listed[0] if listed else None)
            dom = re.search(r"\(([\w.-]+\.\w+)\)", task)
            args = {"domain_or_name": dom.group(1) if dom else _subject(task)} if first == "crm_find_company" \
                else {"query": re.sub(r"^Research |[.:]$", "", task.split(" for a sales")[0]).strip()}
            message["content"] = json.dumps({"tool": first, "args": args})
        elif len(results) < 3 and "web_search" in listed and not any(r.startswith("Result of web_search") for r in results):
            message["content"] = json.dumps({"tool": "web_search", "args": {"query": _subject(task) + " news"}})
        elif len(results) < 3 and "fetch_page" in listed and urls:
            message["content"] = json.dumps({"tool": "fetch_page", "args": {"url": urls[0]}})
        else:
            found = [r.split("\n", 1)[-1].strip()[:160] for r in results[-3:]]
            message["content"] = "Here is what I found: " + " | ".join(found)
    elif "<tool_call>" in prompt and last.get("role") == "user":
        # tool calling done by prompt alone: the tools are described in the text
        if "<tool_result>" in user:
            found = re.findall(r"<tool_result>(.*?)</tool_result>", user, re.S)
            message["content"] = "Here is what I found: " + " | ".join(f.strip() for f in found[-4:])
        else:
            listed = re.findall(r'"name"\s*:\s*"(\w+)"', prompt) or re.findall(r"^\s*[-*]\s*(\w+)\s*\(", prompt, re.M)
            desc = {n: "" for n in dict.fromkeys(listed)}
            for n in desc:
                line = re.search(re.escape(n) + r"[^\n]*", prompt)
                desc[n] = line.group(0) if line else n
            fake = [{"function": {"name": n, "description": d}} for n, d in desc.items()]
            calls = _plan_tools(user, fake)
            message["content"] = "\n".join(
                "<tool_call>" + json.dumps({"name": c["function"]["name"],
                                            "arguments": json.loads(c["function"]["arguments"])},
                                           ensure_ascii=False) + "</tool_call>" for c in calls)
    else:
        tags = [t for t in dict.fromkeys(re.findall(r"<(\w+)>", prompt)) if t not in ("br", "b", "i")]
        wants_json = "json" in prompt.lower() or (body.get("response_format") or {}).get("type") in ("json_object", "json_schema")
        if "meeting brief" in prompt.lower() and "Evidence:" in prompt and not wants_json:
            message["content"] = _brief(prompt)
        elif re.search(r"summari[sz]e|summary of", prompt[:3000], re.I) and not wants_json:
            message["content"] = _summary(prompt)
        elif tags:
            message["content"] = "".join(f"<{t}>{_value(t, user, prompt)}</{t}>" for t in tags)
        elif wants_json:
            message["content"] = json.dumps({k: _value(k, user, prompt) for k in _json_keys(prompt)}, ensure_ascii=False)
        elif "Context:" in prompt:
            message["content"] = _from_context(prompt)
        else:
            system = next((_text(m) for m in msgs if m.get("role") == "system"), "")
            rule = f" [system: {system.strip()[:60]}]" if system else ""
            message["content"] = f"(mock model{rule}) You said: {user.strip()[:120]}"

    p_tok = max(1, len(prompt) // 4)
    c_tok = max(1, len(json.dumps(message)) // 4)
    return {
        "id": "chatcmpl-mock-" + uuid.uuid4().hex[:8], "object": "chat.completion",
        "created": int(time.time()), "model": body.get("model", "mock"),
        "choices": [{"index": 0, "message": message, "finish_reason": finish}],
        "usage": {"prompt_tokens": p_tok, "completion_tokens": c_tok, "total_tokens": p_tok + c_tok},
    }


def embed_one(text: str, dim: int = EMBED_DIM) -> list:
    """A bag-of-words vector: texts sharing words point the same way."""
    v = [0.0] * dim
    for w in re.findall(r"\w+", text.lower()):
        if len(w) < 3 or w in STOP:
            continue
        w = re.sub(r"(?:ing|ed|es|s|e)$", "", w) or w      # crude stemming: promise ~ promised
        h = int(hashlib.md5(w.encode()).hexdigest(), 16)
        v[h % dim] += 1.0
    n = math.sqrt(sum(x * x for x in v)) or 1.0
    return [x / n for x in v]


def embeddings(body: dict) -> dict:
    """An OpenAI `embeddings` response for `body`."""
    inp = body.get("input")
    texts = [inp] if isinstance(inp, str) else list(inp or [])
    if texts and isinstance(texts[0], int):
        texts = [texts]
    if texts and isinstance(texts[0], list):          # token ids: LangChain's default
        import tiktoken
        enc = tiktoken.get_encoding("cl100k_base")
        texts = [enc.decode(x) for x in texts]
    dim = int(body.get("dimensions") or EMBED_DIM)
    return {
        "object": "list", "model": body.get("model", "mock-embed"),
        "data": [{"object": "embedding", "index": i, "embedding": embed_one(t, dim)} for i, t in enumerate(texts)],
        "usage": {"prompt_tokens": sum(len(t) // 4 for t in texts), "total_tokens": sum(len(t) // 4 for t in texts)},
    }
