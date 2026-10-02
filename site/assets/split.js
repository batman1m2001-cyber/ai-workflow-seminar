/* One block per idea: the story reads first, code waits in a tab.
 *
 * Loaded on every act page BEFORE app.js / cards.js, while everything is still
 * plain markup:
 *   - a beat's agent-world code block (.playground) followed by its X-ray
 *     (.pipeline) become one block: the playground moves into the pipeline,
 *     where cards.js shows it as an extra tab ("＋ The same in LangChain")
 *     beside "X-ray" and "Code", and the
 *     "In the agent world" heading above it and a bare "X-ray" one go;
 *   - any other code block is folded behind a "▶ Playground · title" button in
 *     place; opening it re-measures its editor.
 */
(function () {
  "use strict";

  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }

  function fold(el) {
    var box = document.createElement("div");
    box.className = "pg-fold";
    var btn = document.createElement("button");
    btn.type = "button";
    btn.className = "sp-ref";
    btn.setAttribute("aria-expanded", "false");
    var title = el.getAttribute("data-title") || "Run it", lc = /^LangChain: /.test(title);
    btn.innerHTML = '<span class="sp-ref-k">' + (lc ? "＋ The same in LangChain" : "▶ Playground") + "</span>" + esc(title.replace(/^LangChain: /, ""));
    var body = document.createElement("div");
    body.className = "pg-body";
    body.hidden = true;
    el.parentNode.replaceChild(box, el);
    body.appendChild(el);
    box.appendChild(btn);
    box.appendChild(body);
    btn.onclick = function () {
      var open = body.hidden;
      body.hidden = !open;
      box.classList.toggle("open", open);
      btn.setAttribute("aria-expanded", open ? "true" : "false");
      if (!lc) btn.firstChild.textContent = open ? "▼ Playground" : "▶ Playground";
      if (open) body.querySelectorAll(".CodeMirror").forEach(function (cm) { cm.CodeMirror && cm.CodeMirror.refresh(); });
    };
  }

  document.querySelectorAll("main.content section.beat").forEach(function (s) {
    [].slice.call(s.querySelectorAll(":scope > .playground")).forEach(function (pg) {
      var next = pg.nextElementSibling;
      while (next && /^(H3|H4|P)$/.test(next.tagName)) next = next.nextElementSibling;
      if (!next || !next.classList.contains("pipeline")) { fold(pg); return; }
      [].slice.call(s.querySelectorAll(":scope > h3")).forEach(function (h) {   // the tab says "X-ray" now
        if (/^\s*X-ray\s*$/.test(h.textContent) && h.compareDocumentPosition(next) & Node.DOCUMENT_POSITION_FOLLOWING) h.parentNode.removeChild(h);
      });
      var head = pg.previousElementSibling;
      if (head && /^H[34]$/.test(head.tagName) && /agent world/i.test(head.textContent)) head.parentNode.removeChild(head);
      var tool = (pg.getAttribute("data-title") || "").split(":")[0];
      next.setAttribute("data-alt", "＋ The same in " + (tool || "a framework"));
      next.appendChild(pg);
    });
  });
})();
