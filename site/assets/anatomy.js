/* The meeting-prep flow, one layer at a time: one SVG that grows over seven layers, with an X-ray flip.
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

  var W = 1090, H = 494, TOP = 24;   // TOP: room above for the loop

  // each layer adds an idea, and the boxes of the real meeting-prep flow that use it
  var BEATS = [
    { n: 1, name: "The call", terms: "prompt engineering · structured output",
      say: "email_agent reads the email with one model call and answers in JSON: is it a lead, which company, what do they want.",
      xray: "llm(triage_prompt(email)), then json.loads and a check." },
    { n: 2, name: "Knowledge", terms: "RAG",
      say: "company_info finds our past notes on this company; report_agent writes the brief from them.",
      xray: "embed(), one SQL query ORDER BY distance, the notes pasted into brief_prompt()." },
    { n: 3, name: "Tools and MCP", terms: "MCP · function calling",
      say: "extract_company asks the CRM who sent it (a company id); calendar and company_info use that id over MCP; web_research lets the model pick a tool.",
      xray: "MCP: JSON-RPC to another program. Function calling: the tools are text in the prompt; the model writes JSON; our code runs it." },
    { n: 4, name: "The loop", terms: "agent · ReAct",
      say: "web_research becomes the agent: search, read, decide it knows enough. The only box that loops.",
      xray: "research(): a for loop around llm(), until the model stops asking for tools." },
    { n: 5, name: "Context", terms: "context engineering · memory",
      say: "The research loop keeps its prompt small; memory_agent merges every source into one evidence pack, each fact once.",
      xray: "assemble_context() before each call; memory_agent is dict.fromkeys(): code, not a model." },
    { n: 6, name: "The harness", terms: "harness · guardrails · human-in-the-loop",
      say: "screen stops an email that gives orders; research may only read; check_brief looks for leaks; a person approves the brief.",
      xray: "Plain ifs around the model, and a draft with a link: the click is the next run." },
    { n: 7, name: "Many agents", terms: "multi-agent · parallel",
      say: "Three researchers at once, side by side with calendar and company_info, then memory_agent merges: the whole flow.",
      xray: "ThreadPoolExecutor: four boxes at the same time, then one merge. It's a workflow." }
  ];

  // the boxes: where they sit, when they join, what they are · what they are in code
  var PARTS = [
    { id: "email", b: 1, x: 20, y: 200, w: 106, h: 64, name: "Email", sub: "read_email()", xr: "a dict", kind: "io" },
    { id: "screen", b: 6, x: 166, y: 200, w: 104, h: 64, name: "screen", sub: "the gate", xr: "if attack:", kind: "harness" },
    { id: "email_agent", b: 1, x: 330, y: 120, w: 170, h: 80, name: "email_agent", sub: "is it a lead? 1 LLM call", xr: "parse(llm(prompt))" },
    { id: "extract", b: 3, x: 330, y: 300, w: 170, h: 64, name: "extract_company", sub: "who is it? CRM · MCP", xr: "crm_find_company" },
    { id: "web", b: 3, x: 610, y: 40, w: 186, h: 92, name: "web_research",
      subs: { 3: "the model picks a tool", 4: "the agent: a loop", 5: "loop · small context", 6: "loop · read-only tools", 7: "3 researchers at once" },
      xr: "for turn: llm → tool" },
    { id: "company_info", b: 2, x: 610, y: 186, w: 186, h: 92, name: "company_info",
      subs: { 2: "what we know · RAG", 3: "notes (RAG) + CRM · MCP" }, xr: "recall() + crm_*" },
    { id: "calendar", b: 3, x: 610, y: 330, w: 186, h: 64, name: "calendar", sub: "meetings booked · MCP", xr: "calendar_meetings" },
    { id: "memory", b: 5, x: 860, y: 40, w: 206, h: 64, name: "memory_agent", sub: "merge, each fact once", xr: "dict.fromkeys(facts)" },
    { id: "report", b: 2, x: 860, y: 150, w: 206, h: 72, name: "report_agent", sub: "1 LLM call writes the brief", xr: "llm(brief_prompt())" },
    { id: "check", b: 6, x: 860, y: 262, w: 206, h: 58, name: "check_brief", sub: "no leaks", xr: "if leaks(brief):", kind: "harness" },
    { id: "approval", b: 6, x: 860, y: 352, w: 206, h: 70, name: "human_approval", sub: "a draft + a link · a person", xr: "save_draft; mail.send", kind: "harness" }
  ];

  // from · to · first layer · last layer (0: still there) · label (the data it carries) · "v": top/bottom
  var EDGES = [
    { a: "email", b: "email_agent", from: 1, to: 5, label: "email" },
    { a: "email", b: "extract", from: 3, to: 5, label: "sender" },
    { a: "email", b: "screen", from: 6 },
    { a: "screen", b: "email_agent", from: 6, label: "ok" },
    { a: "screen", b: "extract", from: 6, label: "ok" },
    { a: "email_agent", b: "web", from: 3, label: "lead" },
    { a: "email_agent", b: "company_info", from: 2, label: "lead" },
    { a: "extract", b: "company_info", from: 3, label: "company" },
    { a: "extract", b: "calendar", from: 3, label: "company" },
    { a: "company_info", b: "report", from: 2, to: 4 },
    { a: "calendar", b: "report", from: 3, to: 4 },
    { a: "web", b: "report", from: 3, to: 4 },
    { a: "web", b: "memory", from: 5 },
    { a: "calendar", b: "memory", from: 5 },
    { a: "company_info", b: "memory", from: 5 },
    { a: "memory", b: "report", from: 5, v: true },
    { a: "report", b: "check", from: 6, v: true },
    { a: "check", b: "approval", from: 6, v: true, label: "clean" }
  ];

  var NS = "http://www.w3.org/2000/svg";
  function el(tag, attrs, text) {
    var e = document.createElementNS(NS, tag);
    for (var k in attrs) e.setAttribute(k, attrs[k]);
    if (text != null) e.textContent = text;
    return e;
  }
  var byId = {};
  PARTS.forEach(function (p) { byId[p.id] = p; });
  function subOf(p, beat) {
    if (!p.subs) return p.sub;
    var s = null;
    Object.keys(p.subs).forEach(function (k) { if (+k <= beat) s = p.subs[k]; });
    return s;
  }
  function live(e, beat) { return beat >= e.from && (!e.to || beat <= e.to); }

  function edgePath(e) {
    var A = byId[e.a], B = byId[e.b];
    if (e.v) {
      var x = A.x + A.w / 2;
      return { d: "M" + x + " " + (A.y + A.h) + " L" + x + " " + B.y, lx: x + 8, ly: (A.y + A.h + B.y) / 2 + 4 };
    }
    var x1 = A.x + A.w, y1 = A.y + A.h / 2, x2 = B.x, y2 = B.y + B.h / 2, mx = (x1 + x2) / 2;
    if (y1 === y2) return { d: "M" + x1 + " " + y1 + " L" + x2 + " " + y2, lx: mx, ly: y1 - 8, mid: true };
    // the label sits near the start, where the arrows from one box are still apart
    var t = 0.35, u = 1 - t, lx = u * u * u * x1 + 3 * u * u * t * mx + 3 * u * t * t * mx + t * t * t * x2;
    var ly = u * u * u * y1 + 3 * u * u * t * y1 + 3 * u * t * t * y2 + t * t * t * y2;
    return { d: "M" + x1 + " " + y1 + " C" + mx + " " + y1 + " " + mx + " " + y2 + " " + x2 + " " + y2,
             lx: lx, ly: ly - 7, mid: true };
  }

  function draw(root, beat, xray) {
    var svg = el("svg", { viewBox: "0 0 " + W + " " + H, role: "img",
      "aria-label": "The meeting-prep flow after layer " + beat + ": " + BEATS[beat - 1].name });
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
    var top = el("g", { transform: "translate(0 " + TOP + ")" });
    svg.appendChild(top);

    // layer 7: the three boxes that run side by side
    if (beat >= 7) {
      var G = el("g", { "class": "an-par" + (beat === 7 ? " new" : "") });
      G.appendChild(el("rect", { x: 598, y: -14, width: 210, height: 474, rx: 18 }));
      G.appendChild(el("text", { x: 703, y: 452, "text-anchor": "middle" }, xray ? "ThreadPoolExecutor()" : "side by side"));
      top.appendChild(G);
    }

    EDGES.forEach(function (e) {
      if (!live(e, beat)) return;
      var p = edgePath(e), isNew = e.from === beat;
      var g = el("g", { "class": "an-edge" + (isNew ? " new" : "") });
      g.appendChild(el("path", { d: p.d, "marker-end": "url(#an-arr-" + (isNew ? "g" : "n") + ")" }));
      if (e.label) g.appendChild(el("text", { x: p.lx, y: p.ly, "text-anchor": p.mid ? "middle" : "start" }, e.label));
      top.appendChild(g);
    });

    // layer 4: the loop, on web_research only
    if (beat >= 4) {
      var w = byId.web, L = el("g", { "class": "an-loop" + (beat === 4 ? " new" : ""), "data-id": "loop" });
      var x0 = w.x + 44, x1 = w.x + w.w - 44;
      L.appendChild(el("path", { d: "M" + x1 + " " + w.y + " C" + x1 + " " + (w.y - 34) + " " + x0 + " " + (w.y - 34) + " " + x0 + " " + (w.y - 2),
        "marker-end": "url(#an-arr-" + (beat === 4 ? "g" : "n") + ")" }));
      L.appendChild(el("text", { x: w.x + w.w / 2, y: w.y - 30, "text-anchor": "middle", "class": "an-loopt" }, xray ? "for turn in range(8)" : "↻ loop"));
      top.appendChild(L);
    }

    PARTS.forEach(function (p) {
      if (p.b > beat) return;
      var isNew = p.b === beat || (p.subs && p.subs[beat]);
      var g = el("g", { "class": "an-part" + (isNew ? " new" : "") + (p.kind ? " " + p.kind : ""), "data-id": p.id });
      // layer 7: three researchers, drawn as a stack
      if (p.id === "web" && beat >= 7) {
        [10, 5].forEach(function (d) {
          g.appendChild(el("rect", { x: p.x + d, y: p.y + d, width: p.w, height: p.h, rx: 14, "class": "an-stack" }));
        });
      }
      g.appendChild(el("rect", { x: p.x, y: p.y, width: p.w, height: p.h, rx: p.kind === "io" ? 30 : 14 }));
      var sub = subOf(p, beat);
      g.appendChild(el("text", { x: p.x + p.w / 2, y: p.y + p.h / 2 - (sub ? 2 : -5), "text-anchor": "middle", "class": "an-name" },
        xray ? p.xr : p.name));
      if (sub && !xray) g.appendChild(el("text", { x: p.x + p.w / 2, y: p.y + p.h / 2 + 16, "text-anchor": "middle", "class": "an-sub" }, sub));
      top.appendChild(g);
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
      var r = g.querySelector("rect:not(.an-stack)"), t = g.querySelector(".an-count");
      if (counts[id] < 2 || !r) return;
      if (!t) {
        // web_research has the loop above it: its count goes below
        var below = id === "web", y = +r.getAttribute("y");
        t = el("text", { x: +r.getAttribute("x") + +r.getAttribute("width") - 8, y: below ? y + +r.getAttribute("height") + 30 : y - 6,
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
