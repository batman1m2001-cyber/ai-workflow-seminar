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

  var LINES = [
    { ch: 1, term: "prompt engineering · structured output", truth: "a function's arguments; <code>json.loads</code> plus a check" },
    { ch: 2, term: "RAG · vector store", truth: "a query, then string formatting; the vector store is a table" },
    { ch: 3, term: "function calling · MCP", truth: "the model proposes JSON, your code runs it; two messages between programs" },
    { ch: 4, term: "agent", truth: "a <code>for</code> loop around an LLM call" },
    { ch: 5, term: "context engineering · memory · skills · sub-agents", truth: "a function that builds the prompt under a budget; memory is a file; a sub-agent is a tool that runs another loop" },
    { ch: 6, term: "harness engineering · guardrails", truth: "everything that isn't the model: <code>if</code>s, retries, logs, tests" },
    { ch: 7, term: "multi-agent · orchestrator", truth: "agents as nodes, run in parallel, then merged: a workflow" },
    { ch: 8, term: "agent vs workflow", truth: "who picks each arrow: your code, or the model" },
    { ch: 9, term: "“seven agents”", truth: "one agent where the path is open; code, one LLM call or a person everywhere else" },
    { ch: 10, term: "“more agents is better”", truth: "measured: more calls, more tokens, slower, and facts lost in the merge" },
    { ch: 11, term: "production-ready agent", truth: "a workflow engine: timeouts, retries, gates, traces, evals, durable state" },
    { ch: 12, term: "human-in-the-loop · durable agents", truth: "a gate: a draft and a link; a workflow with triggers and stored state" }
  ];

  var full = document.querySelector(".decoder-full");
  if (full) {
    full.innerHTML = '<table class="decoder-t"><thead><tr><th>you hear</th><th>it is, in the workflow</th><th>ch.</th></tr></thead><tbody>' +
      LINES.map(function (l) { return "<tr><td><b>" + l.term + "</b></td><td>" + l.truth + "</td><td>" + l.ch + "</td></tr>"; }).join("") +
      "</tbody></table>";
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
      return '<li class="' + (l.ch === n ? "new" : "") + '"><b>' + l.term + "</b><span>" + l.truth + "</span></li>";
    }).join("");
    box.querySelector(".dc-n").textContent = LINES.filter(function (l) { return l.ch <= n; }).length + " / " + LINES.length;
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
