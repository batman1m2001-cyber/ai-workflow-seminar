/* The decoder: every buzzword, as what it really is, one line per chapter.
 *
 * A card in the corner fills up as the talk goes: a chapter's line unlocks when
 * its truth (the green callout) comes into view. A later page starts with the
 * chapters before its <body data-chapter="N"> unlocked; a tab's data-chapter
 * (tabs.js) says which chapter a beat belongs to. <div class="decoder-full"></div> draws the whole table in place
 * (the epilogue), with no corner card.
 */
(function () {
  "use strict";

  // one line per chapter: the chapter's "truth", grouped by part
  var PARTS = { 1: "Part I · the agent, from scratch", 8: "Part II · workflow engines", 11: "Part III · production" };
  var LINES = [
    { ch: 1, term: "prompt engineering · structured output", truth: "a function's arguments; <code>json.loads</code> plus a check" },
    { ch: 2, term: "RAG · vector store", truth: "embed, <code>ORDER BY</code> distance, string formatting; the vector store is a table" },
    { ch: 3, term: "function calling · MCP", truth: "tools are text in the prompt; the model writes JSON; your code runs it. MCP is JSON-RPC between programs" },
    { ch: 4, term: "agent", truth: "a <code>for</code> loop around an LLM call" },
    { ch: 5, term: "context engineering · memory", truth: "a function that builds the prompt under a budget; memory is a file" },
    { ch: 6, term: "harness · guardrails", truth: "<code>if</code>s around the model: a gate before it, a check before every tool call" },
    { ch: 7, term: "multi-agent", truth: "the same loop three times in parallel, then a merge: a workflow" },
    { ch: 8, term: "agents at scale", truth: "the more steps the model decides, the slower, costlier and less reliable" },
    { ch: 9, term: "agent vs workflow", truth: "an agent is a graph with one loop whose edge the model picks" },
    { ch: 10, term: "workflow engine", truth: "triggers · compiler · scheduler · executor · state · tracing; LangGraph runs supersteps, OperonX runs dataflow" },
    { ch: 11, term: "production-ready agent", truth: "engine features: a gate node, a concurrency cap, a trace, an eval gate" },
    { ch: 12, term: "observability · agent ops", truth: "Studio: the graph from the code, every run as a trace, a dashboard, evals before every deploy" }
  ];

  var full = document.querySelector(".decoder-full");
  if (full) {
    full.innerHTML = '<table class="decoder-t"><thead><tr><th>you hear</th><th>it is, really</th><th>ch.</th></tr></thead><tbody>' +
      LINES.map(function (l) {
        return (PARTS[l.ch] ? '<tr class="dc-part"><td colspan="3">' + PARTS[l.ch] + "</td></tr>" : "") +
          "<tr><td><b>" + l.term + "</b></td><td>" + l.truth + "</td><td>" + l.ch + "</td></tr>";
      }).join("") + "</tbody></table>";
    return;
  }
  var base = +document.body.getAttribute("data-chapter") || 0;
  var onPart1 = !!document.querySelector(".anatomy[data-sections]");
  if (!base && !onPart1) return;

  var box = document.createElement("aside");
  box.className = "decoder";
  box.innerHTML = '<button class="dc-pill" type="button" aria-expanded="false"><span class="dc-k">Decoder</span><span class="dc-n"></span></button>' +
    '<div class="dc-panel" hidden><div class="dc-h">What each word really is</div><ol class="dc-list"></ol></div>';
  document.body.appendChild(box);
  var pill = box.querySelector(".dc-pill"), panel = box.querySelector(".dc-panel"), list = box.querySelector(".dc-list");
  pill.onclick = function () {
    panel.hidden = !panel.hidden;
    pill.setAttribute("aria-expanded", panel.hidden ? "false" : "true");
  };

  // a line unlocks when its chapter's truth (a green .callout.key in a beat) comes into view,
  // never before: the card must not give the truth away. Earlier chapters are unlocked already.
  var shown = 0;
  function upTo(n) {
    if (n <= shown) return;
    shown = n;
    list.innerHTML = LINES.filter(function (l) { return l.ch <= n; }).map(function (l) {
      return (PARTS[l.ch] ? '<li class="dc-part">' + PARTS[l.ch] + "</li>" : "") +
        '<li class="' + (l.ch === n ? "new" : "") + '"><b>' + l.term + "</b><span>" + l.truth + "</span></li>";
    }).join("");
    box.querySelector(".dc-n").textContent = n + " / " + LINES.length;
    pill.classList.remove("ping"); void pill.offsetWidth; pill.classList.add("ping");
  }
  function chapterOf(section) {
    var beat = +section.getAttribute("data-beat");
    if (onPart1) return beat;
    var tab = document.querySelectorAll(".tab")[beat - 1];
    return tab ? +tab.getAttribute("data-chapter") || 0 : 0;
  }
  if ("IntersectionObserver" in window) {
    var seen = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) upTo(chapterOf(e.target.closest("section.beat")));
      });
    }, { threshold: 0.6 });
    document.querySelectorAll("section.beat .callout.key").forEach(function (c) { seen.observe(c); });
  }
  box.querySelector(".dc-n").textContent = "0 / " + LINES.length;
  upTo(base - 1);
})();
