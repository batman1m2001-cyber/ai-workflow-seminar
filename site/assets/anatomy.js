/* The agent anatomy: one SVG that grows over seven chapters, with an X-ray flip.
 *
 *   <div class="anatomy" data-beat="1"></div>            ← → steps through the beats
 *   <div class="anatomy" data-beat="3" data-lock></div>  one beat, X-ray only
 *   <div class="anatomy" data-sections></div>  the beats are tabs: only the page's
 *       <section class="beat" data-beat="N"> of the chosen beat is shown
 *       (a .beat-next[data-go] button moves on; #beat-N in the URL opens one)
 *
 * Each beat adds parts (drawn green while they are new). X-ray swaps every
 * part's name for what it really is in code — and the picture turns into
 * what it always was: functions joined by arrows.
 */
(function () {
  "use strict";

  var W = 1100, H = 640;

  // each beat names its idea; each part names the agent.py function that is it
  var BEATS = [
    { n: 1, name: "The call", terms: "prompt engineering · structured output",
      say: "The email goes in, the model answers, and a parser turns the reply into data: which company, what they want.",
      xray: "read_email(), an f-string, one HTTP POST, json.loads with a check." },
    { n: 2, name: "Knowledge", terms: "RAG · vector store",
      say: "The model doesn't know our history with this company, so we fetch our notes and put them in the prompt.",
      xray: "embed(), then one SQL query ORDER BY distance, then paste the notes into the prompt." },
    { n: 3, name: "Tools and MCP", terms: "function calling · MCP",
      say: "The model asks for a tool; the CRM is another program, reached over MCP.",
      xray: "The tools are text in the prompt; the model writes JSON; our code runs it. MCP is JSON-RPC over stdin and stdout." },
    { n: 4, name: "The loop", terms: "agent · ReAct",
      say: "Search, read, decide it knows enough: ask the model, run its tool, show it the result, until it answers.",
      xray: "research(): a for loop around llm(). The control flow is trivial; the capability is in the model." },
    { n: 5, name: "Context", terms: "context engineering · memory",
      say: "Long runs rot the context. Choose what the model sees each turn: standing notes from a file, old results cleared.",
      xray: "assemble_context(): a function that builds the prompt under a budget. Memory is a file: AGENTS.md." },
    { n: 6, name: "The harness", terms: "harness engineering · guardrails",
      say: "Everything around the model that makes it safe: a gate before any model, a check before every tool call, a log.",
      xray: "screen() and guard(): plain ifs. Agent = Model + Harness." },
    { n: 7, name: "Many agents", terms: "multi-agent · orchestrator · workers",
      say: "What it sells, the news, the people: three questions, three agents at once, and one step that merges their answers.",
      xray: "research_team(): the same loop three times in threads, then merge(). Functions joined by arrows: a workflow." }
  ];

  // x, y, w, h · beat it arrives · name · the agent.py function · what it is in code
  var PARTS = [
    { id: "user", b: 1, x: 50, y: 300, w: 130, h: 64, name: "Email", sub: "read_email()", xr: "a dict" },
    { id: "prompt", b: 1, x: 235, y: 300, w: 160, h: 64, name: "Prompt", sub: "build_prompt()", xr: 'an f-string' },
    { id: "llm", b: 1, x: 455, y: 280, w: 190, h: 104, name: "LLM", sub: "llm()", xr: "one HTTP POST", big: true },
    { id: "parser", b: 1, x: 705, y: 300, w: 160, h: 64, name: "Output parser", sub: "parse()", xr: "json.loads + if" },
    { id: "answer", b: 1, x: 920, y: 300, w: 130, h: 64, name: "Brief", sub: "brief_prompt()", xr: "llm() again" },
    { id: "docs", b: 2, x: 50, y: 470, w: 130, h: 64, name: "Notes", sub: "kb_chunks", xr: "a table" },
    { id: "retriever", b: 2, x: 235, y: 470, w: 160, h: 64, name: "Retriever", sub: "recall()", xr: "ORDER BY <=>" },
    { id: "tools", b: 3, x: 455, y: 470, w: 190, h: 104, name: "Tools", sub: "tools_prompt()", xr: "schemas → prompt text", big: true },
    { id: "mcp", b: 3, x: 740, y: 490, w: 150, h: 64, name: "CRM · MCP", sub: "call_tool()", xr: "JSON-RPC, stdio" },
    { id: "context", b: 5, x: 235, y: 134, w: 410, h: 64, name: "Context", sub: "assemble_context()", xr: "a function, under a budget", big: true },
    { id: "memory", b: 5, x: 50, y: 134, w: 130, h: 64, name: "Memory", sub: "AGENTS.md", xr: "a .md file" },
    { id: "team", b: 7, x: 905, y: 470, w: 160, h: 64, name: "3 researchers", sub: "research_team()", xr: "3 threads + merge()" }
  ];

  // from · to · beat · label · route ("v" = vertical)
  var EDGES = [
    { a: "user", b: "prompt", beat: 1 },
    { a: "prompt", b: "llm", beat: 1 },
    { a: "llm", b: "parser", beat: 1 },
    { a: "parser", b: "answer", beat: 1 },
    { a: "docs", b: "retriever", beat: 2, label: "embed" },
    { a: "retriever", b: "prompt", beat: 2, label: "top-k", v: true },
    { a: "llm", b: "tools", beat: 3, label: "tool call", v: true, dx: -40 },
    { a: "tools", b: "llm", beat: 3, label: "result", v: true, dx: 40 },
    { a: "tools", b: "mcp", beat: 3, label: "tools/call" },
    { a: "memory", b: "context", beat: 5 },
    { a: "context", b: "llm", beat: 5, label: "what the model sees", v: true, dx: 60 },
    { a: "team", b: "answer", beat: 7, label: "merge", v: true }
  ];

  var HARNESS = ["screen(): the gate", "guard(): every tool call", "allowed tools", "a log line per call"];

  var NS = "http://www.w3.org/2000/svg";
  function el(tag, attrs, text) {
    var e = document.createElementNS(NS, tag);
    for (var k in attrs) e.setAttribute(k, attrs[k]);
    if (text != null) e.textContent = text;
    return e;
  }
  var byId = {};
  PARTS.forEach(function (p) { byId[p.id] = p; });

  function edgePath(e) {
    var A = byId[e.a], B = byId[e.b];
    if (e.v) {                                   // vertical: bottom/top centres, offset by dx
      var x = (e.a === "retriever" ? A.x + A.w / 2 : A.x + A.w / 2 + (e.dx || 0));
      var up = A.y > B.y;
      var y1 = up ? A.y : A.y + A.h, y2 = up ? B.y + B.h : B.y;
      return { d: "M" + x + " " + y1 + " L" + x + " " + y2, lx: x + 8, ly: (y1 + y2) / 2 + 4 };
    }
    var ay = A.y + A.h / 2, by = B.y + B.h / 2;
    var x1 = A.x + A.w, x2 = B.x;
    if (ay === by) return { d: "M" + x1 + " " + ay + " L" + x2 + " " + by, lx: (x1 + x2) / 2, ly: ay - 10, mid: true };
    var mx = (x1 + x2) / 2;
    return { d: "M" + x1 + " " + ay + " C" + mx + " " + ay + " " + mx + " " + by + " " + x2 + " " + by,
             lx: mx, ly: (ay + by) / 2 - 8, mid: true };
  }

  function draw(root, beat, xray) {
    var svg = el("svg", { viewBox: "0 0 " + W + " " + H, role: "img",
      "aria-label": "Agent anatomy, beat " + beat + ": " + BEATS[beat - 1].name });
    svg.classList.add("an-svg");
    if (xray) svg.classList.add("xray");
    var defs = el("defs", {});
    ["n", "g"].forEach(function (c) {
      var m = el("marker", { id: "an-arr-" + c, viewBox: "0 0 10 10", refX: "9", refY: "5",
        markerWidth: "7", markerHeight: "7", orient: "auto-start-reverse" });
      m.appendChild(el("path", { d: "M0 0 L10 5 L0 10 z", "class": "an-head " + c }));
      defs.appendChild(m);
    });
    svg.appendChild(defs);

    // beat 6: the harness frame around everything
    if (beat >= 6) {
      var g = el("g", { "class": "an-harness" + (beat === 6 ? " new" : ""), "data-id": "harness" });
      g.appendChild(el("rect", { x: 18, y: 40, width: W - 36, height: H - 58, rx: 22 }));
      g.appendChild(el("text", { x: 40, y: 72, "class": "an-hname" }, xray ? "if · retry · log · test" : "Harness"));
      var cx = 230;
      HARNESS.forEach(function (h) {
        var w = h.length * 7.4 + 26;
        g.appendChild(el("rect", { x: cx, y: 28, width: w, height: 26, rx: 13, "class": "an-hchip" }));
        g.appendChild(el("text", { x: cx + w / 2, y: 46, "text-anchor": "middle", "class": "an-hchipt" }, h));
        cx += w + 10;
      });
      svg.appendChild(g);
    }

    EDGES.forEach(function (e) {
      if (e.beat > beat) return;
      var p = edgePath(e), isNew = e.beat === beat;
      var g = el("g", { "class": "an-edge" + (isNew ? " new" : "") });
      g.appendChild(el("path", { d: p.d, "marker-end": "url(#an-arr-" + (isNew ? "g" : "n") + ")" }));
      if (e.label) g.appendChild(el("text", { x: p.lx, y: p.ly, "text-anchor": p.mid ? "middle" : "start" }, e.label));
      svg.appendChild(g);
    });

    // beat 4: the loop — results go back into the next call
    if (beat >= 4) {
      var L = el("g", { "class": "an-loop" + (beat === 4 ? " new" : ""), "data-id": "loop" });
      var t = byId.tools, l = byId.llm;
      // a tight arc on the right of the LLM ↔ tools pair: result → next call
      var x0 = t.x + t.w, y0 = t.y + 24, y1 = l.y + l.h - 20;
      L.appendChild(el("path", { d: "M" + x0 + " " + y0 + " C" + (x0 + 55) + " " + y0 + " " + (x0 + 55) + " " + y1 +
        " " + (x0 + 4) + " " + y1, "marker-end": "url(#an-arr-" + (beat === 4 ? "g" : "n") + ")" }));
      L.appendChild(el("text", { x: x0 + 50, y: 420, "class": "an-loopt" },
        xray ? "for turn in range(8):" : "research()"));
      L.appendChild(el("text", { x: x0 + 50, y: 438, "class": "an-loops" },
        xray ? "" : "until the model answers"));
      svg.appendChild(L);
    }

    PARTS.forEach(function (p) {
      if (p.b > beat) return;
      var isNew = p.b === beat;
      var g = el("g", { "class": "an-part" + (isNew ? " new" : "") + (p.big ? " big" : ""), "data-id": p.id });
      g.appendChild(el("rect", { x: p.x, y: p.y, width: p.w, height: p.h, rx: p.big ? 16 : 32 }));
      var cy = p.chips && !xray ? p.y + 30 : p.y + p.h / 2 + (p.sub && !xray ? -2 : 5);
      g.appendChild(el("text", { x: p.x + p.w / 2, y: cy, "text-anchor": "middle", "class": "an-name" }, xray ? p.xr : p.name));
      if (p.sub && !xray && !p.chips)
        g.appendChild(el("text", { x: p.x + p.w / 2, y: cy + 18, "text-anchor": "middle", "class": "an-sub" + (/\(\)$/.test(p.sub) ? " fn" : "") }, p.sub));
      if (p.chips && !xray) {
        var widths = p.chips.map(function (c) { return c.length * 6.6 + 18; });
        var total = widths.reduce(function (s, w) { return s + w; }, 0) + 6 * (p.chips.length - 1);
        var scale = Math.min(1, (p.w - 16) / total);
        var x = p.x + (p.w - total * scale) / 2;
        var rows = total * scale < p.w - 16 ? 1 : 1;
        p.chips.forEach(function (c, i) {
          var w = widths[i] * scale;
          g.appendChild(el("rect", { x: x, y: p.y + p.h - 40, width: w, height: 24, rx: 12, "class": "an-chip" }));
          g.appendChild(el("text", { x: x + w / 2, y: p.y + p.h - 24, "text-anchor": "middle", "class": "an-chipt",
            "font-size": (11.5 * scale).toFixed(1) }, c));
          x += w + 6 * scale;
        });
        void rows;
      }
      if (p.id === "llm" && beat >= 4 && !xray)
        g.appendChild(el("text", { x: p.x + p.w - 14, y: p.y + 22, "text-anchor": "end", "class": "an-badge" }, "× N"));
      svg.appendChild(g);
    });
    return svg;
  }

  function mount(root) {
    var beat = +root.getAttribute("data-beat") || 1, xray = false, lock = root.hasAttribute("data-lock");
    var sections = root.hasAttribute("data-sections") ? [].slice.call(document.querySelectorAll("section.beat")) : [];
    var hash = /^#beat-(\d)$/.exec(location.hash);
    if (sections.length && hash) beat = Math.min(BEATS.length, Math.max(1, +hash[1]));
    root.innerHTML =
      '<div class="an-bar"><div class="an-beats"></div><span class="spacer"></span>' +
      '<button class="an-x" title="X-ray: what each part really is (X)">X-ray</button></div>' +
      '<div class="an-stage"></div><div class="an-cap"><b></b><span class="terms"></span><p></p></div>';
    var beats = root.querySelector(".an-beats"), stage = root.querySelector(".an-stage");
    if (lock) {
      root.classList.add("locked");
      beats.innerHTML = "<span class=\"an-lock\">The agent so far · beat " + beat + " of " + BEATS.length + "</span>";
    }
    else BEATS.forEach(function (b) {
      var btn = document.createElement("button");
      btn.innerHTML = "<i>" + b.n + "</i>" + b.name;
      btn.onclick = function () { beat = b.n; render(); };
      beats.appendChild(btn);
    });
    root.querySelector(".an-x").onclick = function () { xray = !xray; render(); };
    root.tabIndex = 0;
    root.addEventListener("keydown", function (e) {
      if (lock) { if (e.key === "x" || e.key === "X") { xray = !xray; render(); } return; }
      if (e.key === "ArrowRight" && beat < BEATS.length) { beat++; render(); e.preventDefault(); }
      if (e.key === "ArrowLeft" && beat > 1) { beat--; render(); e.preventDefault(); }
      if (e.key === "x" || e.key === "X") { xray = !xray; render(); }
    });
    function render() {
      var b = BEATS[beat - 1];
      stage.innerHTML = "";
      var svg = draw(root, beat, xray);
      stage.appendChild(svg);
      if (lock) {                                  // one beat: frame just what is drawn
        var bb = svg.getBBox(), pad = 16;
        svg.setAttribute("viewBox", [bb.x - pad, bb.y - pad, bb.width + 2 * pad, bb.height + 2 * pad].join(" "));
      } else if (sections.length) {                // tabs: only as tall as this beat; parts keep their x
        var bh = svg.getBBox(), ph = 24;
        svg.setAttribute("viewBox", [0, bh.y - ph, W, bh.height + 2 * ph].join(" "));
      }
      beats.querySelectorAll("button").forEach(function (x, i) { x.classList.toggle("on", i === beat - 1); x.classList.toggle("past", i < beat - 1); });
      root.querySelector(".an-x").classList.toggle("on", xray);
      root.classList.toggle("xray", xray);
      root.querySelector(".an-cap b").textContent = b.n + " · " + b.name;
      root.querySelector(".an-cap .terms").textContent = b.terms;
      root.querySelector(".an-cap p").textContent = xray ? b.xray : b.say;
      if (sections.length) showSection();
    }
    function showSection() {
      sections.forEach(function (s) {
        var on = +s.getAttribute("data-beat") === beat;
        if (on === !s.hidden) return;
        s.hidden = !on;
        // editors built while hidden measured nothing: re-measure on show
        if (on) s.querySelectorAll(".CodeMirror").forEach(function (cm) { cm.CodeMirror && cm.CodeMirror.refresh(); });
      });
      if (history.replaceState) history.replaceState(null, "", "#beat-" + beat);
    }
    root.goto = function (n) { beat = n; render(); };
    // project.js lights a part as agent.py calls its function: hot now, lit after, with a count
    var counts = {};
    root.flash = function (id) {
      var svg = stage.querySelector("svg"), g = svg && svg.querySelector('[data-id="' + id + '"]');
      if (!g) return;
      svg.querySelectorAll(".hot").forEach(function (x) { x.classList.remove("hot"); });
      g.classList.add("lit", "hot");
      counts[id] = (counts[id] || 0) + 1;
      var r = g.querySelector("rect"), t = g.querySelector(".an-count");
      if (counts[id] < 2 || !r) return;
      if (!t) {
        t = el("text", { x: +r.getAttribute("x") + +r.getAttribute("width") - 8, y: +r.getAttribute("y") - 6,
                         "text-anchor": "end", "class": "an-count" });
        g.appendChild(t);
      }
      t.textContent = "×" + counts[id];
    };
    root.clearFlash = function (on) {
      counts = {};
      var svg = stage.querySelector("svg");
      if (svg) svg.querySelectorAll(".lit, .hot").forEach(function (x) { x.classList.remove("lit", "hot"); });
      if (svg) svg.querySelectorAll(".an-count").forEach(function (x) { x.remove(); });
      root.classList.toggle("running", !!on);
    };
    if (sections.length) window.addEventListener("hashchange", function () {
      var m = /^#beat-(\d)$/.exec(location.hash);
      if (m && +m[1] !== beat) root.goto(Math.min(BEATS.length, Math.max(1, +m[1])));
    });
    document.querySelectorAll(".beat-next.flip").forEach(function (btn) {   // "now flip the whole agent"
      btn.onclick = function () { xray = true; render(); root.scrollIntoView({ behavior: "smooth", block: "start" }); };
    });
    document.querySelectorAll(".beat-next[data-go]").forEach(function (btn) {
      btn.onclick = function () {
        root.goto(+btn.getAttribute("data-go"));
        root.scrollIntoView({ behavior: "smooth", block: "start" });
      };
    });
    render();
  }

  document.querySelectorAll(".anatomy").forEach(mount);
})();
