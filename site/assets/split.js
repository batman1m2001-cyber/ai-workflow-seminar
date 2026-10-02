/* Folded playgrounds: the story reads first, the code opens where it is told.
 *
 * Loaded on every act page BEFORE app.js / cards.js, so it wraps the runnable
 * things (.playground, .pipeline in a section.beat) while they are still plain
 * markup. Each one is folded behind a "▶ Playground · title" button in place;
 * the button opens and closes it. Editors built while folded measured nothing,
 * so opening re-measures them.
 */
(function () {
  "use strict";

  var RUN = ".playground, .pipeline";

  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }

  document.querySelectorAll("main.content section.beat").forEach(function (s) {
    [].slice.call(s.querySelectorAll(RUN)).filter(function (el) {
      return !el.parentElement.closest(RUN);            // not nested in another runnable
    }).forEach(function (el) {
      var fold = document.createElement("div");
      fold.className = "pg-fold";
      var btn = document.createElement("button");
      btn.type = "button";
      btn.className = "sp-ref";
      btn.setAttribute("aria-expanded", "false");
      btn.innerHTML = '<span class="sp-ref-k">▶ Playground</span>' + esc(el.getAttribute("data-title") || "Run it");
      var body = document.createElement("div");
      body.className = "pg-body";
      body.hidden = true;
      el.parentNode.replaceChild(fold, el);
      body.appendChild(el);
      fold.appendChild(btn);
      fold.appendChild(body);
      btn.onclick = function () {
        var open = body.hidden;
        body.hidden = !open;
        fold.classList.toggle("open", open);
        btn.setAttribute("aria-expanded", open ? "true" : "false");
        btn.firstChild.textContent = open ? "▼ Playground" : "▶ Playground";
        if (open) body.querySelectorAll(".CodeMirror").forEach(function (cm) { cm.CodeMirror && cm.CodeMirror.refresh(); });
      };
    });
  });
})();
