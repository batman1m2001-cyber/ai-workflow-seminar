"""`openai`, for the in-browser runtime only.

When no local runner is up, the plain-Python playgrounds run in Pyodide.
There the real SDK cannot reach a server, so this module stands in for it:
the same `OpenAI().chat.completions.create(...)` surface, answered by
`mockllm` in process. Installed under the name `openai`.
"""
import asyncio

import mockllm


class _O(dict):
    """A dict you can also read with dots — like the SDK's response objects."""

    def __getattr__(self, k):
        return _wrap(self.get(k))


def _wrap(x):
    if isinstance(x, dict):
        return _O({k: _wrap(v) for k, v in x.items()})
    if isinstance(x, list):
        return [_wrap(v) for v in x]
    return x


class _Completions:
    def create(self, **body):
        return _wrap(mockllm.chat(body, sleep=False))


class _AsyncCompletions:
    async def create(self, **body):
        await asyncio.sleep(mockllm.latency(body))
        return _wrap(mockllm.chat(body, sleep=False))


class _Embeddings:
    def create(self, **body):
        return _wrap(mockllm.embeddings(body))


class _AsyncEmbeddings:
    async def create(self, **body):
        return _wrap(mockllm.embeddings(body))


class _Chat:
    def __init__(self, completions):
        self.completions = completions


class OpenAI:
    def __init__(self, *args, **kwargs):
        self.chat = _Chat(_Completions())
        self.embeddings = _Embeddings()


class AsyncOpenAI:
    def __init__(self, *args, **kwargs):
        self.chat = _Chat(_AsyncCompletions())
        self.embeddings = _AsyncEmbeddings()
