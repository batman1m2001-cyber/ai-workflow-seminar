# Workflow Is All You Need

*Agents, RAG, tool calling, context engineering: the same primitives, one engine.*

The seminar as a website: one page per topic, each with code you can edit and run.

## Run it

```bash
./stack.sh up        # mail + db (docker), seed, mocks, runner, the OperonX app, Studio
./stack.sh status    # site http://127.0.0.1:8000 · inbox :8025 · Studio :8766
./stack.sh down
```

It expects the sibling checkouts `../meeting-prep-projects` and `../../operonx-studio`
(override with `MEETING_PREP_DIR`, `STUDIO_DIR`). If another Postgres holds 5433:
`PREP_DB_PORT=5434 ./stack.sh up`.

Just the site, no live demo: `uv sync && uv run python -m runner.server`.

| mode | model | needs |
|---|---|---|
| **Mock model** (default) | a scripted model served by the runner at `/mock/v1` — offline, instant, the same every run | nothing |
| **Real model** | any OpenAI-compatible endpoint | `.env` from `.env.example` |

Without the runner (the site opened as files, or hosted statically), the plain-Python
pages still run **in the browser** (Pyodide, mock model only); the OperonX and framework
pages need the runner.

## Before the talk

```bash
./stack.sh check            # every playground (mock) + the meeting-prep golden eval — want "0 failed", 19/19
uv run python -m runner.check --real   # the playgrounds against your endpoint
```

Studio (started by `stack.sh`, sign-in off) opens on `meeting-prep-operonx`: its graphs,
its services (webhook, approval, the 8 am schedule) and every run, including the golden eval.

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
