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

  var BEATS = [
    { n: 1, name: "The call", terms: "prompt engineering · structured output",
      say: "One model call: the email goes in, and a parser turns the reply into data — which company, what they want.",
      xray: "A function, a string template, and json.loads with a check." },
    { n: 2, name: "Knowledge", terms: "RAG",
      say: "The model doesn't know our history with this company, so we fetch our notes and put them in the prompt.",
      xray: "Embed, dot product, top-k: then paste the hits into the f-string." },
    { n: 3, name: "Tools", terms: "function calling · MCP",
      say: "The model asks for actions: search the web, read a page, look the company up in the CRM over MCP.",
      xray: "A JSON schema pasted into the prompt, and a parser that reads the reply. Your code runs the tool." },
    { n: 4, name: "The loop", terms: "agent · ReAct",
      say: "Search, read, decide it knows enough: call, act, look at the result, until the model says it is done.",
      xray: "A for loop. The control flow is trivial; the capability is in the model; the risk is in the plumbing." },
    { n: 5, name: "Context", terms: "context engineering · memory · skills · sub-agents",
      say: "Long runs rot the context. Choose what the model sees: budget, compaction, memory files, skills, sub-agents.",
      xray: "A function that assembles the prompt under a token budget. Memory and skills are files. A sub-agent is a tool whose body is another loop." },
    { n: 6, name: "The harness", terms: "harness engineering · durable agents · human-in-the-loop · guardrails",
      say: "Everything around the model: permissions, checkpoints, triggers, approvals, traces, evals.",
      xray: "Everything that isn't the model: config, ifs, retries, logs, tests. Agent = Model + Harness." },
    { n: 7, name: "Many agents", terms: "multi-agent · orchestrator · workers",
      say: "Website, news, people: three questions, so three agents at once, and one step that merges their answers.",
      xray: "The same loop called three times in asyncio.gather, then a function that merges. Functions joined by arrows: a workflow." }
  ];

  // x, y, w, h · beat it arrives · name · subtitle · what it is in code
  var PARTS = [
    { id: "user", b: 1, x: 50, y: 300, w: 130, h: 64, name: "Email", sub: "a new lead", xr: "input: dict" },
    { id: "prompt", b: 1, x: 235, y: 300, w: 160, h: 64, name: "Prompt", sub: "template", xr: 'f"...{q}"' },
    { id: "llm", b: 1, x: 455, y: 280, w: 190, h: 104, name: "LLM", sub: "the model", xr: "POST /chat", big: true },
    { id: "parser", b: 1, x: 705, y: 300, w: 160, h: 64, name: "Output parser", sub: "text → data", xr: "json.loads + if" },
    { id: "answer", b: 1, x: 920, y: 300, w: 130, h: 64, name: "Brief", sub: "for sales", xr: "return value" },
    { id: "docs", b: 2, x: 50, y: 470, w: 130, h: 64, name: "Notes", sub: "CRM history", xr: "a table" },
    { id: "retriever", b: 2, x: 235, y: 470, w: 160, h: 64, name: "Retriever", sub: "pgvector", xr: "ORDER BY <=>" },
    { id: "tools", b: 3, x: 455, y: 470, w: 190, h: 104, name: "Tools", sub: "", xr: "schema → prompt", big: true,
      chips: ["functions", "MCP"] },
    { id: "subagent", b: 5, x: 705, y: 490, w: 160, h: 64, name: "Sub-agent", sub: "own context", xr: "def tool(): loop()" },
    { id: "context", b: 5, x: 235, y: 120, w: 410, h: 92, name: "Context window", sub: "", xr: "trim(messages, budget)", big: true,
      chips: ["budget", "compaction", "tool-result clearing", "just-in-time"] },
    { id: "memory", b: 5, x: 50, y: 134, w: 130, h: 64, name: "Memory files", sub: "AGENTS.md", xr: "a .md file" },
    { id: "team", b: 7, x: 920, y: 470, w: 130, h: 64, name: "3 agents", sub: "in parallel", xr: "gather(...)" },
    { id: "skills", b: 5, x: 705, y: 134, w: 160, h: 64, name: "Skills", sub: "loaded on demand", xr: "read on demand" }
  ];

  // from · to · beat · label · route ("v" = vertical, "loop" = drawn by hand)
  var EDGES = [
    { a: "user", b: "prompt", beat: 1 },
    { a: "prompt", b: "llm", beat: 1 },
    { a: "llm", b: "parser", beat: 1 },
    { a: "parser", b: "answer", beat: 1 },
    { a: "docs", b: "retriever", beat: 2, label: "embed" },
    { a: "retriever", b: "prompt", beat: 2, label: "top-k", v: true },
    { a: "llm", b: "tools", beat: 3, label: "tool call", v: true, dx: -40 },
    { a: "tools", b: "llm", beat: 3, label: "result", v: true, dx: 40 },
    { a: "tools", b: "subagent", beat: 5, label: "delegate" },
    { a: "memory", b: "context", beat: 5 },
    { a: "skills", b: "context", beat: 5 },
    { a: "context", b: "llm", beat: 5, label: "what the model sees", v: true, dx: 60 },
    { a: "team", b: "answer", beat: 7, label: "merge", v: true }
  ];

  var HARNESS = ["permissions · hooks", "checkpoints · resume", "triggers", "approvals", "traces", "evals"];

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
      var g = el("g", { "class": "an-harness" + (beat === 6 ? " new" : "") });
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
      var L = el("g", { "class": "an-loop" + (beat === 4 ? " new" : "") });
      var t = byId.tools, l = byId.llm;
      // a tight arc on the right of the LLM ↔ tools pair: result → next call
      var x0 = t.x + t.w, y0 = t.y + 24, y1 = l.y + l.h - 20;
      L.appendChild(el("path", { d: "M" + x0 + " " + y0 + " C" + (x0 + 55) + " " + y0 + " " + (x0 + 55) + " " + y1 +
        " " + (x0 + 4) + " " + y1, "marker-end": "url(#an-arr-" + (beat === 4 ? "g" : "n") + ")" }));
      L.appendChild(el("text", { x: x0 + 50, y: 420, "class": "an-loopt" },
        xray ? "for step in range(8):" : "gather → act → verify"));
      L.appendChild(el("text", { x: x0 + 50, y: 438, "class": "an-loops" },
        xray ? "" : "until the model says done"));
      svg.appendChild(L);
    }

    PARTS.forEach(function (p) {
      if (p.b > beat) return;
      var isNew = p.b === beat;
      var g = el("g", { "class": "an-part" + (isNew ? " new" : "") + (p.big ? " big" : "") });
      g.appendChild(el("rect", { x: p.x, y: p.y, width: p.w, height: p.h, rx: p.big ? 16 : 32 }));
      var cy = p.chips && !xray ? p.y + 30 : p.y + p.h / 2 + (p.sub && !xray ? -2 : 5);
      g.appendChild(el("text", { x: p.x + p.w / 2, y: cy, "text-anchor": "middle", "class": "an-name" }, xray ? p.xr : p.name));
      if (p.sub && !xray && !p.chips)
        g.appendChild(el("text", { x: p.x + p.w / 2, y: cy + 18, "text-anchor": "middle", "class": "an-sub" }, p.sub));
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
      document.dispatchEvent(new CustomEvent("beatchange", { detail: { beat: beat } }));   // decoder.js listens
    }
    root.goto = function (n) { beat = n; render(); };
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
