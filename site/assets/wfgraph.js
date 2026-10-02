/* A workflow graph in general (Part II, "Nodes and edges"): every kind of node,
 * each with an input and an output, and a run animated over it.
 *
 *   <div class="wfg"></div>
 *
 * Two runs take turns: one where the branch says yes (side by side, a merge that
 * waits for its inputs, a loop back), one where it says no. Positions are
 * computed here, not measured, so it draws fine inside a hidden tab.
 */
(function () {
  "use strict";
  var NS = "http://www.w3.org/2000/svg", W = 1260, H = 520;

  var KIND = {
    io: { badge: "", c: "#1D4289" },
    fn: { badge: "function", c: "#0172CB" },
    llm: { badge: "LLM", c: "#7B4FD6" },
    tool: { badge: "tool", c: "#0E8C99" },
    agent: { badge: "agent", c: "#C9861A" },
    branch: { badge: "branch", c: "#1D4289" },
    sub: { badge: "sub-graph", c: "#00A045" },
    human: { badge: "human", c: "#D6322E" }
  };
  var NODES = [
    { id: "in", k: "io", name: "input", io: "request", x: 20, y: 240, w: 108, h: 60 },
    { id: "classify", k: "llm", name: "classify", io: "text → label", x: 166, y: 226, w: 150, h: 88 },
    { id: "route", k: "branch", name: "route", io: "yes / no", cx: 410, cy: 270, rx: 64, ry: 58 },
    { id: "skip", k: "io", name: "skip", io: "no work", x: 360, y: 430, w: 100, h: 60 },
    { id: "search", k: "tool", name: "search", io: "query → hits", x: 524, y: 56, w: 178, h: 88 },
    { id: "research", k: "agent", name: "research", io: "question → notes", x: 524, y: 226, w: 178, h: 88 },
    { id: "enrich", k: "sub", name: "enrich", io: "id → profile", x: 524, y: 386, w: 178, h: 112 },
    { id: "merge", k: "fn", name: "merge", io: "3 inputs → facts", x: 766, y: 226, w: 156, h: 88 },
    { id: "write", k: "llm", name: "write", io: "facts → draft", x: 982, y: 226, w: 156, h: 88 },
    { id: "approve", k: "human", name: "approve", io: "draft → ok / redo", x: 982, y: 396, w: 156, h: 88 },
    { id: "out", k: "io", name: "output", io: "result", x: 1170, y: 410, w: 80, h: 60 }
  ];
  // in: where it enters b (y offset), down/up: vertical, dx: shift sideways
  var EDGES = [
    { id: "e1", a: "in", b: "classify", data: "request" },
    { id: "e2", a: "classify", b: "route", data: "label" },
    { id: "e3", a: "route", b: "search", data: "query" },
    { id: "e4", a: "route", b: "research", data: "question", label: "yes" },
    { id: "e5", a: "route", b: "enrich", data: "id" },
    { id: "e6", a: "route", b: "skip", data: "label", label: "no", down: true },
    { id: "e7", a: "search", b: "merge", data: "hits", in: -22 },
    { id: "e8", a: "research", b: "merge", data: "notes" },
    { id: "e9", a: "enrich", b: "merge", data: "profile", in: 22 },
    { id: "e10", a: "merge", b: "write", data: "facts" },
    { id: "e11", a: "write", b: "approve", data: "draft", down: true, dx: -30 },
    { id: "e12", a: "approve", b: "write", data: "redo", up: true, dx: 30, label: "redo", back: true },
    { id: "e13", a: "approve", b: "out", data: "result", label: "ok" }
  ];

  // a run: n = a node works from..to (seconds), e = data travels an edge
  var RUNS = [
    { len: 15.8, steps: [
      ["n", "in", 0, 0.5], ["e", "e1", 0.5, 1.2], ["n", "classify", 1.2, 2.0], ["e", "e2", 2.0, 2.5],
      ["n", "route", 2.5, 3.0], ["e", "e3", 3.0, 3.7], ["e", "e4", 3.0, 3.7], ["e", "e5", 3.0, 3.7],
      ["n", "search", 3.7, 4.4], ["e", "e7", 4.4, 5.1],
      ["n", "enrich", 3.7, 5.0], ["e", "e9", 5.0, 5.7],
      ["n", "research", 3.7, 6.4], ["e", "e8", 6.4, 7.1],
      ["n", "merge", 7.1, 7.8], ["e", "e10", 7.8, 8.4],
      ["n", "write", 8.4, 9.2], ["e", "e11", 9.2, 9.8], ["n", "approve", 9.8, 10.6], ["e", "e12", 10.6, 11.2],
      ["n", "write", 11.2, 12.0], ["e", "e11", 12.0, 12.6], ["n", "approve", 12.6, 13.4], ["e", "e13", 13.4, 14.0],
      ["n", "out", 14.0, 15.0]],
      say: [
        [0, "A run starts: the <b>input</b> node hands over a request."],
        [1.2, "<b>classify</b> · an LLM node: text in, label out."],
        [2.5, "<b>route</b> · a branch: the label says <b>yes</b>."],
        [3.0, "Nothing joins <b>search</b>, <b>research</b> and <b>enrich</b>, so they run <b>side by side</b>."],
        [4.4, "<b>merge</b> waits: it runs only when <b>all 3</b> of its inputs are in."],
        [5.7, "<b>research</b> · an agent: an LLM and tools in a loop, so it takes longer. merge still waits."],
        [7.1, "3 of 3 in: <b>merge</b> runs · plain code, 3 inputs → facts."],
        [8.4, "<b>write</b> · an LLM node: facts → draft."],
        [9.8, "<b>approve</b> · a person says <b>redo</b>: an edge back, a <b>loop</b>."],
        [11.2, "<b>write</b> runs again."],
        [12.6, "<b>approve</b> · this time, ok."],
        [14.0, "Done. Each node read its inputs and wrote its outputs; <b>the graph</b> chose what ran next."]] },
    { len: 5.4, steps: [
      ["n", "in", 0, 0.5], ["e", "e1", 0.5, 1.2], ["n", "classify", 1.2, 2.0], ["e", "e2", 2.0, 2.5],
      ["n", "route", 2.5, 3.0], ["e", "e6", 3.0, 3.7], ["n", "skip", 3.7, 4.7]],
      say: [
        [0, "Another run, another input."],
        [2.5, "<b>route</b> · this time the label says <b>no</b>."],
        [3.0, "One edge only: the other nodes <b>never run</b>."]] }
  ];
  var INTO_MERGE = ["e7", "e8", "e9"];

  function el(tag, attrs, text) {
    var e = document.createElementNS(NS, tag);
    for (var k in attrs) e.setAttribute(k, attrs[k]);
    if (text != null) e.textContent = text;
    return e;
  }
  var byId = {};
  NODES.forEach(function (n) {
    if (n.cx == null) { n.cx = n.x + n.w / 2; n.cy = n.y + n.h / 2; }
    else { n.x = n.cx - n.rx; n.y = n.cy - n.ry; n.w = 2 * n.rx; n.h = 2 * n.ry; }
    byId[n.id] = n;
  });

  // every edge is one cubic: [p0, p1, p2, p3]
  function geom(e) {
    var A = byId[e.a], B = byId[e.b], dx = e.dx || 0;
    if (e.down) return line([A.cx + dx, A.y + A.h], [B.cx + dx, B.y]);
    if (e.up) return line([A.cx + dx, A.y], [B.cx + dx, B.y + B.h]);
    var p0 = [A.x + A.w, A.cy], p3 = [B.x, B.cy + (e.in || 0)], mx = (p0[0] + p3[0]) / 2;
    return [p0, [mx, p0[1]], [mx, p3[1]], p3];
  }
  function line(a, b) { return [a, [a[0] + (b[0] - a[0]) / 3, a[1] + (b[1] - a[1]) / 3], [a[0] + 2 * (b[0] - a[0]) / 3, a[1] + 2 * (b[1] - a[1]) / 3], b]; }
  function at(c, t) {
    var u = 1 - t, a = u * u * u, b = 3 * u * u * t, d = 3 * u * t * t, f = t * t * t;
    return [a * c[0][0] + b * c[1][0] + d * c[2][0] + f * c[3][0], a * c[0][1] + b * c[1][1] + d * c[2][1] + f * c[3][1]];
  }
  function dOf(c) { return "M" + c[0] + " C" + c[1] + " " + c[2] + " " + c[3]; }
  // research's own loop, over its top edge
  var R = byId.research, LOOP = [[R.x + R.w - 40, R.y], [R.x + R.w - 40, R.y - 32], [R.x + 40, R.y - 32], [R.x + 40, R.y - 1]];

  function mount(root) {
    var svg = el("svg", { viewBox: "0 0 " + W + " " + H, role: "img", "class": "wg-svg",
      "aria-label": "A workflow graph: input, an LLM node, a branch, three nodes side by side (a tool, an agent, a sub-graph), a merge, an LLM node, a person, output" });
    var defs = el("defs", {});
    defs.innerHTML =
      '<pattern id="wg-dots" width="22" height="22" patternUnits="userSpaceOnUse"><circle cx="2" cy="2" r="1.2" fill="#C9D3E4"/></pattern>' +
      [["n", "#AEB9CC"], ["on", "#00B74F"], ["back", "#C9861A"]].map(function (m) {
        return '<marker id="wg-arr-' + m[0] + '" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">' +
          '<path d="M0 0L10 5L0 10z" fill="' + m[1] + '"/></marker>';
      }).join("");
    svg.appendChild(defs);
    svg.appendChild(el("rect", { x: 0, y: 0, width: W, height: H, fill: "url(#wg-dots)" }));

    var edgeEl = {};
    EDGES.forEach(function (e) {
      var c = geom(e), g = el("g", { "class": "wg-edge" + (e.back ? " back" : "") });
      var p = el("path", { d: dOf(c), "marker-end": "url(#wg-arr-" + (e.back ? "back" : "n") + ")" });
      g.appendChild(p);
      if (e.label) {
        var lp = e.down || e.up ? [c[0][0] + (e.up ? 8 : 8), (c[0][1] + c[3][1]) / 2 + 4] : e.id === "e4" ? [499, 262] : [(c[0][0] + c[3][0]) / 2, c[0][1] - 9];
        g.appendChild(el("text", { x: lp[0], y: lp[1], "text-anchor": e.down || e.up ? "start" : "middle", "class": "wg-elabel" }, e.label));
      }
      svg.appendChild(g);
      edgeEl[e.id] = { g: g, p: p, c: c, e: e };
    });
    var loopP = el("path", { d: dOf(LOOP), "class": "wg-loop", "marker-end": "url(#wg-arr-back)" });
    svg.appendChild(loopP);
    svg.appendChild(el("text", { x: R.cx, y: R.y - 30, "text-anchor": "middle", "class": "wg-looplabel" }, "↻ loop"));

    var nodeEl = {};
    NODES.forEach(function (n) {
      var K = KIND[n.k], g = el("g", { "class": "wg-node " + n.k, "data-id": n.id, style: "--c:" + K.c });
      if (n.k === "branch") {
        var pts = [n.cx, n.y, n.x + n.w, n.cy, n.cx, n.y + n.h, n.x, n.cy].join(" ");
        g.appendChild(el("polygon", { points: pts, "class": "wg-box" }));
        g.appendChild(el("polygon", { points: pts, "class": "wg-tint" }));
        g.appendChild(el("text", { x: n.cx, y: n.cy - 16, "text-anchor": "middle", "class": "wg-kind" }, K.badge));
        g.appendChild(el("text", { x: n.cx, y: n.cy + 6, "text-anchor": "middle", "class": "wg-name" }, n.name));
        g.appendChild(el("text", { x: n.cx, y: n.cy + 24, "text-anchor": "middle", "class": "wg-io" }, n.io));
      } else {
        var rx = n.k === "io" ? n.h / 2 : 14;
        g.appendChild(el("rect", { x: n.x, y: n.y, width: n.w, height: n.h, rx: rx, "class": "wg-box" }));
        g.appendChild(el("rect", { x: n.x, y: n.y, width: n.w, height: n.h, rx: rx, "class": "wg-tint" }));
        if (K.badge) {
          var bw = K.badge.length * 7.4 + 16;
          g.appendChild(el("rect", { x: n.cx - bw / 2, y: n.y + 10, width: bw, height: 19, rx: 9.5, "class": "wg-badge" }));
          g.appendChild(el("text", { x: n.cx, y: n.y + 23.5, "text-anchor": "middle", "class": "wg-badget" }, K.badge));
        }
        var top = K.badge ? n.y + 52 : n.cy - 2;
        g.appendChild(el("text", { x: n.cx, y: top, "text-anchor": "middle", "class": "wg-name" }, n.name));
        g.appendChild(el("text", { x: n.cx, y: top + (K.badge ? 21 : 17), "text-anchor": "middle", "class": "wg-io" }, n.io));
        if (n.k === "sub") {   // a small graph inside the node
          var m = [[562, 470], [606, 459], [606, 483], [650, 470]];
          [[0, 1], [0, 2], [1, 3], [2, 3]].forEach(function (l) {
            g.appendChild(el("line", { x1: m[l[0]][0] + 9, y1: m[l[0]][1], x2: m[l[1]][0] - 9, y2: m[l[1]][1], "class": "wg-mini-l" }));
          });
          m.forEach(function (p) { g.appendChild(el("rect", { x: p[0] - 9, y: p[1] - 6, width: 18, height: 12, rx: 4, "class": "wg-mini" })); });
        }
      }
      svg.appendChild(g);
      nodeEl[n.id] = g;
    });

    var M = byId.merge, cnt = el("g", { "class": "wg-count" });
    cnt.appendChild(el("rect", { x: M.cx - 52, y: M.y - 30, width: 104, height: 22, rx: 11 }));
    var cntT = el("text", { x: M.cx, y: M.y - 14.5, "text-anchor": "middle" }, "");
    cnt.appendChild(cntT);
    svg.appendChild(cnt);

    // tokens: a dot with the name of the data it carries
    var toks = {};
    function tok(id) {
      if (toks[id]) return toks[id];
      var g = el("g", { "class": "wg-tok" });
      g.appendChild(el("rect", { x: -30, y: -30, width: 60, height: 20, rx: 10 }));
      var t = el("text", { x: 0, y: -16, "text-anchor": "middle" }, "");
      g.appendChild(t);
      g.appendChild(el("circle", { cx: 0, cy: 0, r: 6.5 }));
      svg.appendChild(g);
      toks[id] = { g: g, t: t, r: g.querySelector("rect") };
      return toks[id];
    }
    var loopDot = el("circle", { r: 5.5, "class": "wg-loopdot" });
    svg.appendChild(loopDot);

    var stage = document.createElement("div");
    stage.className = "wg-stage";
    stage.appendChild(svg);
    root.innerHTML = "";
    root.appendChild(stage);
    var bar = document.createElement("div");
    bar.className = "wg-bar";
    bar.innerHTML = '<button class="wg-play" type="button">⏸ Pause</button><span class="wg-say"></span>';
    root.appendChild(bar);
    var play = bar.querySelector(".wg-play"), sayEl = bar.querySelector(".wg-say");

    var run = 0, t = 0, paused = false, last = null, said = null;
    function setCls(node, cls) { if (node.getAttribute("class") !== cls) node.setAttribute("class", cls); }

    function render() {
      var R0 = RUNS[run], st = {}, used = {}, moving = {};
      R0.steps.forEach(function (s) {
        if (s[0] === "n") {
          if (t >= s[2] && t < s[3]) st[s[1]] = "run";
          else if (t >= s[3] && st[s[1]] !== "run") st[s[1]] = "done";
        } else {
          if (t >= s[2] && t < s[3]) moving[s[1]] = (t - s[2]) / (s[3] - s[2]);
          if (t >= s[2]) used[s[1]] = true;
        }
      });
      NODES.forEach(function (n) {
        setCls(nodeEl[n.id], "wg-node " + n.k + " " + (st[n.id] || "wait"));
      });
      EDGES.forEach(function (e) {
        var E = edgeEl[e.id], on = moving[e.id] != null;
        setCls(E.g, "wg-edge" + (e.back ? " back" : "") + (on ? " on" : used[e.id] ? " used" : ""));
        E.p.setAttribute("marker-end", "url(#wg-arr-" + (e.back ? "back" : on || used[e.id] ? "on" : "n") + ")");
        var T = toks[e.id];
        if (on) {
          T = tok(e.id);
          var p = at(E.c, moving[e.id]);
          if (T.t.textContent !== e.data) { T.t.textContent = e.data; var w = e.data.length * 7.2 + 18; T.r.setAttribute("x", -w / 2); T.r.setAttribute("width", w); }
          T.g.setAttribute("transform", "translate(" + p[0].toFixed(1) + " " + p[1].toFixed(1) + ")");
          T.g.style.display = "";
        } else if (T) T.g.style.display = "none";
      });
      // the agent's own loop goes round while it works
      if (st.research === "run") {
        var lp = at(LOOP, (t * 1.4) % 1);
        loopDot.setAttribute("cx", lp[0]); loopDot.setAttribute("cy", lp[1]); loopDot.style.display = "";
        setCls(loopP, "wg-loop on");
      } else { loopDot.style.display = "none"; setCls(loopP, "wg-loop"); }
      // merge counts its inputs
      if (run === 0) {
        var n = INTO_MERGE.filter(function (id) {
          return R0.steps.some(function (s) { return s[1] === id && t >= s[3]; });
        }).length;
        cntT.textContent = "inputs " + n + " / 3";
        setCls(cnt, "wg-count" + (n === 3 ? " full" : "") + (t >= 3.0 ? "" : " off"));
      } else setCls(cnt, "wg-count off");
      var s = null;
      R0.say.forEach(function (x) { if (t >= x[0]) s = x[1]; });
      if (s !== said) { sayEl.innerHTML = s || ""; said = s; }
    }

    function frame(now) {
      if (root.offsetParent && !paused) {
        if (last != null) t += Math.min(0.1, (now - last) / 1000);
        if (t > RUNS[run].len) { run = (run + 1) % RUNS.length; t = 0; }
        render();
      }
      last = now;
      requestAnimationFrame(frame);
    }
    play.onclick = function () {
      paused = !paused;
      play.textContent = paused ? "▶ Play" : "⏸ Pause";
    };
    if (window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches) {
      paused = true; t = RUNS[0].len - 0.5; play.textContent = "▶ Play";
    }
    render();
    requestAnimationFrame(frame);
  }

  document.querySelectorAll(".wfg").forEach(mount);
})();
