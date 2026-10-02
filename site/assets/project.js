/* agent.py, chapter by chapter: the function graph, the whole file, and the wire.
 *
 *   <div class="fg" data-ch="3"></div>        the function graph of agent.py after chapter 3
 *   <div class="project" data-ch="3"></div>   the whole file (new lines marked), ▶ Run,
 *                                             its output, and what went over the wire
 *
 * The files are site/assets/py/agent/ch1.py … ch7.py. ▶ Run sends the file with a
 * short prelude that reports every call of one of its functions (sys.setprofile), so
 * the graph lights up in call order, and the calls to llm(), embed() and
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

  // the graph of each chapter: what prepare() calls, in order
  function N(fn, tag, by) { return { fn: fn, tag: tag, by: by }; }
  function G(fn, label, items, kind) { return { group: fn, label: label, items: items, kind: kind || "loop" }; }
  var head = [N("read_email", "the email", "<module>"), N("build_prompt", "prompt engineering", "prepare"),
              N("llm", "the model", "prepare"), N("parse", "structured output", "prepare")];
  var brief = [N("brief_prompt", "the brief's prompt", "prepare"), N("llm", "the model", "prepare")];
  function loop(ch) {
    var items = [N("tools_prompt", "tools as text", "research")];
    if (ch >= 5) items.push(N("assemble_context", "context engineering", "research"));
    items.push(N("llm", "the model", "research"), N("parse_tool_call", "a tool call?", "research"));
    if (ch >= 6) items.push(N("guard", "the harness", "research"));
    items.push(N("run_tool", "our code runs it", "research"));
    return G("research", "↻ research(): the agent loop, until the model answers", items);
  }
  function mcp() { return [N("start_mcp", "MCP server", "prepare"), N("list_tools", "MCP tools/list", "prepare")]; }
  var GRAPHS = {
    1: head,
    2: head.concat([N("recall", "RAG", "prepare")], brief),
    3: head.concat([N("recall", "RAG", "prepare")], mcp(),
                   [N("tools_prompt", "tools as text", "prepare"), N("llm", "the model", "prepare"),
                    N("parse_tool_call", "the model's JSON", "prepare"), N("call_tool", "MCP tools/call", "prepare")], brief),
    4: head.concat([N("recall", "RAG", "prepare")], mcp(), [loop(4)], brief),
    5: head.concat([N("recall", "RAG", "prepare")], mcp(), [loop(5)], brief),
    6: [N("read_email", "the email", "<module>"), N("screen", "the gate", "prepare")].concat(head.slice(1),
        [N("recall", "RAG", "prepare")], mcp(), [loop(6)], brief),
    7: [N("read_email", "the email", "<module>"), N("screen", "the gate", "prepare")].concat(head.slice(1),
        [N("recall", "RAG", "prepare")], mcp(),
        [G("research_team", "×3 agents at once: research_team()", [loop(7)], "team"), N("merge", "merge", "prepare")], brief)
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

  // ── the function graph ───────────────────────────────────────────────
  function keys(items, acc) {
    items.forEach(function (it) {
      if (it.group) { acc.push("g:" + it.group); keys(it.items, acc); }
      else acc.push(it.fn + "@" + it.by);
    });
    return acc;
  }
  function drawGraph(box, ch) {
    var prev = {}, seen = {};
    if (ch > 1) keys(GRAPHS[ch - 1], []).forEach(function (k) { prev[k] = (prev[k] || 0) + 1; });
    function isNew(k) { seen[k] = (seen[k] || 0) + 1; return seen[k] > (prev[k] || 0); }
    function render(items) {
      return items.map(function (it, i) {
        var arrow = i ? '<span class="fg-arr">→</span>' : "";
        if (it.group) {
          var nw = isNew("g:" + it.group);
          return arrow + '<div class="fg-group ' + it.kind + (nw ? " new" : "") + '" data-fn="' + it.group + '">' +
            '<span class="fg-label">' + esc(it.label) + '<i class="fg-cnt"></i></span><div class="fg-row">' + render(it.items) + "</div></div>";
        }
        var n = isNew(it.fn + "@" + it.by);
        return arrow + '<button type="button" class="fg-node' + (n ? " new" : "") + '" data-fn="' + it.fn + '" data-by="' + it.by + '">' +
          "<code>" + it.fn + "()</code><small>" + esc(it.tag) + '</small><i class="fg-cnt"></i></button>';
      }).join("");
    }
    box.innerHTML = '<div class="fg-row fg-top">' + render(GRAPHS[ch]) + "</div>";
    box.setAttribute("data-ready", "");
  }

  // ── one chapter's project ────────────────────────────────────────────
  function mount(el) {
    var ch = +el.getAttribute("data-ch");
    var graph = document.querySelector('.fg[data-ch="' + ch + '"]');
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
      cm = window.CodeMirror(codeBox, { value: s[0], mode: "python", theme: "seminar", lineNumbers: true, indentUnit: 4,
                                        viewportMargin: Infinity });
      Object.keys(plus).forEach(function (k) { if (lines[k].trim()) cm.addLineClass(+k, "background", "pj-added"); });
      var first = Object.keys(plus).map(Number).find(function (k) { return lines[k].trim() && !/^(import|from) /.test(lines[k]); });
      el._first = first;
    });
    el.querySelector(".pj-reset").onclick = function () { if (cm) cm.setValue(original); };

    if (graph) graph.addEventListener("click", function (e) {
      var node = e.target.closest(".fg-node, .fg-group");
      if (!node || !cm) return;
      var at = cm.getValue().split("\n").findIndex(function (l) { return l.indexOf("def " + node.getAttribute("data-fn") + "(") === 0; });
      if (at < 0) return;
      cm.setSelection({ line: at, ch: 0 }, { line: at, ch: 999 });
      cm.scrollIntoView({ line: at, ch: 0 }, 120);
      el.scrollIntoView({ behavior: "smooth", block: "nearest" });
    });

    function nodes() { return graph ? [].slice.call(graph.querySelectorAll(".fg-node, .fg-group")) : []; }
    function clear() { nodes().forEach(function (n) { n.classList.remove("lit", "hot"); n.querySelector(".fg-cnt").textContent = ""; n._n = 0; }); }
    function light(ev) {
      var cands = nodes().filter(function (n) {
        return n.getAttribute("data-fn") === ev.fn && (!n.getAttribute("data-by") || n.getAttribute("data-by") === ev.by);
      });
      if (!cands.length) return null;
      var n = cands.find(function (c) { return !c._n; }) || cands[cands.length - 1];
      n._n = (n._n || 0) + 1;
      n.classList.add("lit");
      if (n._n > 1) n.querySelector(".fg-cnt").textContent = "×" + n._n;
      nodes().forEach(function (x) { x.classList.remove("hot"); });
      n.classList.add("hot");
      return n;
    }

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
      clear(); wire.innerHTML = ""; out.textContent = "running…"; el.querySelector(".pj-n").textContent = "";
      if (graph) {
        graph.classList.add("running");
        graph.closest(".tabs").scrollIntoView({ behavior: "smooth", block: "start" });   // watch it light up
      }
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
          nodes().forEach(function (x) { x.classList.remove("hot"); });
          if (graph) graph.classList.remove("running");
          runBtn.disabled = false; runBtn.textContent = "▶ Run";
        });
    };
  }

  document.querySelectorAll(".fg[data-ch]").forEach(function (g) { drawGraph(g, +g.getAttribute("data-ch")); });
  document.querySelectorAll(".project[data-ch]").forEach(mount);
})();
