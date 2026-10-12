// ---------------------------------------------------------------------------
// Oblique solid renderer. World units are millimetres: x and y on the floor,
// z up, y running away from the viewer. A cabinet-style oblique projection
// keeps the front plane true to shape, so strokes, rods and crank throws drawn
// in it keep their real proportions on screen.
// ---------------------------------------------------------------------------
const D2R = Math.PI / 180;
const add = (...v) => v.reduce((a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]]);
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const mul = (a, k) => [a[0] * k, a[1] * k, a[2] * k];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norm = (a) => mul(a, 1 / Math.hypot(a[0], a[1], a[2]));
const r1 = (n) => Math.round(n * 10) / 10;
const lerp = (a, b, t) => a + (b - a) * t;

function P2(pts, close) {
  let s = "";
  for (let i = 0; i < pts.length; i++) s += (i ? "L" : "M") + r1(pts[i][0]) + " " + r1(pts[i][1]);
  return close ? s + "Z" : s;
}

function hull(pts) {
  const p = pts.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const cr = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lo = [], up = [];
  for (const q of p) { while (lo.length >= 2 && cr(lo[lo.length - 2], lo[lo.length - 1], q) <= 0) lo.pop(); lo.push(q); }
  for (let i = p.length - 1; i >= 0; i--) { const q = p[i]; while (up.length >= 2 && cr(up[up.length - 2], up[up.length - 1], q) <= 0) up.pop(); up.push(q); }
  up.pop(); lo.pop();
  return lo.concat(up);
}

const area2 = (poly) => {
  let s = 0;
  for (let i = 0; i < poly.length; i++) { const a = poly[i], b = poly[(i + 1) % poly.length]; s += a[0] * b[1] - b[0] * a[1]; }
  return s / 2;
};

// 2D helpers for profiles
const circ2 = (cx, cy, r, n = 24, a0 = 0, a1 = 360) => {
  const out = [];
  const full = Math.abs(a1 - a0) >= 360;
  const count = full ? n : n + 1;
  for (let i = 0; i < count; i++) { const t = (a0 + (a1 - a0) * i / n) * D2R; out.push([cx + r * Math.cos(t), cy + r * Math.sin(t)]); }
  return out;
};
const rot2 = ([x, y], deg) => { const c = Math.cos(deg * D2R), s = Math.sin(deg * D2R); return [x * c - y * s, x * s + y * c]; };
const rect2 = (x0, y0, x1, y1) => [[x0, y0], [x1, y0], [x1, y1], [x0, y1]];
const rrect2 = (x0, y0, x1, y1, r, n = 5) => {
  const out = [];
  const cs = [[x1 - r, y0 + r, -90], [x1 - r, y1 - r, 0], [x0 + r, y1 - r, 90], [x0 + r, y0 + r, 180]];
  for (const [cx, cy, a] of cs) for (let i = 0; i <= n; i++) { const t = (a + 90 * i / n) * D2R; out.push([cx + r * Math.cos(t), cy + r * Math.sin(t)]); }
  return out;
};

function camera(deg, k) {
  const cx = k * Math.cos(deg * D2R), cy = k * Math.sin(deg * D2R);
  const V = norm([cx, -1, cy]);
  const L = norm([-0.42, -0.62, 0.66]);
  const E = { cx, cy, V, L, bb: null };
  E.p = (q) => {
    const s = [q[0] + q[1] * cx, -(q[2] + q[1] * cy)];
    if (E.bb) { const b = E.bb; if (s[0] < b[0]) b[0] = s[0]; if (s[1] < b[1]) b[1] = s[1]; if (s[0] > b[2]) b[2] = s[0]; if (s[1] > b[3]) b[3] = s[1]; }
    return s;
  };
  E.dk = (q) => dot(q, V);
  E.lv = (n) => Math.max(0, Math.min(6, Math.round((dot(n, L) + 0.32) / 1.3 * 6)));
  E.vis = (n) => dot(n, V) > 1e-4;
  return E;
}

function basis(a) {
  const t = Math.abs(a[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0];
  const e1 = norm(cross(a, t));
  const e2 = cross(a, e1);
  return [e1, e2];
}

const attrs = (o) => (o.asm ? ` data-asm="${o.asm}"` : "") + (o.cls ? ` class="${o.cls}"` : "");

// Prism: a 2D profile in the (u, v) plane at o, extruded along ax from s0 to s1.
function prism(E, o, u, v, ax, poly, s0, s1, opt = {}) {
  if (area2(poly) < 0) poly = poly.slice().reverse();
  const n = poly.length;
  const W = (s, q) => add(o, mul(u, q[0]), mul(v, q[1]), mul(ax, s));
  const A3 = poly.map((q) => W(s0, q)), B3 = poly.map((q) => W(s1, q));
  const A = A3.map(E.p), B = B3.map(E.p);
  const vis = new Array(n), byLevel = {};
  for (let j = 0; j < n; j++) {
    const k = (j + 1) % n;
    const [x0, y0] = poly[j], [x1, y1] = poly[k];
    const nr = norm(add(mul(u, y1 - y0), mul(v, -(x1 - x0))));
    vis[j] = E.vis(nr);
    if (vis[j]) { const L = E.lv(nr); (byLevel[L] ||= []).push(P2([A[j], A[k], B[k], B[j]], 1)); }
  }
  let out = "";
  for (const L in byLevel) out += `<path class="f m${L}" d="${byLevel[L].join("")}"/>`;
  const ca = dot(ax, E.V);
  let cap = null, capN = null, cap3 = null;
  if (ca > 1e-4) { cap = B; cap3 = B3; capN = ax; } else if (ca < -1e-4) { cap = A; cap3 = A3; capN = mul(ax, -1); }
  if (cap) out += `<path class="f ${opt.cap || "m" + E.lv(capN)}" d="${P2(cap, 1)}"/>`;
  let e = "", c = "";
  for (let j = 0; j < n; j++) {
    if (!vis[j]) continue;
    const k = (j + 1) % n, pj = (j - 1 + n) % n;
    if (cap !== A) e += P2([A[j], A[k]]);
    if (cap !== B) e += P2([B[j], B[k]]);
    if (!vis[pj]) e += P2([A[j], B[j]]);
    else if (sharp(poly, j)) c += P2([A[j], B[j]]);
    if (!vis[k]) e += P2([A[k], B[k]]);
  }
  if (cap) e += P2(cap, 1);
  const inner = opt.on ? opt.on(cap3 ? (q) => E.p(W(cap === B ? s1 : s0, q)) : null) : "";
  return `<g${attrs(opt)}>${out}${c ? `<path class="cr" d="${c}"/>` : ""}${inner}<path class="e" d="${e}"/>${opt.after || ""}</g>`;
}

function sharp(poly, j) {
  const n = poly.length;
  const p = poly[(j - 1 + n) % n], q = poly[j], r = poly[(j + 1) % n];
  const a = [q[0] - p[0], q[1] - p[1]], b = [r[0] - q[0], r[1] - q[1]];
  return (a[0] * b[0] + a[1] * b[1]) / (Math.hypot(...a) * Math.hypot(...b) || 1) < Math.cos(0.4);
}

// Round part (cylinder or frustum) along unit axis a from s0 to s1.
function cyl(E, c, a, ra, rb, s0, s1, opt = {}) {
  const N = opt.n || 40;
  const [e1, e2] = opt.basis || basis(a);
  const slope = (rb - ra) / (s1 - s0 || 1);
  const ring = (s, r) => {
    const o = [];
    for (let i = 0; i < N; i++) { const t = 2 * Math.PI * i / N; o.push(E.p(add(c, mul(a, s), mul(e1, r * Math.cos(t)), mul(e2, r * Math.sin(t))))); }
    return o;
  };
  const A = ring(s0, ra), B = ring(s1, rb);
  const lv = [], vis = [];
  for (let i = 0; i < N; i++) {
    const t = 2 * Math.PI * (i + 0.5) / N;
    const rad = add(mul(e1, Math.cos(t)), mul(e2, Math.sin(t)));
    const nr = norm(add(rad, mul(a, -slope)));
    vis[i] = dot(nr, E.V) > 0; lv[i] = E.lv(nr);
  }
  const H = hull(A.concat(B));
  let out = `<path class="f m1" d="${P2(H, 1)}"/>`;
  let st = vis.indexOf(false); if (st < 0) st = 0;
  const bands = {};
  let i = 0;
  while (i < N) {
    const j0 = (st + i) % N;
    if (!vis[j0]) { i++; continue; }
    let i2 = i; const L0 = lv[j0];
    while (i2 < N && vis[(st + i2) % N] && lv[(st + i2) % N] === L0) i2++;
    const idx = []; for (let q = i; q <= i2; q++) idx.push((st + q) % N);
    (bands[L0] ||= []).push(P2(idx.map((q) => A[q]).concat(idx.slice().reverse().map((q) => B[q])), 1));
    i = i2;
  }
  for (const L in bands) out += `<path class="f m${L}" d="${bands[L].join("")}"/>`;
  const ca = dot(a, E.V);
  let cap = null, capN = null;
  if (ca > 1e-4 && rb > 0.01) { cap = B; capN = a; } else if (ca < -1e-4 && ra > 0.01) { cap = A; capN = mul(a, -1); }
  if (cap) out += `<path class="f ${opt.cap || "m" + E.lv(capN)}" d="${P2(cap, 1)}"/>`;
  let lines = "";
  if (opt.rings) for (const [s, cls] of opt.rings) {
    const r = ra + (s - s0) * slope;
    lines += `<path class="${cls}" d="${arcVis(E, add(c, mul(a, s)), e1, e2, r, a, slope, N * 2)}"/>`;
  }
  const inner = opt.on ? opt.on(cap === B ? s1 : s0, cap) : "";
  return `<g${attrs(opt)}>${out}${lines}${inner}<path class="e" d="${P2(H, 1)}${cap ? P2(cap, 1) : ""}"/></g>`;
}

// Visible front arc of a circle on a round surface.
function arcVis(E, c, e1, e2, r, a, slope = 0, N = 64) {
  let d = "", run = [];
  for (let i = 0; i <= N; i++) {
    const t = 2 * Math.PI * i / N;
    const rad = add(mul(e1, Math.cos(t)), mul(e2, Math.sin(t)));
    const ok = dot(norm(add(rad, mul(a, -slope))), E.V) > 0.02;
    if (ok) run.push(E.p(add(c, mul(rad, r))));
    else if (run.length) { if (run.length > 1) d += P2(run); run = []; }
  }
  if (run.length > 1) d += P2(run);
  return d;
}

// Circle lying in a plane spanned by e1, e2.
function circ3(E, c, e1, e2, r, N = 32) {
  const o = [];
  for (let i = 0; i < N; i++) { const t = 2 * Math.PI * i / N; o.push(E.p(add(c, mul(e1, r * Math.cos(t)), mul(e2, r * Math.sin(t))))); }
  return o;
}

// The far half of a bore, seen from inside through the cut: e2 points away.
function boreIn(E, c, a, e1, e2, R, s0, s1, N = 40) {
  const pt = (s, t) => E.p(add(c, mul(a, s), mul(e1, R * Math.cos(t)), mul(e2, R * Math.sin(t))));
  const A = [], B = [];
  for (let i = 0; i <= N; i++) { const t = Math.PI * i / N; A.push(pt(s0, t)); B.push(pt(s1, t)); }
  let out = `<path class="f bore0" d="${P2(A.concat(B.slice().reverse()), 1)}"/>`;
  const bands = {};
  for (let i = 0; i < N; i++) {
    const t = Math.PI * (i + 0.5) / N;
    const nin = mul(add(mul(e1, Math.cos(t)), mul(e2, Math.sin(t))), -1);
    if (dot(nin, E.V) <= 0) continue;
    const L = Math.min(6, E.lv(nin));
    (bands[L] ||= []).push(P2([A[i], A[i + 1], B[i + 1], B[i]], 1));
  }
  for (const L in bands) out += `<path class="f bore b${L}" d="${bands[L].join("")}"/>`;
  return out;
}

// A recessed cavity in a cut face: wall tone, then the floor shifted by depth.
let CLIP = 0;
function recess(E, polys, depth, floor = "cavf", wall = "cavw", opt = {}) {
  const id = (opt.idp || "cv") + ++CLIP;
  const sh = E.p(depth);
  const d = polys.map((p) => P2(p, 1)).join("");
  const xs = polys.flat();
  const bx = [Math.min(...xs.map((q) => q[0])) - 2, Math.min(...xs.map((q) => q[1])) - 2, Math.max(...xs.map((q) => q[0])) + 2, Math.max(...xs.map((q) => q[1])) + 2];
  return {
    id,
    svg: `<clipPath id="${id}"><path d="${d}"/></clipPath><g clip-path="url(#${id})"${attrs(opt)}><path class="f ${wall}" d="${P2(rect2(bx[0], bx[1], bx[2], bx[3]), 1)}"/><path class="f ${floor}" transform="translate(${r1(sh[0])} ${r1(sh[1])})" d="${d}"/>${opt.inner || ""}</g><path class="e" d="${d}"${opt.asm ? ` data-asm="${opt.asm}"` : ""}/>`,
  };
}

// Coil spring around axis a, split into back and front halves.
function coil(E, c, a, r, s0, s1, turns, wire) {
  const [e1, e2] = basis(a);
  const N = Math.round(turns * 36);
  let back = [], front = [], cur = null, curFront = null;
  const flush = () => { if (cur && cur.length > 1) (curFront ? front : back).push(P2(cur)); };
  for (let i = 0; i <= N; i++) {
    const t = i / N, ang = 2 * Math.PI * turns * t;
    const rad = add(mul(e1, Math.cos(ang)), mul(e2, Math.sin(ang)));
    const q = E.p(add(c, mul(a, lerp(s0, s1, t)), mul(rad, r)));
    const f = dot(rad, E.V) > 0;
    if (cur === null || f !== curFront) { if (cur) { cur.push(q); flush(); } cur = [q]; curFront = f; } else cur.push(q);
  }
  flush();
  const draw = (d, cls) => d.length ? `<path class="coil-o ${cls}" d="${d.join("")}" style="stroke-width:${wire * 2 + 0.7}"/><path class="coil-i ${cls}" d="${d.join("")}" style="stroke-width:${wire * 2 - 0.5}"/>` : "";
  return { back: draw(back, "cb"), front: draw(front, "cf") };
}

// Hex bolt head (with washer) standing on a face, axis a.
function hexBolt(E, c, a, r, h, opt = {}) {
  const [e1, e2] = basis(a);
  const hex = []; for (let i = 0; i < 6; i++) hex.push(rot2([r, 0], 30 + i * 60));
  return cyl(E, c, a, r * 1.25, r * 1.25, 0, 0.8, { n: 28, asm: opt.asm }) +
    prism(E, c, e1, e2, a, hex, 0.8, h, { asm: opt.asm, cls: "bolt" });
}

// Profile of a cam: base circle rb, flank-to-nose lift h, half-width w (cam degrees).
const camRho = (rb, h, w) => (b) => {
  b = ((b + 180) % 360 + 360) % 360 - 180;
  return Math.abs(b) < w ? rb + h * 0.5 * (1 + Math.cos(Math.PI * b / w)) : rb;
};
// Flat-faced follower lift against lobe angle relative to the follower (0..360 -> -180..180).
function liftTable(rho, rb) {
  const T = new Float32Array(361);
  for (let d = 0; d <= 360; d++) {
    const dl = d - 180;
    let m = rb;
    for (let b = -100; b <= 100; b += 0.5) m = Math.max(m, rho(b) * Math.cos((b + dl) * D2R));
    T[d] = m - rb;
  }
  return T;
}
const lookLift = (T, deg) => {
  let d = ((deg + 180) % 360 + 360) % 360;
  const i = Math.floor(d), f = d - i;
  return T[i] * (1 - f) + T[Math.min(360, i + 1)] * f;
};
const wrap180 = (d) => ((d + 180) % 360 + 360) % 360 - 180;

// Piston position along its axis for crank throw r, rod L, crank angle alpha from TDC (deg).
const slider = (r, L, alpha) => { const a = alpha * D2R; return r * Math.cos(a) + Math.sqrt(L * L - r * r * Math.sin(a) ** 2); };

// The far half of a round part (theta 0..pi, rad = cos e1 + sin e2), with its end cap half-disc.
function halfCyl(E, c, a, e1, e2, R, s0, s1, opt = {}) {
  const N = opt.n || 28;
  const pt = (s, t) => E.p(add(c, mul(a, s), mul(e1, R * Math.cos(t)), mul(e2, R * Math.sin(t))));
  const A = [], B = [];
  for (let i = 0; i <= N; i++) { const t = Math.PI * i / N; A.push(pt(s0, t)); B.push(pt(s1, t)); }
  const H = hull(A.concat(B));
  let out = `<path class="f m1" d="${P2(H, 1)}"/>`;
  const bands = {};
  for (let i = 0; i < N; i++) {
    const t = Math.PI * (i + 0.5) / N;
    const nr = add(mul(e1, Math.cos(t)), mul(e2, Math.sin(t)));
    if (!E.vis(nr)) continue;
    (bands[E.lv(nr)] ||= []).push(P2([A[i], A[i + 1], B[i + 1], B[i]], 1));
  }
  for (const L in bands) out += `<path class="f m${L}" d="${bands[L].join("")}"/>`;
  let cap = "";
  if (dot(a, E.V) > 0) cap = P2(B, 1); else if (dot(a, E.V) < 0) cap = P2(A, 1);
  if (cap) out += `<path class="f ${opt.cap || "m5"}" d="${cap}"/>`;
  return out + `<path class="e" d="${P2(H, 1)}${cap}"/>`;
}
