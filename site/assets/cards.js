/* Pipeline cards: a program shown as the steps it is.
 *
 *   <div class="pipeline" data-title="...">
 *     <div class="step" data-icon="✎" data-title="Prompt" data-desc="One line.">
 *       <script type="text/plain"> python for this step </script>
 *     </div>
 *     ...
 *     <div class="playground" ...>   optional: the same thing, the agent-world way
 *   </div>
 *
 * Three tabs. X-ray (the default): the steps as a row of tiles, each showing
 * what it produced; click a tile to read its whole output below. Code: the
 * whole program in one editor, a "# ── n · title" line before each step. The
 * agent-world version, when the pipeline holds a .playground (split.js puts
 * the beat's LangChain block there).
 *
 * The steps are one Python program, cut into pieces. ▶ Run sends the whole
 * program to the local runner once, with a marker printed around each piece,
 * then lights the tiles in order. Step reveals one tile per press. Editing the
 * code re-runs from scratch.
 */
(function () {
  "use strict";

  var ROOT = document.body.getAttribute("data-root") || ".";
  var MARK = "\u001e";
  var CUT = /^# ── (\d+) · .*$/;

  function esc(s) { return String(s).replace(/[&<>]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]; }); }
  function mode() { try { return localStorage.getItem("seminar.mode") || "real"; } catch (e) { return "real"; } }
  function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
  function dedent(s) {
    var lines = s.replace(/^\n+/, "").replace(/\s+$/, "").split("\n");
    var pad = Math.min.apply(null, lines.filter(function (l) { return l.trim(); }).map(function (l) { return l.match(/^ */)[0].length; }));
    return lines.map(function (l) { return l.slice(pad); }).join("\n");
  }

  function program(codes) {
    var out = ["import time as _t", "def _mark(i, ev): print(f'" + MARK + "{i}:{ev}:{_t.perf_counter():.4f}', flush=True)", ""];
    codes.forEach(function (c, i) { out.push("_mark(" + i + ", 's')", c, "_mark(" + i + ", 'e')", ""); });
    return out.join("\n");
  }

  // stdout with markers → per step {out, ms, done}
  function split(stdout, n) {
    var steps = [], cur = -1, t0 = {};
    for (var i = 0; i < n; i++) steps.push({ out: "", ms: null, done: false, started: false });
    stdout.split("\n").forEach(function (line) {
      if (line.charAt(0) === MARK) {
        var p = line.slice(1).split(":"), k = +p[0];
        if (p[1] === "s") { cur = k; t0[k] = +p[2]; steps[k].started = true; }
        else { steps[k].done = true; steps[k].ms = (+p[2] - t0[k]) * 1000; cur = -1; }
      } else if (cur >= 0) steps[cur].out += line + "\n";
    });
    steps.forEach(function (s) { s.out = s.out.replace(/\n+$/, ""); });
    return steps;
  }

  // one editor's text → the steps' code, cut at the "# ── n · title" lines
  function cut(text, n) {
    var parts = [], cur = null;
    text.split("\n").forEach(function (line) {
      var m = CUT.exec(line);
      if (m) { cur = []; parts.push(cur); } else if (cur) cur.push(line);
    });
    if (parts.length !== n) return null;
    return parts.map(function (p) { return p.join("\n").replace(/^\n+|\s+$/g, ""); });
  }

  function mount(pl) {
    var title = pl.getAttribute("data-title") || "Pipeline";
    var steps = [].slice.call(pl.querySelectorAll(":scope > .step")).map(function (s) {
      var src = s.querySelector("script[type='text/plain']");
      return { icon: s.getAttribute("data-icon") || "•", title: s.getAttribute("data-title") || "Step",
               desc: s.getAttribute("data-desc") || "", code: dedent(src ? src.textContent : "") };
    });
    var alt = pl.querySelector(":scope > .playground");
    if (alt) alt.parentNode.removeChild(alt);
    var altName = alt ? (pl.getAttribute("data-alt") || "＋ The same in a framework") : "";

    pl.innerHTML =
      '<div class="pl-head"><div class="pl-title">' + esc(title) + "</div>" +
      '<div class="pl-tabs"><button class="on" data-v="xray">X-ray</button><button data-v="code">Code</button>' +
      (alt ? '<button data-v="alt">' + esc(altName) + "</button>" : "") + "</div>" +
      '<div class="pl-ctl"><button class="step-btn" title="One step at a time">Step</button>' +
      '<button class="run" title="Run the whole pipeline">▶ Run</button></div></div>' +
      '<div class="pl-view xray"><div class="pl-flow"></div><div class="pl-focus"><div class="f-head"></div><pre class="f-out"></pre></div></div>' +
      '<div class="pl-view code" hidden><div class="pl-ed"></div></div>' +
      (alt ? '<div class="pl-view alt" hidden></div>' : "");
    if (alt) pl.querySelector(".pl-view.alt").appendChild(alt);

    var flow = pl.querySelector(".pl-flow");
    var fHead = pl.querySelector(".f-head"), fOut = pl.querySelector(".f-out"), focus = pl.querySelector(".pl-focus");
    var runBtn = pl.querySelector(".run"), stepBtn = pl.querySelector(".step-btn");
    var ctl = pl.querySelector(".pl-ctl");
    var result = null, shown = -1, busy = false, picked = -1, cm = null;

    var tiles = steps.map(function (s, i) {
      if (i) {
        var a = document.createElement("div");
        a.className = "t-arrow";
        a.textContent = "→";
        flow.appendChild(a);
      }
      var t = document.createElement("button");
      t.type = "button";
      t.className = "tile";
      t.innerHTML = '<span class="t-n">' + (i + 1) + '</span><span class="t-icon">' + s.icon + "</span>" +
        '<span class="t-title">' + esc(s.title) + '</span><span class="t-desc">' + esc(s.desc) + "</span>" +
        '<span class="t-out"></span><span class="t-stat"></span>';
      t.onclick = function () { pick(i); };
      flow.appendChild(t);
      return t;
    });
    var arrows = [].slice.call(flow.querySelectorAll(".t-arrow"));

    // ── tabs ─────────────────────────────────────────────────────────
    function codeText() {
      return steps.map(function (s, i) {
        var head = "# ── " + (i + 1) + " · " + s.title + " ";
        return head + new Array(Math.max(4, 60 - head.length)).join("─") + "\n" + s.code;
      }).join("\n\n");
    }
    pl.querySelectorAll(".pl-tabs button").forEach(function (b) {
      b.onclick = function () {
        var v = b.getAttribute("data-v");
        pl.querySelectorAll(".pl-tabs button").forEach(function (x) { x.classList.toggle("on", x === b); });
        pl.querySelectorAll(".pl-view").forEach(function (x) { x.hidden = !x.classList.contains(v); });
        ctl.hidden = v === "alt";                          // the agent-world block has its own ▶ Run
        if (v === "code" && !cm && window.CodeMirror) {
          cm = window.CodeMirror(pl.querySelector(".pl-ed"), { value: codeText(), mode: "python", theme: "seminar",
            lineNumbers: true, indentUnit: 4, viewportMargin: Infinity });
          cm.on("change", function () { result = null; });
        }
        pl.querySelectorAll(".pl-view:not([hidden]) .CodeMirror").forEach(function (e) { e.CodeMirror && e.CodeMirror.refresh(); });
      };
    });

    // ── focus: one step's whole output ───────────────────────────────
    function pick(i) {
      picked = i;
      tiles.forEach(function (t, k) { t.classList.toggle("picked", k === i); });
      var st = result && result.steps[i];
      fHead.innerHTML = "<b>" + (i + 1) + " · " + esc(steps[i].title) + "</b><span>" + esc(steps[i].desc) + "</span>";
      var out = st ? [st.out, result.failAt === i ? result.err : ""].filter(Boolean).join("\n") : "";
      fOut.textContent = st && (st.started || st.done || result.failAt === i) ? (out || "(no output)") : "Not run yet: press ▶ Run or Step.";
      focus.classList.add("on");
    }

    function codes() {
      if (cm) return cut(cm.getValue(), steps.length);     // null: the "# ── n ·" lines were edited away
      return steps.map(function (s) { return s.code; });
    }
    function fetchRun() {
      if (result) return Promise.resolve(result);
      var c = codes();
      if (!c) {
        result = { res: { exit: 1, stderr: "Keep one \"# ── n · title\" line before each step in the Code tab." },
                   steps: steps.map(function () { return { out: "", started: false, done: false }; }) };
        return Promise.resolve(result);
      }
      return fetch(ROOT + "/api/run", { method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ code: program(c), mode: mode(), page: document.body.getAttribute("data-page") }) })
        .then(function (r) { return r.json(); })
        .then(function (res) { result = { res: res, steps: split(res.stdout || "", steps.length) }; return result; })
        .catch(function () {
          result = { res: { exit: 1, stderr: "No runner answered. Start it:\n    uv run python -m runner.server" },
                     steps: steps.map(function () { return { out: "", started: false, done: false }; }) };
          return result;
        });
    }
    function reset() {
      shown = -1;
      tiles.forEach(function (t) {
        t.classList.remove("run", "done", "fail", "dim");
        t.querySelector(".t-stat").textContent = ""; t.querySelector(".t-out").textContent = "";
      });
      arrows.forEach(function (a) { a.classList.remove("done"); });
      if (picked >= 0) pick(picked);
    }
    function reveal(i) {
      var st = result.steps[i], t = tiles[i], stat = t.querySelector(".t-stat");
      var lines = (st.out || "").split("\n").filter(Boolean);
      t.querySelector(".t-out").textContent = lines.slice(-3).join("\n");
      if (st.done) {
        t.classList.add("done");
        stat.textContent = "✓ " + (st.ms < 1 ? "<1" : Math.round(st.ms)) + " ms";
        if (arrows[i]) arrows[i].classList.add("done");
        pick(i);
      } else if (st.started || i === 0) {
        t.classList.add("fail");
        stat.textContent = "✗ failed";
        var err = (result.res.stderr || "").trim().split("\n").slice(-6).join("\n");
        result.failAt = i; result.err = err;
        t.querySelector(".t-out").textContent = err.split("\n").pop();
        for (var k = i + 1; k < tiles.length; k++) tiles[k].classList.add("dim");
        pick(i);
        return false;
      }
      return true;
    }
    function light(i) {
      tiles[i].classList.add("run");
      var ms = result.steps[i].ms;
      return sleep(Math.max(380, Math.min(1400, ms || 0))).then(function () {
        tiles[i].classList.remove("run");
        return reveal(i);
      });
    }
    function lock(on, label) { busy = on; runBtn.disabled = stepBtn.disabled = on; runBtn.textContent = label || "▶ Run"; }
    function toXray() { pl.querySelector('.pl-tabs button[data-v="xray"]').click(); }

    runBtn.onclick = function () {
      if (busy) return;
      toXray(); reset(); lock(true, "Running…");
      tiles[0].classList.add("run");
      fetchRun().then(function () {
        tiles[0].classList.remove("run");
        var p = Promise.resolve(true);
        steps.forEach(function (_, i) { p = p.then(function (ok) { if (ok) { shown = i; return light(i); } return false; }); });
        return p;
      }).then(function () { lock(false); });
    };
    stepBtn.onclick = function () {
      if (busy) return;
      toXray();
      if (shown >= steps.length - 1 || !result) reset();
      lock(true, "▶ Run");
      fetchRun().then(function () {
        shown++;
        return light(shown);
      }).then(function () { lock(false); });
    };
  }

  document.querySelectorAll(".pipeline").forEach(mount);
})();
