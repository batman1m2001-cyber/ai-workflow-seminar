/* "Look inside" figures (Part I): a flow of steps; click a step to unfold its raw content.
 *
 *   <div class="fl">
 *     … <div class="fl-step" data-raw="k">…</div> …
 *     <template class="fl-src" data-k="k" data-t="title"> raw html </template>
 *     <div class="fl-panel" hidden></div>
 *   </div>
 *
 * One panel per figure; a second click, or ✕, folds it again.
 */
(function () {
  "use strict";
  document.querySelectorAll(".fl").forEach(function (fl) {
    var panel = fl.querySelector(".fl-panel");
    fl.querySelectorAll("[data-raw]").forEach(function (st) {
      st.tabIndex = 0;
      st.setAttribute("role", "button");
      function close() {
        st.classList.remove("on");
        panel.hidden = true;
      }
      function toggle() {
        var was = st.classList.contains("on");
        fl.querySelectorAll("[data-raw].on").forEach(function (x) { x.classList.remove("on"); });
        if (was) { panel.hidden = true; return; }
        var src = fl.querySelector('.fl-src[data-k="' + st.getAttribute("data-raw") + '"]');
        if (!src) return;
        st.classList.add("on");
        panel.innerHTML = '<div class="fl-ph"><b></b><button type="button" class="fl-x">close ✕</button></div>' + src.innerHTML;
        panel.querySelector(".fl-ph b").textContent = src.getAttribute("data-t") || "";
        panel.querySelector(".fl-x").onclick = close;
        panel.hidden = false;
      }
      st.addEventListener("click", toggle);
      st.addEventListener("keydown", function (e) {
        if (e.key === "Enter" || e.key === " ") { toggle(); e.preventDefault(); e.stopPropagation(); }
      });
    });
  });
})();
