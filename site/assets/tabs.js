/* Tabbed figures (Acts 2+) and the little workflow graphs drawn in them.
 *
 *   <div class="tabs">
 *     <div class="tab" data-name="Same shape" data-say="caption under the figure" data-chapter="8"> figure html </div>
 *     ...
 *   </div>
 *   <section class="beat" data-beat="1"> shown while tab 1 is chosen </section>
 *
 * Same look and behaviour as the Part I anatomy: numbered pills, ← →, #beat-N
 * in the URL, a .beat-next[data-go] button at the end of a section.
 *
 * A graph, inside any figure:
 *   <script type="application/json" class="wf">
 *     {"title": "RAG", "w": 420, "h": 120,
 *      "nodes": [["id", "label", x, y, "llm|code|tool|io"], ...],
 *      "edges": [["a", "b"], ["a", "b", "label"], ["a", "b", "label", "llm|back|par"], ...]}
 *   </script>
 * x, y are the node's centre. Edge kinds: llm = the model picks this edge
 * (dashed amber), back = a loop (curves back), par = parallel arms.
 *
 * Reveal chips: <button data-reveal="some-id"> toggles .on on #some-id.
 */
(function () {
  "use strict";

  var NS = "http://www.w3.org/2000/svg";
  var NW = 104, NH = 36, seq = 0;

  function el(tag, attrs, text) {
    var e = document.createElementNS(NS, tag);
    for (var k in attrs) e.setAttribute(k, attrs[k]);
    if (text != null) e.textContent = text;
    return e;
  }

  // where the segment from the centre of box a towards b leaves the box
  function border(a, b, w, h) {
    var dx = b[2] - a[2], dy = b[3] - a[3];
    if (!dx && !dy) return [a[2], a[3]];
    var sx = dx ? (w / 2) / Math.abs(dx) : Infinity, sy = dy ? (h / 2) / Math.abs(dy) : Infinity;
    var s = Math.min(sx, sy);
    return [a[2] + dx * s, a[3] + dy * s];
  }

  function graph(spec) {
    var svg = el("svg", { viewBox: "0 0 " + spec.w + " " + spec.h, role: "img", "aria-label": spec.title || "workflow" });
    svg.classList.add("wf-svg");
    // ids unique per graph: a marker defined in a hidden tab does not render for the visible one
    var uid = "wf" + (++seq) + "-";
    var defs = el("defs", {});
    ["n", "a"].forEach(function (c) {
      var m = el("marker", { id: uid + c, viewBox: "0 0 10 10", refX: "9", refY: "5", markerWidth: "7", markerHeight: "7", orient: "auto-start-reverse" });
      m.appendChild(el("path", { d: "M0 0 L10 5 L0 10 z", "class": "wf-head " + c }));
      defs.appendChild(m);
    });
    svg.appendChild(defs);
    var by = {}, labels = [];
    spec.nodes.forEach(function (n) { by[n[0]] = n; });
    spec.edges.forEach(function (e) {
      var a = by[e[0]], b = by[e[1]], kind = e[3] || "", g = el("g", { "class": "wf-edge " + kind });
      var d, lx, ly;
      if (kind === "back") {                      // a loop: bow out to the right
        var p1 = [a[2] + NW / 2, a[3]], p2 = [b[2] + NW / 2, b[3]];
        var bow = Math.max(p1[0], p2[0]) + 46;
        d = "M" + p1[0] + " " + p1[1] + " C" + bow + " " + p1[1] + " " + bow + " " + p2[1] + " " + (p2[0] + 2) + " " + p2[1];
        lx = bow - 6; ly = (p1[1] + p2[1]) / 2 + 4;
      } else {
        var s = border(a, b, NW + 6, NH + 6), t = border(b, a, NW + 8, NH + 8);
        d = "M" + s[0] + " " + s[1] + " L" + t[0] + " " + t[1];
        lx = (s[0] + t[0]) / 2; ly = (s[1] + t[1]) / 2 - 6;
      }
      g.appendChild(el("path", { d: d, "marker-end": "url(#" + uid + (kind === "llm" ? "a" : "n") + ")" }));
      if (e[2]) labels.push(el("text", { x: lx, y: ly, "class": "wf-label " + kind, "text-anchor": kind === "back" ? "start" : "middle" }, e[2]));
      svg.appendChild(g);
    });
    spec.nodes.forEach(function (n) {
      var g = el("g", { "class": "wf-node " + (n[4] || "code") });
      g.appendChild(el("rect", { x: n[2] - NW / 2, y: n[3] - NH / 2, width: NW, height: NH, rx: n[4] === "io" ? 18 : 9 }));
      g.appendChild(el("text", { x: n[2], y: n[3] + 4.5, "text-anchor": "middle" }, (n[4] === "llm" ? "✦ " : "") + n[1]));
      svg.appendChild(g);
    });
    labels.forEach(function (l) { svg.appendChild(l); });
    var fig = document.createElement("figure");
    fig.className = "wf";
    fig.appendChild(svg);
    if (spec.title) {
      var cap = document.createElement("figcaption");
      cap.textContent = spec.title;
      fig.appendChild(cap);
    }
    return fig;
  }

  function graphs(root) {
    root.querySelectorAll("script.wf").forEach(function (s) {
      s.parentNode.replaceChild(graph(JSON.parse(s.textContent)), s);
    });
  }

  function mount(root) {
    var tabs = [].slice.call(root.querySelectorAll(":scope > .tab"));
    var sections = [].slice.call(document.querySelectorAll("section.beat"));
    var cur = 1;
    var hash = /^#beat-(\d+)$/.exec(location.hash);
    if (hash) cur = Math.min(tabs.length, Math.max(1, +hash[1]));

    var bar = document.createElement("div");
    bar.className = "an-bar";
    bar.innerHTML = '<div class="an-beats"></div>';
    var stage = document.createElement("div");
    stage.className = "an-stage tabs-stage";
    var cap = document.createElement("div");
    cap.className = "an-cap";
    cap.innerHTML = "<b></b><p></p>";
    tabs.forEach(function (t, i) {
      var b = document.createElement("button");
      b.innerHTML = "<i>" + (i + 1) + "</i>" + t.getAttribute("data-name");
      b.onclick = function () { go(i + 1); };
      bar.firstChild.appendChild(b);
      stage.appendChild(t);
    });
    root.appendChild(bar); root.appendChild(stage); root.appendChild(cap);
    root.classList.add("anatomy");
    root.setAttribute("data-sections", "");
    root.tabIndex = 0;
    graphs(stage);

    function go(n) {
      cur = n;
      tabs.forEach(function (t, i) { t.hidden = i !== n - 1; });
      bar.querySelectorAll("button").forEach(function (b, i) { b.classList.toggle("on", i === n - 1); b.classList.toggle("past", i < n - 1); });
      cap.querySelector("b").textContent = n + " · " + tabs[n - 1].getAttribute("data-name");
      cap.querySelector("p").innerHTML = tabs[n - 1].getAttribute("data-say") || "";
      sections.forEach(function (s) {
        var on = +s.getAttribute("data-beat") === n;
        if (on === !s.hidden) return;
        s.hidden = !on;
        if (on) s.querySelectorAll(".CodeMirror").forEach(function (cm) { cm.CodeMirror && cm.CodeMirror.refresh(); });
      });
      if (history.replaceState) history.replaceState(null, "", "#beat-" + n);
    }
    root.addEventListener("keydown", function (e) {
      if (e.key === "ArrowRight" && cur < tabs.length) { go(cur + 1); e.preventDefault(); }
      if (e.key === "ArrowLeft" && cur > 1) { go(cur - 1); e.preventDefault(); }
    });
    window.addEventListener("hashchange", function () {
      var m = /^#beat-(\d+)$/.exec(location.hash);
      if (m && +m[1] !== cur) go(Math.min(tabs.length, Math.max(1, +m[1])));
    });
    document.querySelectorAll(".beat-next[data-go]").forEach(function (btn) {
      btn.onclick = function () { go(+btn.getAttribute("data-go")); root.scrollIntoView({ behavior: "smooth", block: "start" }); };
    });
    go(cur);
  }

  document.querySelectorAll(".tabs").forEach(mount);
  // graphs outside tabs, too
  graphs(document);
  document.addEventListener("click", function (e) {
    var b = e.target.closest && e.target.closest("[data-reveal]");
    if (!b) return;
    var t = document.getElementById(b.getAttribute("data-reveal"));
    if (t) { t.classList.toggle("on"); b.classList.toggle("on"); }
  });
})();
