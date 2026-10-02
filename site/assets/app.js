/* The seminar site: layout, navigation, and the code playgrounds.
 *
 * A playground runs in one of two places:
 *   - the local runner (runner/server.py) — real Python, real operonx, mock or real model;
 *   - the browser (Pyodide) — only when no runner answers, and only for playgrounds
 *     marked data-runtime="auto" (plain Python + the openai SDK, answered by the mock).
 */
(function () {
  "use strict";

  var PAGES = [
    { id: "index", n: "★", title: "The email and the brief", part: "Prologue" },
    { id: "part1-build-the-agent", n: "I", title: "Build the agent from scratch", part: "Part I · The agent, as it is" },
    { id: "part2-who-picks", n: "II", title: "An agent is a workflow with a loop", part: "Part II · Workflow engines" },
    { id: "part3-monday-morning", n: "III", title: "The engine at work", part: "Part III · Production" },
    { id: "epilogue", n: "✓", title: "The decoder", part: "Epilogue" }
  ];

  var body = document.body;
  var ROOT = body.getAttribute("data-root") || ".";
  var PAGE = body.getAttribute("data-page") || "index";
  var idx = PAGES.findIndex(function (p) { return p.id === PAGE; });
  function href(p) { return p.id === "index" ? ROOT + "/index.html" : ROOT + "/pages/" + p.id + ".html"; }
  function esc(s) { return String(s).replace(/[&<>]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]; }); }

  var MODE_KEY = "seminar.mode";
  var mode = "mock";
  try { mode = localStorage.getItem(MODE_KEY) || "real"; } catch (e) { mode = "real"; }   // falls back to mock when the runner has no key
  var runner = null;          // /api/health answer, or null when no runner

  // ── layout ──────────────────────────────────────────────────────────
  function layout() {
    var cur = PAGES[idx] || PAGES[0];
    var top = document.createElement("header");
    top.className = "top";
    top.innerHTML =
      '<button class="menu" aria-label="Menu">☰</button>' +
      '<a class="brand" href="' + ROOT + '/index.html"><span class="dot">⟳</span>Workflow Is All You Need</a>' +
      '<span class="crumb">' + esc(cur.part) + " · " + esc(cur.title) + "</span>" +
      '<span class="spacer"></span>' +
      '<span class="status" title="Where playground code runs"><i></i><span>checking runner…</span></span>' +
      '<div class="mode" role="group" aria-label="Model">' +
      '<button data-m="mock" title="A scripted model — offline, instant, free">Mock model</button>' +
      '<button data-m="real" title="Your endpoint from .env (via the local runner)">Real model</button></div>';
    body.insertBefore(top, body.firstChild);
    top.querySelector(".menu").onclick = function () { body.classList.toggle("nav-open"); };

    var side = document.createElement("nav");
    side.className = "side";
    var html = "", part = null, n = 0;
    PAGES.forEach(function (p, k) {
      if (p.part !== part) { part = p.part; html += "<h6>" + esc(part) + "</h6>"; }
      html += '<a href="' + href(p) + '"' + (k === idx ? ' class="on"' : "") + '><span class="n">' +
        p.n + "</span><span>" + esc(p.title) + "</span></a>";
      n++;
    });
    side.innerHTML = html;
    body.insertBefore(side, top.nextSibling);

    var main = document.querySelector("main.content");
    if (main && idx >= 0) {
      var prev = PAGES[idx - 1], next = PAGES[idx + 1];
      var pager = document.createElement("div");
      pager.className = "pager";
      pager.innerHTML =
        (prev ? '<a class="prev" href="' + href(prev) + '"><small>← Previous</small><b>' + esc(prev.title) + "</b></a>" : "<span></span>") +
        (next ? '<a class="next" href="' + href(next) + '"><small>Next →</small><b>' + esc(next.title) + "</b></a>" : "<span></span>");
      main.appendChild(pager);
    }
    document.addEventListener("keydown", function (e) {
      if (e.target.closest && e.target.closest(".CodeMirror, input, textarea")) return;
      if (e.altKey && e.key === "ArrowRight" && PAGES[idx + 1]) location.href = href(PAGES[idx + 1]);
      if (e.altKey && e.key === "ArrowLeft" && PAGES[idx - 1]) location.href = href(PAGES[idx - 1]);
    });
    renderMode();
    top.querySelectorAll(".mode button").forEach(function (b) {
      b.onclick = function () {
        mode = b.getAttribute("data-m");
        try { localStorage.setItem(MODE_KEY, mode); } catch (e) {}
        renderMode();
      };
    });
  }

  function renderMode() {
    document.querySelectorAll(".mode button").forEach(function (b) {
      var m = b.getAttribute("data-m");
      b.classList.toggle("on", m === mode);
      if (m === "real") b.disabled = !(runner && runner.real);
    });
  }

  function renderStatus() {
    var st = document.querySelector(".status");
    if (!st) return;
    if (runner) {
      st.className = "status ok";
      st.lastChild.textContent = "local runner" + (runner.real ? " · real model ready" : " · mock only");
      st.title = runner.real ? "Real mode: " + runner.model + " @ " + runner.base_url : "Add OPENAI_API_KEY to .env for real mode";
    } else {
      st.className = "status browser";
      st.lastChild.textContent = "in-browser (Pyodide)";
      st.title = "No local runner — start it with: uv run python -m runner.server";
    }
    if (!(runner && runner.real) && mode === "real") mode = "mock";
    renderMode();
  }

  function checkRunner() {
    return fetch(ROOT + "/api/health", { cache: "no-store" })
      .then(function (r) { return r.ok ? r.json() : null; })
      .catch(function () { return null; })
      .then(function (h) { runner = h && h.ok ? h : null; renderStatus(); });
  }

  // ── Pyodide (fallback) ──────────────────────────────────────────────
  var pyodideReady = null;
  function pyodide() {
    if (pyodideReady) return pyodideReady;
    pyodideReady = new Promise(function (resolve, reject) {
      var s = document.createElement("script");
      s.src = "https://cdn.jsdelivr.net/npm/pyodide@0.26.4/pyodide.js";
      s.onload = function () {
        window.loadPyodide({ indexURL: "https://cdn.jsdelivr.net/npm/pyodide@0.26.4/" }).then(function (py) {
          return new Promise(function (ok, bad) {       // a script tag works from file:// too
            var t = document.createElement("script");
            t.src = ROOT + "/assets/py/bundle.js";
            t.onload = function () { ok(window.SEMINAR_PY); };
            t.onerror = function () { bad(new Error("assets/py/bundle.js is missing — start the runner once")); };
            document.head.appendChild(t);
          }).then(function (src) {
            py.FS.mkdirTree("/seminar");
            py.FS.writeFile("/seminar/mockllm.py", src.mockllm);
            py.FS.writeFile("/seminar/openai.py", src.openai);
            py.runPython("import sys; sys.path.insert(0, '/seminar')");
            resolve(py);
          });
        }).catch(reject);
      };
      s.onerror = function () { reject(new Error("Could not load Pyodide (offline?)")); };
      document.head.appendChild(s);
    });
    return pyodideReady;
  }

  function runInBrowser(code) {
    var t0 = performance.now(), out = [], err = [];
    return pyodide().then(function (py) {
      py.setStdout({ batched: function (s) { out.push(s); } });
      py.setStderr({ batched: function (s) { err.push(s); } });
      // Pyodide already runs an event loop: top-level await instead of asyncio.run(...)
      var src = code.replace(/^asyncio\.run\((.*)\)\s*$/gm, "await $1");
      return py.loadPackagesFromImports(src).then(function () {
        return py.runPythonAsync(src, { globals: py.toPy({ __name__: "__main__" }) });
      }).then(function () { return 0; }, function (e) { err.push(String(e.message || e).split("\n").slice(-8).join("\n")); return 1; });
    }).then(function (code) {
      return { stdout: out.join("\n") + (out.length ? "\n" : ""), stderr: err.join("\n"), exit: code, ms: Math.round(performance.now() - t0), where: "browser · mock" };
    }, function (e) {
      return { stdout: "", stderr: String(e.message || e), exit: 1, ms: 0, where: "browser" };
    });
  }

  function runOnRunner(code) {
    return fetch(ROOT + "/api/run", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ code: code, mode: mode, page: PAGE })
    }).then(function (r) { return r.json(); }).then(function (res) {
      res.where = "local runner · " + mode + " model";
      return res;
    });
  }

  // ── playgrounds ─────────────────────────────────────────────────────
  function playgrounds() {
    document.querySelectorAll(".playground").forEach(function (el, k) {
      var src = el.querySelector("script[type='text/plain']");
      var code = src ? src.textContent.replace(/^\n/, "").replace(/\s+$/, "") + "\n" : "";
      var runtime = el.getAttribute("data-runtime") || "server";   // auto | server | none
      var title = el.getAttribute("data-title") || "Playground";
      el.innerHTML =
        '<div class="pg-bar"><span class="title">' + esc(title) +
        (runtime === "none" ? "<small>read-only</small>" : runtime === "server" ? "<small>needs the local runner</small>" : "") +
        "</span>" +
        (runtime === "none" ? "" :
          '<button class="reset" title="Back to the original code">Reset</button>' +
          '<button class="copy" title="Copy the code">Copy</button>' +
          '<button class="run" title="Run (Ctrl+Enter)">▶ Run<kbd>Ctrl⏎</kbd></button>') +
        "</div><div class=\"pg-ed\"></div><div class=\"pg-out\"><div class=\"meta\"></div><pre></pre></div>";
      var cm = window.CodeMirror(el.querySelector(".pg-ed"), {
        value: code, mode: "python", theme: "seminar", lineNumbers: true, indentUnit: 4,
        viewportMargin: Infinity, readOnly: runtime === "none", lineWrapping: false,
        extraKeys: { "Ctrl-Enter": go, "Cmd-Enter": go, Tab: function (c) { c.replaceSelection("    "); } }
      });
      if (runtime === "none") return;
      var out = el.querySelector(".pg-out"), meta = out.querySelector(".meta"), pre = out.querySelector("pre");
      var btn = el.querySelector(".run");
      el.querySelector(".reset").onclick = function () { cm.setValue(code); out.classList.remove("on"); };
      el.querySelector(".copy").onclick = function (e) {
        navigator.clipboard && navigator.clipboard.writeText(cm.getValue());
        e.target.textContent = "Copied"; setTimeout(function () { e.target.textContent = "Copy"; }, 1200);
      };
      btn.onclick = go;

      function go() {
        if (btn.disabled) return;
        btn.disabled = true; btn.firstChild.textContent = "Running… ";
        out.classList.add("on");
        meta.innerHTML = '<span class="dim">running…</span>';
        pre.innerHTML = "";
        var job;
        if (runner) job = runOnRunner(cm.getValue());
        else if (runtime === "auto") job = runInBrowser(cm.getValue());
        else job = Promise.resolve({
          stdout: "", exit: 1, ms: 0, where: "no runner",
          stderr: "This playground runs real operonx, which needs the local runner:\n\n    cd ai-workflow-seminar\n    uv run python -m runner.server\n\nthen open http://127.0.0.1:8000"
        });
        job.then(function (res) {
          var ok = res.exit === 0;
          var onPurpose = !ok && el.getAttribute("data-expect") === "error";
          meta.innerHTML = '<span class="' + (ok ? "ok" : "bad") + '">' + (ok ? "✓ exit 0" : "✗ exit " + res.exit) +
            (onPurpose ? " — fails on purpose" : "") + "</span>" +
            "<span>" + (res.ms / 1000).toFixed(2) + " s</span><span>" + esc(res.where || "") + "</span>";
          pre.innerHTML = esc(res.stdout || "") + (res.stderr ? '<span class="err">' + esc(res.stderr) + "</span>" : "") ||
            '<span class="dim">(no output)</span>';
        }).catch(function (e) {
          meta.innerHTML = '<span class="bad">✗ failed</span>';
          pre.innerHTML = '<span class="err">' + esc(e.message || e) + "</span>";
        }).then(function () { btn.disabled = false; btn.firstChild.textContent = "▶ Run"; });
      }
    });
  }

  // ── diagrams ────────────────────────────────────────────────────────
  // Mermaid lays a diagram out from its size on screen, so one in a hidden tab
  // waits: tabs.js calls window.seminarDiagrams() each time a tab is shown.
  var mermaid = null;
  function renderVisible() {
    if (!mermaid) return;
    var todo = [].slice.call(document.querySelectorAll(".mermaid:not([data-processed])"))
      .filter(function (d) { return d.offsetParent !== null; });
    if (todo.length) mermaid.run({ nodes: todo }).catch(function () {});
  }
  window.seminarDiagrams = renderVisible;
  function diagrams() {
    if (!document.querySelector(".mermaid")) return;
    import("https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.esm.min.mjs").then(function (m) {
      mermaid = m.default;
      mermaid.initialize({
        startOnLoad: false, theme: "base", securityLevel: "strict",
        flowchart: { curve: "basis", nodeSpacing: 34, rankSpacing: 46, padding: 10, useMaxWidth: false },
        themeVariables: {
          fontFamily: "Be Vietnam Pro, sans-serif", fontSize: "15px",
          primaryColor: "#F4F6FB", primaryBorderColor: "#9AABCB", primaryTextColor: "#1D4289",
          lineColor: "#8592AB", secondaryColor: "#EEF2FA", tertiaryColor: "#FFFFFF",
          clusterBkg: "#FAFBFD", clusterBorder: "#DBE0E6", edgeLabelBackground: "#FFFFFF"
        }
      });
      renderVisible();
    }).catch(function () {});
  }

  layout();
  playgrounds();
  diagrams();
  checkRunner();
})();
