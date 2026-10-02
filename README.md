# Workflow Is All You Need

*Agents, RAG, tool calling, context engineering: the same primitives, one engine.*

The seminar as a website: one page per topic, each with code you can edit and run.

## Run it

```powershell
uv sync
uv run python -m runner.server        # http://127.0.0.1:8000
```

Every playground runs in this project's venv — real `operonx`, `openai`, LangChain,
LangGraph and the OpenAI Agents SDK.

| mode | model | needs |
|---|---|---|
| **Mock model** (default) | a scripted model served by the runner at `/mock/v1` — offline, instant, the same every run | nothing |
| **Real model** | any OpenAI-compatible endpoint | `.env` from `.env.example` |

Without the runner (the site opened as files, or hosted statically), the plain-Python
pages still run **in the browser** (Pyodide, mock model only); the OperonX and framework
pages need the runner.

## Before the talk

```powershell
uv run python -m runner.check          # every playground, mock model — want "0 failed"
uv run python -m runner.check --real   # the same against your endpoint
```

OperonX playgrounds that pass `trace=["trace_local:default"]` record to `.operonx/runs`.
Open the project in OperonX Studio to show them:

```powershell
$env:OPERONX_STUDIO_AUTH = "off"
D:\operonx-studio\.venv\Scripts\operonx-studio.exe D:\ai-workflow-seminar   # http://127.0.0.1:8765
```

## Layout

| path | holds |
|---|---|
| `site/index.html`, `site/pages/*.html` | the pages; a playground is `<div class="playground"><script type="text/plain">…code…</script></div>` |
| `site/assets/app.js` | navigation (the page list is `PAGES`), the playground, both runtimes |
| `site/assets/style.css` | the theme (Win green `#00B74F`, navy `#1D4289`) |
| `site/assets/py/mockllm.py` | the mock model — used by the runner and, in the browser, by `openai_shim.py` |
| `runner/server.py` | serves the site, runs code (`/api/run`), serves the mock (`/mock/v1`) |
| `runner/check.py` | runs every playground |
| `resources.yaml` | what the OperonX playgrounds reach: the model, embeddings, FAISS, a doc store, `trace_local` |

The runner executes whatever code it is sent: it listens on 127.0.0.1 only. Keep it that way.

Playground attributes: `data-runtime="auto"` (runner, else browser), `"server"` (runner only),
`"none"` (read-only); `data-expect="error"` marks a block that fails on purpose.
