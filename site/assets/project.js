/* agent.py, chapter by chapter: the function graph, the whole file, and the wire.
 *
 *   <div class="project" data-ch="3"></div>   agent.py after chapter 3: the whole file (new lines
 *                                             marked), ▶ Run, its output, and what went over the wire
 *
 * The files are site/assets/py/agent/ch1.py … ch7.py. ▶ Run sends the file with a
 * short prelude that reports every call of one of its functions (sys.setprofile), so
 * the agent diagram (anatomy.js) lights each function's part in call order, and the calls to llm(), embed() and
 * mcp_request() show their real request and reply.
 */
(function () {
  "use strict";

  var ROOT = document.body.getAttribute("data-root") || ".";
  var MARK = "\u001e";
  var WIRE = { llm: 1, embed: 1, mcp_request: 1 };

  var PRELUDE = [
    "import json as _json, sys as _sys, threading as _threading",
    "_WIRE = {'llm', 'embed', 'mcp_request'}",
    "def _prof(frame, event, arg):",
    "    if event not in ('call', 'return'):",
    "        return",
    "    name = frame.f_code.co_name",
    "    if frame.f_globals.get('__name__') != '__main__' or name.startswith(('_', '<')) or name == 'tokens':",
    "        return",
    "    ev = {'e': event, 'fn': name, 'id': id(frame), 'by': frame.f_back.f_code.co_name if frame.f_back else ''}",
    "    if name in _WIRE:",
    "        if event == 'call':",
    "            ev['args'] = {k: v for k, v in frame.f_locals.items() if k != 'server'}",
    "        else:",
    "            ev['value'] = arg",
    "    _sys.stdout.write('" + "\\x1e" + "' + _json.dumps(ev, default=str, ensure_ascii=False) + '\\n')",
    "    _sys.stdout.flush()",
    "_sys.setprofile(_prof)",
    "_threading.setprofile(_prof)",
    ""
  ].join("\n");

  // which box of the flow (anatomy.js) each agent.py function lights; a model call
  // lights the box that made it, so web_research counts its turns
  var PART = {
    read_email: "email", screen: "screen", email_agent: "email_agent", extract_company: "extract",
    calendar: "calendar", company_info: "company_info", memory_agent: "memory", report_agent: "report",
    check_brief: "check", human_approval: "approval"
  };
  var LLM_BY = { email_agent: "email_agent", report_agent: "report", web_research: "web", research: "web" };
  function boxOf(ev) { return ev.fn === "llm" ? LLM_BY[ev.by] : PART[ev.fn]; }

  // and back: clicking a part shows the code that is it
  var CODE = {
    email: "def read_email(", screen: "def screen(", email_agent: "def email_agent(", extract: "def extract_company(",
    web: "def web_research(", loop: "def research(", calendar: "def calendar(", company_info: "def company_info(",
    memory: "def memory_agent(", report: "def report_agent(", check: "def check_brief(", approval: "def human_approval("
  };

  function esc(s) { return String(s).replace(/[&<>]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]; }); }
  function mode() { try { return localStorage.getItem("seminar.mode") || "real"; } catch (e) { return "real"; } }
  function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
  var cache = {};
  function source(ch) {
    if (!cache[ch]) cache[ch] = fetch(ROOT + "/assets/py/agent/ch" + ch + ".py").then(function (r) { return r.text(); });
    return cache[ch];
  }

  // lines of b that are not in a (longest common subsequence)
  function added(a, b) {
    var n = a.length, m = b.length, L = [];
    for (var i = 0; i <= n; i++) { L.push(new Array(m + 1).fill(0)); }
    for (i = n - 1; i >= 0; i--) for (var j = m - 1; j >= 0; j--)
      L[i][j] = a[i] === b[j] ? L[i + 1][j + 1] + 1 : Math.max(L[i + 1][j], L[i][j + 1]);
    var out = {}; i = 0; j = 0;
    while (j < m) {
      if (i < n && a[i] === b[j]) { i++; j++; }
      else if (i < n && L[i + 1][j] >= L[i][j + 1]) i++;
      else { out[j] = true; j++; }
    }
    return out;
  }

  // ── one chapter's project ────────────────────────────────────────────
  function mount(el) {
    var ch = +el.getAttribute("data-ch");
    var graph = document.querySelector(".anatomy");
    el.innerHTML =
      '<div class="pj-head"><div class="pj-title"><code>agent.py</code> after chapter ' + ch + ' <span class="pj-meta"></span></div>' +
      '<div class="pj-ctl"><button class="pj-reset" type="button">Reset</button><button class="run" type="button">▶ Run</button></div></div>' +
      '<div class="pj-body"><div class="pj-code"></div>' +
      '<div class="pj-side"><div class="pj-tabs"><button class="on" data-v="out" type="button">Output</button>' +
      '<button data-v="wire" type="button">On the wire <span class="pj-n"></span></button></div>' +
      '<pre class="pj-out">Press ▶ Run: the whole file runs, and the graph above lights up as each function is called.</pre>' +
      '<div class="pj-wire" hidden></div></div></div>';
    var codeBox = el.querySelector(".pj-code"), out = el.querySelector(".pj-out"), wire = el.querySelector(".pj-wire");
    var runBtn = el.querySelector(".run"), cm = null, original = "";

    el.querySelectorAll(".pj-tabs button").forEach(function (b) {
      b.onclick = function () {
        el.querySelectorAll(".pj-tabs button").forEach(function (x) { x.classList.toggle("on", x === b); });
        out.hidden = b.getAttribute("data-v") !== "out";
        wire.hidden = !out.hidden;
      };
    });

    Promise.all([source(ch), ch > 1 ? source(ch - 1) : Promise.resolve("")]).then(function (s) {
      original = s[0];
      var lines = s[0].split("\n"), plus = ch > 1 ? added(s[1].split("\n"), lines) : {};
      var nAdded = Object.keys(plus).filter(function (k) { return lines[k].trim(); }).length;
      el.querySelector(".pj-meta").textContent = lines.length + " lines" + (ch > 1 ? " · +" + nAdded + " new" : "");
      cm = el._cm = window.CodeMirror(codeBox, { value: s[0], mode: "python", theme: "seminar", lineNumbers: true, indentUnit: 4,
                                        viewportMargin: Infinity });
      Object.keys(plus).forEach(function (k) { if (lines[k].trim()) cm.addLineClass(+k, "background", "pj-added"); });
      var first = Object.keys(plus).map(Number).find(function (k) { return lines[k].trim() && !/^(import|from) /.test(lines[k]); });
      el._first = first;
    });
    el.querySelector(".pj-reset").onclick = function () { if (cm) cm.setValue(original); };

    function light(ev) { var id = boxOf(ev); if (graph && graph.flash && id) graph.flash(id); }

    function wireItem(call, ret) {
      var a = call.args || {}, title, req, rep;
      if (call.fn === "llm") {
        title = "→ POST /chat/completions · " + (a.messages || []).length + " messages";
        req = JSON.stringify({ model: "gpt-4o-mini", messages: a.messages }, null, 2);
        rep = ret ? String(ret.value) : "…";
      } else if (call.fn === "embed") {
        title = "→ POST /embeddings";
        req = JSON.stringify({ model: "text-embedding-3-small", input: [a.text] }, null, 2);
        var v = ret && ret.value;
        rep = Array.isArray(v) ? "[" + v.slice(0, 6).map(function (x) { return (+x).toFixed(4); }).join(", ") + ", … " + v.length + " numbers]" : "…";
      } else {
        title = "→ MCP " + a.method;
        req = JSON.stringify({ jsonrpc: "2.0", method: a.method, params: a.params }, null, 2);
        rep = ret ? JSON.stringify({ jsonrpc: "2.0", result: ret.value }, null, 2) : "…";
      }
      var d = document.createElement("details");
      d.className = "pj-w " + call.fn;
      d.innerHTML = "<summary>" + esc(title) + "</summary><div class=\"pj-wl\">request</div><pre>" + esc(req) +
        "</pre><div class=\"pj-wl\">reply</div><pre>" + esc(rep.length > 6000 ? rep.slice(0, 6000) + "\n… (" + rep.length + " chars)" : rep) + "</pre>";
      return d;
    }

    runBtn.onclick = function () {
      if (runBtn.disabled || !cm) return;
      runBtn.disabled = true; runBtn.textContent = "Running…";
      if (graph && graph.clearFlash) graph.clearFlash(true);
      wire.innerHTML = ""; out.textContent = "running…"; el.querySelector(".pj-n").textContent = "";
      if (graph) graph.scrollIntoView({ behavior: "smooth", block: "start" });   // watch it light up
      fetch(ROOT + "/api/run", { method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ code: PRELUDE + cm.getValue(), mode: mode(), page: "agent-ch" + ch }) })
        .then(function (r) { return r.json(); })
        .catch(function () { return { stdout: "", stderr: "No runner answered. Start it: uv run python -m runner.server", exit: 1 }; })
        .then(function (res) {
          var events = [], text = [];
          (res.stdout || "").split("\n").forEach(function (l) {
            if (l.charAt(0) === MARK) { try { events.push(JSON.parse(l.slice(1))); } catch (e) { /* a cut line */ } }
            else text.push(l);
          });
          out.textContent = text.join("\n").replace(/\n+$/, "") + (res.stderr && res.exit ? "\n" + res.stderr.trim().split("\n").slice(-6).join("\n") : "") || "(no output)";
          out.classList.toggle("bad", !!res.exit);
          var rets = {}, calls = events.filter(function (e) { return e.e === "call"; });
          events.forEach(function (e) { if (e.e === "return") rets[e.id + ":" + e.fn] = e; });
          var wired = calls.filter(function (c) { return WIRE[c.fn]; });
          el.querySelector(".pj-n").textContent = wired.length;
          wired.forEach(function (c) { wire.appendChild(wireItem(c, rets[c.id + ":" + c.fn])); });
          // replay the calls on the graph, quick enough to watch
          var step = Math.max(90, Math.min(420, 6000 / Math.max(1, calls.length)));
          var p = Promise.resolve();
          calls.forEach(function (c) { p = p.then(function () { light(c); return sleep(WIRE[c.fn] ? step * 1.6 : step); }); });
          return p;
        })
        .then(function () {
          if (graph) graph.querySelectorAll(".hot").forEach(function (x) { x.classList.remove("hot"); });
          if (graph) graph.classList.remove("running");
          runBtn.disabled = false; runBtn.textContent = "▶ Run";
        });
    };
  }

  document.querySelectorAll(".project[data-ch]").forEach(mount);

  // a click on a diagram part selects its function in the open chapter's file
  var diagram = document.querySelector(".anatomy");
  if (diagram) diagram.addEventListener("click", function (e) {
    var part = e.target.closest && e.target.closest("[data-id]");
    var el = document.querySelector("section.beat:not([hidden]) .project");
    var named = /^(\w+)\(\)/.exec(e.target.textContent || "");   // a chip like "screen(): the gate"
    var cm = el && el._cm, want = named && e.target.tagName === "text" ? "def " + named[1] + "(" : part && CODE[part.getAttribute("data-id")];
    if (!cm || !want) return;
    var lines = cm.getValue().split("\n"), at = lines.findIndex(function (l) { return l.indexOf(want) === 0; });
    if (at < 0) return;                                       // not in this chapter's file yet
    var end = at + 1;
    while (end < lines.length && (lines[end] === "" || /^\s/.test(lines[end]))) end++;
    while (end > at + 1 && lines[end - 1] === "") end--;
    el.scrollIntoView({ behavior: "smooth", block: "start" });
    (el._focus || []).forEach(function (n) { cm.removeLineClass(n, "background", "pj-focus"); });
    el._focus = [];
    for (var n = at; n < end; n++) { cm.addLineClass(n, "background", "pj-focus"); el._focus.push(n); }
    cm.setCursor({ line: at, ch: 0 });
    var box = el.querySelector(".pj-code");
    box.scrollTop = cm.heightAtLine(at, "local") - 24;                     // the panel scrolls, not the editor
    box.scrollLeft = 0;
  });
})();
