// ---------------------------------------------------------------------------
// Page: one crank angle drives both engines, the cards and the timeline.
// ---------------------------------------------------------------------------
const SPEED = 30; // crank degrees per second: one full cycle in 24 s
const ASM = {
  sv: [
    ["crank", "Crankshaft", "<b>Crankshaft.</b> One crankpin carries both rods. The near web is cut away so you can see both big ends on the one pin. The crank is drawn turning forward, the same way as the wheels."],
    ["rod", "Con-rods", "<b>Connecting rods.</b> Both rods share the pin side by side, so the two cylinders sit slightly offset across the engine. Rod length is idealized at 130 mm. It sets the shape of the piston-travel curve between the dead centres, but not the 62.6 mm stroke."],
    ["piston", "Pistons & rings", "<b>Pistons and rings.</b> The bore is 81 mm. Each piston carries two compression rings and an oil-control ring. Suzuki tins and resin-coats the piston skirts on the 2016-on engine."],
    ["cyl", "Cylinders & coolant", "<b>Cylinders and coolant jacket.</b> Each cylinder is cut through its own axis, 90° apart. The blue-grey slots either side of each bore are the water jacket of this liquid-cooled engine. Jacket shape is idealized."],
    ["head", "Heads & chambers", "<b>Cylinder heads.</b> Each head has a pent-roof chamber, with the intake port toward the V and the exhaust port facing out. The chamber glows briefly as each cylinder starts its power stroke. Port shapes are idealized, and the Dual Spark plugs (two per cylinder) are left out."],
    ["valve", "Valvetrain", "<b>Valvetrain.</b> DOHC, four valves per cylinder. The section shows the near intake and exhaust valve of each cylinder, each closed by a coil spring and pushed open by its cam through a bucket. The cams turn at half crank speed. Lobe shapes and timing are idealized."],
    ["case", "Crankcase", "<b>Crankcase.</b> This is the far case half, cut behind the crank, with case bolts shown in section and the main bearing boss."],
  ],
  cbr: [
    ["crank", "Crankshaft", "<b>Crankshaft.</b> The throws for cylinders 1 and 4 share one angle, and 2 and 3 sit 180° opposite, so the pistons move in pairs. The five main journals are an idealized drawing."],
    ["rod", "Con-rods", "<b>Connecting rods.</b> One rod per throw, its cap held by two bolts. Rod length is idealized at 98 mm. It shapes the travel curve between the dead centres, but not the 46 mm stroke."],
    ["piston", "Pistons & rings", "<b>Pistons and rings.</b> 67 mm bore against a 46 mm stroke: a short-stroke engine built to rev. Each piston carries two compression rings and an oil-control ring."],
    ["cyl", "Block & coolant", "<b>Cylinder block.</b> The four bores are cut along the plane of their axes, which Honda cants forward 30°. Coolant jacket shape is idealized."],
    ["head", "Head & chambers", "<b>Cylinder head.</b> The head has four chambers, the plug wells (spark plugs left out) and coolant passages. The intake half of the head lies behind the cut, with its cam holders and bolts on the deck."],
    ["valve", "Valvetrain", "<b>Valvetrain.</b> Two overhead camshafts span all four cylinders, sixteen valves in total. The exhaust cam and its eight valves stand in front of the cut. Behind it, the intake cam drives eight buckets on the deck, and the intake valve heads show in the chambers. Honda describes direct cam actuation. Lobe shapes and timing are idealized."],
    ["case", "Crankcase", "<b>Crankcase.</b> This is the far half, cut behind the crank, showing the main-bearing webs with their cap bolts in section. The web layout is idealized."],
  ],
};

const ENG = {};
const state = { theta: 0, playing: false, view: "both" };
const reduce = matchMedia("(prefers-reduced-motion: reduce)");

function mount(key) {
  const M = key === "sv" ? svModel() : cbrModel();
  const D = key === "sv" ? svDrawing(M) : cbrDrawing(M);
  const root = document.querySelector(`.engine[data-engine="${key}"]`);
  const stage = root.querySelector(".stage");
  const svg = stage.querySelector("svg");
  // fit the view box over every pose of the cycle
  D.E.bb = [Infinity, Infinity, -Infinity, -Infinity];
  const statics = D.layers.map((l) => (l.stat ? l.stat() : ""));
  for (let t = 0; t < 720; t += 15) { const S2 = M.state(t); D.layers.forEach((l) => l.dyn && l.dyn(t, S2)); }
  const [x0, y0, x1, y1] = D.E.bb;
  D.E.bb = null;
  const pad = 8;
  svg.setAttribute("viewBox", `${r1(x0 - pad)} ${r1(y0 - pad)} ${r1(x1 - x0 + 2 * pad)} ${r1(y1 - y0 + 2 * pad)}`);
  const groups = D.layers.map((l, i) => {
    const g = document.createElementNS("http://www.w3.org/2000/svg", "g");
    if (l.stat) g.innerHTML = statics[i];
    svg.appendChild(g);
    return g;
  });
  const flashes = [...svg.querySelectorAll("[data-flash]")];
  const E = { key, M, D, root, stage, svg, groups, flashes, onscreen: true, drawn: null };
  ENG[key] = E;
  buildCards(E);
  buildChips(E);
  new IntersectionObserver((entries) => {
    E.onscreen = entries[entries.length - 1].isIntersecting;
    if (E.onscreen) { draw(); kick(); }
  }, { rootMargin: "80px 0px" }).observe(stage);
}

function shown(E) { return state.view === "both" || state.view === E.key; }

function drawEngine(E, theta) {
  const S2 = E.M.state(theta);
  if (E.onscreen && shown(E) && E.drawn !== theta) {
    E.D.layers.forEach((l, i) => { if (l.dyn) E.groups[i].innerHTML = l.dyn(theta, S2); });
    for (const el of E.flashes) {
      const st = S2.find((s) => s.c.key === el.dataset.flash);
      const glow = st.local < 70 ? Math.pow(1 - st.local / 70, 1.6) * 0.85 : 0;
      el.setAttribute("opacity", glow.toFixed(3));
    }
    E.drawn = theta;
  }
  updateCards(E, S2);
  return S2;
}

function buildCards(E) {
  const wrap = E.root.querySelector(".cyls");
  const list = E.key === "cbr" ? E.M.cyls.slice().sort((a, b) => a.n - b.n) : E.M.cyls;
  wrap.dataset.n = list.length;
  for (const c of list) {
    const el = document.createElement(E.key === "cbr" ? "button" : "div");
    el.className = "cyl-card";
    el.dataset.cyl = c.key;
    if (E.key === "cbr") { el.type = "button"; el.setAttribute("aria-label", `Cylinder ${c.n}: jump to its firing angle, ${c.fire}°`); el.addEventListener("click", () => { pause(); setTheta(c.fire); announce(`Crank set to ${c.fire}°: cylinder ${c.n} at top dead centre, starting its power stroke.`); }); }
    el.innerHTML = `<span class="top"><span>${E.key === "cbr" ? "Cylinder " + c.n : c.label + " cyl"}</span><span>fires ${c.fire}°</span></span><span class="ph"></span><span class="bar"><i></i></span><span class="num"></span><span class="vlv"></span>`;
    wrap.appendChild(el);
    c.card = { el, ph: el.querySelector(".ph"), bar: el.querySelector(".bar i"), num: el.querySelector(".num"), vlv: el.querySelector(".vlv") };
  }
}

function updateCards(E, S2) {
  for (const st of S2) {
    const k = st.c.card;
    const name = PHASES[st.phase.index];
    if (k.ph.textContent !== name) k.ph.textContent = name;
    k.el.dataset.phase = st.phase.index;
    k.bar.style.width = (st.phase.share * 100).toFixed(1) + "%";
    k.num.textContent = `${st.travel.toFixed(1)} mm below TDC`;
    const v = [];
    if (st.lin > 0.05) v.push(`IN ${st.lin.toFixed(1)}`);
    if (st.lex > 0.05) v.push(`EX ${st.lex.toFixed(1)}`);
    k.vlv.textContent = v.length ? `valve lift ${v.join(" · ")} mm` : "valves closed";
  }
}

function buildChips(E) {
  const chips = E.root.querySelector(".chips");
  const out = E.root.querySelector(".explain");
  const list = ASM[E.key];
  const all = document.createElement("button");
  all.type = "button"; all.textContent = "Whole engine"; all.setAttribute("aria-pressed", "true");
  chips.appendChild(all);
  const buttons = [all];
  const intro = out.innerHTML;
  const pick = (k, html, btn) => {
    for (const b of buttons) b.setAttribute("aria-pressed", String(b === btn));
    if (k) E.stage.dataset.sel = k; else delete E.stage.dataset.sel;
    out.innerHTML = html;
  };
  all.addEventListener("click", () => pick(null, intro, all));
  for (const [k, label, html] of list) {
    const b = document.createElement("button");
    b.type = "button"; b.textContent = label; b.setAttribute("aria-pressed", "false");
    b.addEventListener("click", () => (b.getAttribute("aria-pressed") === "true" ? pick(null, intro, all) : pick(k, html, b)));
    chips.appendChild(b); buttons.push(b);
  }
}

// selection styling for every assembly key
(() => {
  const keys = ["crank", "rod", "piston", "cyl", "head", "valve", "case"];
  const css = keys.map((k) =>
    `.stage[data-sel="${k}"] [data-asm]:not([data-asm~="${k}"]){opacity:.2}` +
    `.stage[data-sel="${k}"] [data-asm~="${k}"] .e,.stage[data-sel="${k}"] path.e[data-asm~="${k}"]{stroke:var(--lit);stroke-width:1.05px}` +
    `.stage[data-sel="${k}"] [data-asm~="${k}"] .coil-o{stroke:var(--lit)}`).join("");
  const st = document.createElement("style"); st.textContent = css; document.head.appendChild(st);
})();

// ----- firing timeline -----
const TL = { x0: 104, x1: 748 };
const tx = (deg) => TL.x0 + (deg / 720) * (TL.x1 - TL.x0);
function buildTimeline() {
  const svg = document.querySelector(".tl svg");
  const lanes = [
    { group: "SUZUKI SV650 · 90° V-TWIN", y: 22 },
    { label: "Front", fire: 0, y: 32 },
    { label: "Rear", fire: 270, y: 52 },
    { gaps: [[0, 270, "270°  front → rear"], [270, 720, "450°  rear → front"]], y: 82 },
    { group: "HONDA CBR650R · INLINE-FOUR", y: 116 },
    { label: "Cyl 1", fire: 0, y: 126 },
    { label: "Cyl 2", fire: 180, y: 146 },
    { label: "Cyl 3", fire: 540, y: 166 },
    { label: "Cyl 4", fire: 360, y: 186 },
    { gaps: [[0, 180, "180°  1→2"], [180, 360, "180°  2→4"], [360, 540, "180°  4→3"], [540, 720, "180°  3→1"]], y: 216 },
  ];
  const H = 14;
  let s = "";
  for (let d = 0; d <= 720; d += 90) {
    s += `<line class="grid" x1="${tx(d)}" x2="${tx(d)}" y1="12" y2="226"/>`;
    s += `<text class="axis" x="${tx(d)}" y="244" text-anchor="middle">${d}°</text>`;
  }
  const cls = ["seg-p", "seg-e", "seg-i", "seg-c"], words = ["power", "exhaust", "intake", "compression"];
  for (const l of lanes) {
    if (l.group) { s += `<text class="group-label" x="0" y="${l.y}">${l.group}</text>`; continue; }
    if (l.gaps) {
      for (const [a, b, t] of l.gaps) {
        const ya = l.y - 8;
        s += `<path class="gapline" d="M${tx(a) + 2} ${ya - 4}V${ya}H${tx(b) - 2}V${ya - 4}"/>`;
        s += `<text class="gap" x="${(tx(a) + tx(b)) / 2}" y="${l.y + 5}" text-anchor="middle">${t}</text>`;
      }
      continue;
    }
    s += `<text class="lane-label" x="0" y="${l.y + 11}">${l.label}</text>`;
    for (let p = 0; p < 4; p++) {
      const a = (l.fire + p * 180) % 720, b = a + 180;
      const pieces = b <= 720 ? [[a, b]] : [[a, 720], [0, b - 720]];
      pieces.forEach(([pa, pb], i) => {
        const w = tx(pb) - tx(pa);
        s += `<rect class="${cls[p]}" x="${(tx(pa) + 1).toFixed(1)}" y="${l.y}" width="${Math.max(0, w - 2).toFixed(1)}" height="${H}" rx="2"><title>${l.label}: ${words[p]}, ${(l.fire + p * 180) % 720}° to ${(l.fire + p * 180 + 180) % 720 || 720}°</title></rect>`;
        if (w > 60 && (pieces.length === 1 || pb - pa >= 90)) s += `<text class="seg-t ${p === 0 ? "on-dark" : "on-light"}" data-p="${p}" x="${tx(pa) + 6}" y="${l.y + 10.5}">${words[p]}</text>`;
      });
    }
    s += `<path class="fire" d="M${tx(l.fire)} ${l.y - 3}l4 4-4 4-4-4z"><title>${l.label} fires at ${l.fire}°</title></path>`;
    if (l.fire === 0) s += `<path class="fire" d="M${tx(720)} ${l.y - 3}l4 4-4 4-4-4z"/>`;
  }
  s += `<g class="cur"><line class="cursor" x1="0" x2="0" y1="10" y2="228"/><path class="cursor-cap" d="M-5 4h10l-5 6z"/></g>`;
  svg.innerHTML = s;
  const cur = svg.querySelector(".cur");
  TL.cur = cur;
  const toTheta = (ev) => {
    const box = svg.getBoundingClientRect();
    const x = (ev.clientX - box.left) / box.width * 780;
    return Math.max(0, Math.min(719, ((x - TL.x0) / (TL.x1 - TL.x0)) * 720));
  };
  let dragging = false;
  svg.addEventListener("pointerdown", (ev) => { dragging = true; svg.setPointerCapture(ev.pointerId); pause(); setTheta(Math.round(toTheta(ev))); });
  svg.addEventListener("pointermove", (ev) => { if (dragging) setTheta(Math.round(toTheta(ev))); });
  svg.addEventListener("pointerup", () => { dragging = false; });
  svg.addEventListener("pointercancel", () => { dragging = false; });
}

// ----- controls -----
const crankInput = document.getElementById("crank");
const out = document.getElementById("crank-out");
const play = document.getElementById("play");
const live = document.getElementById("live");
let raf = 0, last = 0, announceTimer = 0;

function announce(text) { clearTimeout(announceTimer); announceTimer = setTimeout(() => { live.textContent = text; }, 60); }

function describe() {
  const parts = [];
  for (const k of ["sv", "cbr"]) {
    const E = ENG[k]; if (!E || !shown(E)) continue;
    const S2 = E.M.state(state.theta);
    const firing = S2.filter((s) => s.phase.index === 0).map((s) => (k === "sv" ? s.c.label.toLowerCase() : "cylinder " + s.c.n));
    parts.push(`${k === "sv" ? "SV650" : "CBR650R"} power stroke: ${firing.join(" and ") || "none"}`);
  }
  return `${Math.round(state.theta)}° crank angle. ${parts.join(". ")}.`;
}

function draw() {
  const t = state.theta;
  for (const k in ENG) {
    const E = ENG[k];
    const S2 = drawEngine(E, t);
    const pw = S2.filter((s) => s.phase.index === 0);
    const ro = E.root.querySelector(".corner.readout");
    const txt = `θ ${String(Math.round(t)).padStart(3, " ")}° · power: ${pw.length ? pw.map((s) => (k === "sv" ? s.c.label.toLowerCase() : "#" + s.c.n)).join(", ") : "none"}`;
    if (ro.textContent !== txt) ro.textContent = txt;
  }
  if (TL.cur) TL.cur.setAttribute("transform", `translate(${tx(t).toFixed(2)} 0)`);
  const v = Math.round(t) % 720;
  if (String(crankInput.value) !== String(v)) crankInput.value = v;
  out.textContent = `${v}°`;
  crankInput.setAttribute("aria-valuetext", describe());
}

function setTheta(t) { state.theta = ((t % 720) + 720) % 720; draw(); }

function anyVisible() { return Object.values(ENG).some((E) => E.onscreen && shown(E)); }
function tick(now) {
  raf = 0;
  if (!state.playing) return;
  if (!anyVisible() || document.hidden) { last = 0; return; }
  const dt = last ? Math.min(0.1, (now - last) / 1000) : 0;
  last = now;
  setTheta(state.theta + SPEED * dt);
  raf = requestAnimationFrame(tick);
}
function kick() { if (state.playing && !raf) { last = 0; raf = requestAnimationFrame(tick); } }
function setPlaying(on) {
  state.playing = on;
  play.setAttribute("aria-pressed", String(on));
  play.querySelector(".lbl").textContent = on ? "Pause" : "Play";
  play.querySelector(".ico").innerHTML = on ? '<path d="M1 0h3v10H1zM6 0h3v10H6z"/>' : '<path d="M1 0l9 5-9 5z"/>';
  if (on) kick(); else { cancelAnimationFrame(raf); raf = 0; }
}
function pause() { if (state.playing) setPlaying(false); }

play.addEventListener("click", () => setPlaying(!state.playing));
crankInput.addEventListener("input", () => { pause(); setTheta(Number(crankInput.value)); });
document.addEventListener("visibilitychange", () => { if (!document.hidden) kick(); });

for (const b of document.querySelectorAll("[data-view-btn]")) {
  b.addEventListener("click", () => {
    state.view = b.dataset.viewBtn;
    for (const o of document.querySelectorAll("[data-view-btn]")) o.setAttribute("aria-pressed", String(o === b));
    document.querySelector(".engines").dataset.view = state.view;
    for (const k in ENG) ENG[k].drawn = null;
    draw();
    kick();
  });
}

mount("sv");
mount("cbr");
buildTimeline();
setTheta(0);
setPlaying(!reduce.matches);
reduce.addEventListener("change", () => { if (reduce.matches) pause(); });
