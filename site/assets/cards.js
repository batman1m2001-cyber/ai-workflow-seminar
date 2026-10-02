/* Pipeline cards: a program shown as the steps it is.
 *
 *   <div class="pipeline" data-title="...">
 *     <div class="step" data-icon="✎" data-title="Prompt" data-desc="One line.">
 *       <script type="text/plain"> python for this step </script>
 *     </div>
 *     ...
 *   </div>
 *
 * The steps are one Python program, cut into pieces. ▶ Run sends the whole
 * program to the local runner once, with a marker printed around each piece,
 * then lights the cards in order: each card gets its own output and timing,
 * and the arrow below it shows what it handed on (its first output line).
 * Step reveals one card per press. Editing a card's code re-runs from scratch.
 */
(function () {
  "use strict";

  var ROOT = document.body.getAttribute("data-root") || ".";
  var MARK = "\u001e";

  function esc(s) { return String(s).replace(/[&<>]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]; }); }
  function mode() { try { return localStorage.getItem("seminar.mode") || "mock"; } catch (e) { return "mock"; } }
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

  function mount(pl) {
    var title = pl.getAttribute("data-title") || "Pipeline";
    var steps = [].slice.call(pl.querySelectorAll(":scope > .step")).map(function (s) {
      var src = s.querySelector("script[type='text/plain']");
      return { icon: s.getAttribute("data-icon") || "•", title: s.getAttribute("data-title") || "Step",
               desc: s.getAttribute("data-desc") || "", code: dedent(src ? src.textContent : "") };
    });

    pl.innerHTML =
      '<div class="pl-head"><div class="pl-title">' + esc(title) + '</div>' +
      '<div class="pl-map">' + steps.map(function (s, i) {
        return (i ? '<span class="arr">→</span>' : "") + '<span class="chip" data-i="' + i + '">' + esc(s.title) + "</span>";
      }).join("") + "</div>" +
      '<div class="pl-ctl"><button class="step-btn" title="One card at a time">Step</button>' +
      '<button class="run" title="Run the whole pipeline">▶ Run</button></div></div>' +
      '<div class="pl-cards"></div><div class="pl-err"></div>';

    var list = pl.querySelector(".pl-cards"), errBox = pl.querySelector(".pl-err");
    var cards = steps.map(function (s, i) {
      var c = document.createElement("div");
      c.className = "pcard";
      c.innerHTML =
        '<div class="c-head"><span class="c-icon">' + s.icon + '</span>' +
        '<div class="c-txt"><div class="c-title">' + esc(s.title) + '</div><div class="c-desc">' + esc(s.desc) + "</div></div>" +
        '<span class="c-stat"></span><span class="c-tog" title="Code">{ }</span></div>' +
        '<div class="c-body"><div class="c-tabs"><button class="on" data-t="code">Code</button><button data-t="out">Output</button></div>' +
        '<div class="c-pane code"></div><pre class="c-pane out"></pre></div>';
      list.appendChild(c);
      if (i < steps.length - 1) {
        var a = document.createElement("div");
        a.className = "c-link";
        a.innerHTML = '<span class="line"></span><span class="carry"></span>';
        list.appendChild(a);
      }
      var pane = c.querySelector(".c-pane.code");
      pane.innerHTML = "<pre>" + esc(s.code) + "</pre>";
      // the editor is built on first open: CodeMirror measures nothing while hidden
      c.querySelector(".c-head").onclick = function () {
        c.classList.toggle("open");
        if (!s.cm && window.CodeMirror) {
          pane.innerHTML = "";
          s.cm = window.CodeMirror(pane, { value: s.code, mode: "python", theme: "seminar", lineNumbers: true,
            indentUnit: 4, viewportMargin: Infinity });
          s.cm.on("change", function () { result = null; });
        }
      };
      c.querySelectorAll(".c-tabs button").forEach(function (b) {
        b.onclick = function (e) {
          e.stopPropagation();
          c.querySelectorAll(".c-tabs button").forEach(function (x) { x.classList.toggle("on", x === b); });
          c.classList.toggle("show-out", b.getAttribute("data-t") === "out");
          if (s.cm) s.cm.refresh();
        };
      });
      return c;
    });
    var links = [].slice.call(list.querySelectorAll(".c-link"));
    var chips = [].slice.call(pl.querySelectorAll(".pl-map .chip"));
    var runBtn = pl.querySelector(".run"), stepBtn = pl.querySelector(".step-btn");
    var result = null, shown = -1, busy = false;

    function codes() { return steps.map(function (s) { return s.cm ? s.cm.getValue() : s.code; }); }
    function fetchRun() {
      if (result) return Promise.resolve(result);
      return fetch(ROOT + "/api/run", { method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ code: program(codes()), mode: mode(), page: document.body.getAttribute("data-page") }) })
        .then(function (r) { return r.json(); })
        .then(function (res) { result = { res: res, steps: split(res.stdout || "", steps.length) }; return result; })
        .catch(function () {
          result = { res: { exit: 1, stderr: "No runner answered. Start it:\n    uv run python -m runner.server" },
                     steps: steps.map(function () { return { out: "", started: false, done: false }; }) };
          return result;
        });
    }
    function reset() {
      shown = -1; errBox.textContent = ""; errBox.classList.remove("on");
      cards.forEach(function (c) { c.className = c.className.replace(/ ?(run|done|fail|dim)\b/g, ""); c.querySelector(".c-stat").textContent = ""; });
      links.forEach(function (l) { l.classList.remove("done"); l.querySelector(".carry").textContent = ""; });
      chips.forEach(function (c) { c.className = "chip"; });
    }
    function reveal(i) {
      var st = result.steps[i], c = cards[i], stat = c.querySelector(".c-stat");
      c.querySelector(".c-pane.out").textContent = st.out || "(no output)";
      if (st.done) {
        c.classList.add("done"); chips[i].classList.add("done");
        stat.textContent = "✓ " + (st.ms < 1 ? "<1" : Math.round(st.ms)) + " ms";
        if (links[i]) {
          links[i].classList.add("done");
          var first = (st.out.split("\n").filter(Boolean).pop() || "");
          links[i].querySelector(".carry").textContent = first.length > 90 ? first.slice(0, 88) + "…" : first;
        }
      } else if (st.started || (i === 0 && !st.started)) {
        c.classList.add("fail"); chips[i].classList.add("fail");
        stat.textContent = "✗ failed";
        var err = (result.res.stderr || "").trim().split("\n").slice(-6).join("\n");
        c.querySelector(".c-pane.out").textContent = (st.out ? st.out + "\n" : "") + err;
        errBox.textContent = err; errBox.classList.add("on");
        for (var k = i + 1; k < cards.length; k++) cards[k].classList.add("dim");
        return false;
      }
      return true;
    }
    function light(i) {
      cards[i].classList.add("run"); chips[i].classList.add("run");
      var ms = result.steps[i].ms;
      return sleep(Math.max(380, Math.min(1400, ms || 0))).then(function () {
        cards[i].classList.remove("run"); chips[i].classList.remove("run");
        return reveal(i);
      });
    }
    function lock(on, label) { busy = on; runBtn.disabled = stepBtn.disabled = on; runBtn.textContent = label || "▶ Run"; }

    runBtn.onclick = function () {
      if (busy) return;
      reset(); lock(true, "Running…");
      cards[0].classList.add("run"); chips[0].classList.add("run");
      fetchRun().then(function () {
        cards[0].classList.remove("run"); chips[0].classList.remove("run");
        var p = Promise.resolve(true);
        steps.forEach(function (_, i) { p = p.then(function (ok) { if (ok) { shown = i; return light(i); } return false; }); });
        return p;
      }).then(function () { lock(false); });
    };
    stepBtn.onclick = function () {
      if (busy) return;
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
