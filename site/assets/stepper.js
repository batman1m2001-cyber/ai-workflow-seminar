/* A run, step by step: how one engine runs a small graph (Part II tabs 4 and 5).
 *
 *   <div class="stepper"><script type="application/json">
 *     {"nodes": [["triage", "triage", 0, 1], ...],      id, label, column, row
 *      "edges": [["triage", "recall"], ...],
 *      "panel": "dict" | "slots", "panelTitle": "...",
 *      "steps": [{"t": "0 s", "say": "...",
 *                 "nodes": {"triage": "run" | "done" | "wait"},   anything else is idle
 *                 "badges": {"brief": "2 to go"},
 *                 "state": [["lead", "{...}", "new"]],             key, value, mark (new | held | "")
 *                 "note": "a line under the state"}]}
 *   </script></div>
 *
 * ▶ Next and ◀ Back walk the steps; the graph, the state and the caption follow.
 */
(function () {
  "use strict";
  var NS = "http://www.w3.org/2000/svg";

  function esc(s) { return String(s).replace(/[&<>]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]; }); }

  function mount(root) {
    var spec = JSON.parse(root.querySelector("script").textContent);
    var cols = Math.max.apply(null, spec.nodes.map(function (n) { return n[2]; })) + 1;
    var rows = Math.max.apply(null, spec.nodes.map(function (n) { return n[3]; })) + 1;
    root.innerHTML =
      '<div class="st-top"><div class="st-ctl"><button class="st-back" type="button">◀ Back</button>' +
      '<button class="st-next" type="button">▶ Next</button><span class="st-n"></span></div><div class="st-t"></div></div>' +
      '<div class="st-body"><div class="st-graph" style="grid-template-columns:repeat(' + cols + ',1fr);grid-template-rows:repeat(' + rows + ',auto)">' +
      spec.nodes.map(function (n) {
        return '<div class="st-node" data-id="' + n[0] + '" style="grid-column:' + (n[2] + 1) + ";grid-row:" + (n[3] + 1) + '"><b>' + esc(n[1]) +
          '</b><i class="st-badge"></i></div>';
      }).join("") + '<svg class="st-edges"></svg></div>' +
      '<div class="st-panel"><div class="st-ph">' + esc(spec.panelTitle || "state") + '</div><div class="st-state"></div><div class="st-note"></div></div></div>' +
      '<p class="st-say"></p>';
    var graph = root.querySelector(".st-graph"), svg = root.querySelector(".st-edges");
    var nodes = {};
    root.querySelectorAll(".st-node").forEach(function (n) { nodes[n.getAttribute("data-id")] = n; });
    var cur = 0;

    function edges() {
      var box = graph.getBoundingClientRect();
      if (!box.width) return;
      svg.setAttribute("viewBox", "0 0 " + box.width + " " + box.height);
      svg.innerHTML = '<defs><marker id="st-arr" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0 0L10 5L0 10z"/></marker></defs>';
      spec.edges.forEach(function (e) {
        var a = nodes[e[0]].getBoundingClientRect(), b = nodes[e[1]].getBoundingClientRect();
        var x1 = a.right - box.left, y1 = a.top + a.height / 2 - box.top, x2 = b.left - box.left - 2, y2 = b.top + b.height / 2 - box.top;
        var mx = (x1 + x2) / 2, p = document.createElementNS(NS, "path");
        p.setAttribute("d", "M" + x1 + " " + y1 + " C" + mx + " " + y1 + " " + mx + " " + y2 + " " + x2 + " " + y2);
        p.setAttribute("marker-end", "url(#st-arr)");
        svg.appendChild(p);
      });
    }

    function show(i) {
      cur = Math.max(0, Math.min(spec.steps.length - 1, i));
      var s = spec.steps[cur];
      Object.keys(nodes).forEach(function (id) {
        var n = nodes[id], st = (s.nodes || {})[id] || "";
        n.className = "st-node" + (st ? " " + st : "");
        n.querySelector(".st-badge").textContent = (s.badges || {})[id] || "";
      });
      root.querySelector(".st-t").innerHTML = "<b>" + esc(s.t || "") + "</b>";
      root.querySelector(".st-n").textContent = (cur + 1) + " / " + spec.steps.length;
      root.querySelector(".st-say").innerHTML = s.say || "";
      root.querySelector(".st-note").innerHTML = s.note || "";
      var st = root.querySelector(".st-state");
      if (spec.panel === "slots") {
        st.innerHTML = '<table><tr><th>slot (op · output · context)</th><th>value</th></tr>' + (s.state || []).map(function (r) {
          return '<tr class="' + (r[2] || "") + '"><td><code>' + esc(r[0]) + "</code></td><td>" + esc(r[1]) + "</td></tr>";
        }).join("") + "</table>";
      } else {
        st.innerHTML = '<div class="st-dict">{' + (s.state || []).map(function (r) {
          return '<div class="' + (r[2] || "") + '"><code>"' + esc(r[0]) + '"</code>: ' + esc(r[1]) + ",</div>";
        }).join("") + "}</div>";
      }
      root.querySelector(".st-back").disabled = cur === 0;
      root.querySelector(".st-next").disabled = cur === spec.steps.length - 1;
      edges();
    }
    root.querySelector(".st-next").onclick = function () { show(cur + 1); };
    root.querySelector(".st-back").onclick = function () { show(cur - 1); };
    root.tabIndex = 0;
    root.addEventListener("keydown", function (e) {
      if (e.key === "ArrowDown" || e.key === "PageDown") { show(cur + 1); e.preventDefault(); e.stopPropagation(); }
      if (e.key === "ArrowUp" || e.key === "PageUp") { show(cur - 1); e.preventDefault(); e.stopPropagation(); }
    });
    window.addEventListener("resize", edges);
    root._redraw = edges;
    show(0);
  }

  document.querySelectorAll(".stepper").forEach(mount);
  // a stepper in a tab measured nothing while hidden: draw its arrows when shown
  window.seminarSteppers = function () {
    document.querySelectorAll(".stepper").forEach(function (s) { if (s._redraw && s.offsetParent) s._redraw(); });
  };
})();
