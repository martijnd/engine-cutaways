// ---------------------------------------------------------------------------
// Engine models. Every number the page shows comes from these functions; the
// drawings are built from the same values.
// ---------------------------------------------------------------------------
const X = [1, 0, 0], Y = [0, 1, 0], Z = [0, 0, 1];
const phaseOf = (local) => {
  const l = ((local % 720) + 720) % 720;
  return { local: l, index: Math.floor(l / 180), share: (l % 180) / 180 };
};
const PHASES = ["Power", "Exhaust", "Intake", "Compression"];

// Cam events are idealized: one symmetric lobe per valve, peaks 105° from TDC.
const IN_PEAK = 465, EX_PEAK = 255;

/* ============================ Suzuki SV650 ============================ */
function svModel() {
  const M = {
    key: "sv", r: 62.6 / 2, L: 130, bore: 81, R: 40.5,
    cyls: [
      { key: "front", label: "Front", short: "F", phi: 45, Yc: -10.5, fire: 0 },
      { key: "rear", label: "Rear", short: "R", phi: -45, Yc: 10.5, fire: 270 },
    ],
    cam: { rb: 17, h: 8.0, w: 74 },
  };
  M.rho = camRho(M.cam.rb, M.cam.h, M.cam.w);
  M.T = liftTable(M.rho, M.cam.rb);
  for (const c of M.cyls) {
    c.a = [-Math.sin(c.phi * D2R), 0, Math.cos(c.phi * D2R)];
    c.n = c.phi > 0 ? [c.a[2], 0, -c.a[0]] : [-c.a[2], 0, c.a[0]];
  }
  // crankpin angle, CCW on screen from vertical (forward rotation in a left-side view)
  M.psi = (theta) => 45 + theta;
  M.state = (theta) => M.cyls.map((c) => {
    const local = theta - c.fire;
    const alpha = M.psi(theta) - c.phi;
    const x = slider(M.r, M.L, alpha);
    const ph = phaseOf(local);
    const lm = ph.local;
    const lin = lookLift(M.T, wrap180((lm - IN_PEAK) / 2));
    const lex = lookLift(M.T, wrap180((lm - EX_PEAK) / 2));
    return { c, local: lm, x, travel: M.r + M.L - x, phase: ph, lin, lex };
  });
  return M;
}

function svDrawing(M) {
  const E = camera(52, 0.55);
  const W = (c, u, w, y = 0) => add([0, c.Yc + y, 0], mul(c.n, u), mul(c.a, w));
  const S = (c, u, w, y = 0) => E.p(W(c, u, w, y));
  const BW = 63, BASE = 88, DECK = 196, DEPTH = 62;
  const roofApex = 207.5, tIn = Math.tan(14 * D2R), tEx = Math.tan(16 * D2R);
  const roof = (u) => roofApex - Math.abs(u) * (u > 0 ? tIn : tEx);
  const VAL = {
    in: { u: 16, rh: 15.5, ang: 14, side: 1 },
    ex: { u: -15, rh: 12.75, ang: -16, side: -1 },
  };
  for (const k in VAL) { const v = VAL[k]; v.d2 = [Math.sin(v.ang * D2R), Math.cos(v.ang * D2R)]; v.w = roof(v.u); }
  const CAM_S = 97 + M.cam.rb + 0.15;
  const vpt = (v, s, off = 0) => [v.u + v.d2[0] * s + v.d2[1] * off, v.w + v.d2[1] * s - v.d2[0] * off];

  // ----- crankcase: the far half, cut behind the crank -----
  function caseLayer() {
    const [fr, re] = M.cyls;
    const xz = (p) => [p[0], p[2]];
    const outline = [
      xz(W(fr, -66, BASE)), [-118, -10], [-112, -62], [-80, -104], [-36, -122], [36, -122], [80, -104], [112, -62], [118, -10],
      xz(W(re, -66, BASE)), xz(W(re, 66, BASE)), xz(W(fr, 66, BASE)),
    ];
    const Yp = 40;
    const bolts = [[-104, -18], [-92, -72], [-50, -108], [0, -112], [50, -108], [92, -72], [104, -18], [0, 98], [-70, 44], [70, 44]];
    const on = () => {
      let s = "";
      for (const [x, z] of bolts) {
        s += `<path class="f m3" d="${P2(circ3(E, [x, Yp, z], X, Z, 3.6, 18), 1)}"/><path class="cr" d="${P2(circ3(E, [x, Yp, z], X, Z, 5.2, 22), 1)}"/>`;
      }
      for (const [x, z] of [[-30, -88], [30, -88], [0, -76]]) s += `<path class="f cavw" d="${P2(circ3(E, [x, Yp, z], X, Z, 2.4, 14), 1)}"/>`;
      return s;
    };
    let s = prism(E, [0, 0, 0], X, Z, Y, outline, Yp, Yp + 34, { cap: "cut", asm: "case", on });
    // main bearing boss and the far main journal
    s += cyl(E, [0, 0, 0], Y, 34, 34, 37.5, Yp, { cap: "m4", asm: "case", n: 56 });
    s += cyl(E, [0, 0, 0], Y, 22, 22, 36.5, 37.5, { asm: "crank", n: 48 });
    return s;
  }

  // ----- crank: far web and crankpin (near web cut away) -----
  const webProfile = hull([...circ2(M.r, 0, 25, 28), ...circ2(0, 0, 30, 28), ...circ2(0, 0, 62, 24, 180 - 64, 180 + 64)]);
  function crankLayer(theta) {
    const psi = M.psi(theta) * D2R;
    const u = [-Math.sin(psi), 0, Math.cos(psi)], v = [-Math.cos(psi), 0, -Math.sin(psi)];
    const pin = mul(u, M.r);
    const on = (proj) => proj ? `<path class="f rec" d="${P2(circ2(-46, 0, 6.5, 18).map(proj), 1)}"/><path class="e" d="${P2(circ2(-46, 0, 6.5, 18).map(proj), 1)}"/><path class="cr" d="${P2(circ2(0, 0, 26, 32).map(proj), 1)}"/>` : "";
    let s = prism(E, [0, 0, 0], u, v, Y, webProfile, 21, 36.5, { asm: "crank", on });
    s += cyl(E, pin, Y, 19, 19, -20.5, 21, { asm: "crank rod", n: 44 });
    return s;
  }

  // ----- connecting rod: big end on the shared pin -----
  const rodProfile = hull([...circ2(0, 0, 28, 36), ...circ2(M.L, 0, 13, 24)]);
  function rodSvg(c, theta, st) {
    const psi = M.psi(theta) * D2R;
    const pin = [-M.r * Math.sin(psi), c.Yc, M.r * Math.cos(psi)];
    const wrist = add([0, c.Yc, 0], mul(c.a, st.x));
    const u = norm(sub(wrist, pin));
    const v = [-u[2], 0, u[0]];
    const y0 = -10, y1 = 10;
    const nub = (sgn) => prism(E, pin, u, v, Y, rect2(-25, sgn * 19, -14, sgn * 26), y0 + 3, y1 - 3, { asm: "rod", cls: "bolt" });
    const on = (proj) => {
      if (!proj) return "";
      const beam = [[34, -10], [M.L - 22, -5.5], [M.L - 22, 5.5], [34, 10]];
      return `<path class="f rec" d="${P2(beam.map(proj), 1)}"/><path class="cr" d="${P2(beam.map(proj), 1)}"/>` +
        `<path class="cr" d="${P2(circ2(0, 0, 20.4, 40).map(proj), 1)}${P2([[0, 20.4], [0, 28]].map(proj))}${P2([[0, -20.4], [0, -28]].map(proj))}"/>` +
        `<path class="f m5" d="${P2(circ2(M.L, 0, 9, 24).map(proj), 1)}"/><path class="e" d="${P2(circ2(M.L, 0, 9, 24).map(proj), 1)}"/><path class="cr" d="${P2(circ2(M.L, 0, 10.8, 24).map(proj), 1)}"/>`;
    };
    return nub(1) + nub(-1) + prism(E, [pin[0], 0, pin[2]], u, v, Y, rodProfile, c.Yc + y0, c.Yc + y1, { asm: "rod", on });
  }

  function pinEnd(theta) {
    const psi = M.psi(theta) * D2R;
    const pin = [-M.r * Math.sin(psi), 0, M.r * Math.cos(psi)];
    return cyl(E, pin, Y, 19, 19, -22.5, -20.5, { asm: "crank rod", n: 44, on: (s) => `<path class="f cavw" d="${P2(circ3(E, add(pin, mul(Y, s)), X, Z, 2.6, 14), 1)}"/>` });
  }

  // ----- piston with rings, pin boss and crown -----
  function pistonSvg(c, st) {
    const base = add([0, c.Yc, 0], mul(c.a, st.x));
    const rings = [[26, "ring"], [22, "ring"], [17.6, "ring2"], [15.6, "ring2"]];
    const boss = add(base, [0, -38.6, 0]);
    let s = cyl(E, base, c.a, M.R, M.R, -24, 30, {
      asm: "piston", n: 56, rings, cap: "crown",
      on: (sc) => `<path class="cr" d="${P2(circ3(E, add(base, mul(c.a, sc)), c.n, Y, M.R - 3, 48), 1)}"/>`,
    });
    s += `<g data-asm="piston"><path class="f m5" d="${P2(circ3(E, boss, c.n, c.a, 10, 24), 1)}"/><path class="e" d="${P2(circ3(E, boss, c.n, c.a, 10, 24), 1)}"/><path class="cr" d="${P2(circ3(E, boss, c.n, c.a, 7, 20), 1)}"/></g>`;
    return s;
  }

  // ----- one valve with its spring, retainer and bucket -----
  function valveSvg(c, v, lift) {
    const seat = W(c, v.u, v.w, -15);
    const ax = norm(add(mul(c.n, v.d2[0]), mul(c.a, v.d2[1])));
    const at = (s) => add(seat, mul(ax, s - lift));
    const sp = coil(E, add(seat, mul(ax, 42)), ax, 9.6, 0, 81 - lift - 42, 6.5, 1.5);
    const tag = { asm: "valve" };
    let s = cyl(E, add(seat, mul(ax, 40)), ax, 11.8, 11.8, 0, 2, { ...tag, n: 32 });
    s += `<g data-asm="valve">${sp.back}</g>`;
    s += cyl(E, at(0), ax, 2.25, 2.25, 13, 95, { ...tag, n: 16 });
    s += cyl(E, at(0), ax, v.rh - 1.8, 2.6, 2.4, 13, { ...tag, n: 36 });
    s += cyl(E, at(0), ax, v.rh, v.rh - 0.6, 0, 2.4, { ...tag, n: 40 });
    s += cyl(E, at(0), ax, 6, 10.8, 77, 81, { ...tag, n: 28 }) + cyl(E, at(0), ax, 10.8, 10.8, 81, 83.5, { ...tag, n: 28 });
    s += `<g data-asm="valve">${sp.front}</g>`;
    s += cyl(E, at(0), ax, 13.5, 13.5, 85, 97, { ...tag, n: 36, rings: [[95.5, "cr"]] });
    return s;
  }

  function camSvg(c, v, delta) {
    const seat2 = vpt(v, CAM_S);
    const ctr = W(c, seat2[0], seat2[1], 0);
    const ax2 = [-(c.n[0] * v.d2[0] + c.a[0] * v.d2[1]), -(c.n[2] * v.d2[0] + c.a[2] * v.d2[1])];
    const lobeDir = rot2(ax2, delta);
    const prof = [];
    for (let b = -180; b < 180; b += 5) { const d = rot2(lobeDir, b); const r = M.rho(b); prof.push([d[0] * r, d[1] * r]); }
    const o = [ctr[0], 0, ctr[2]];
    let s = cyl(E, ctr, Y, 11, 11, -8, 0, { asm: "valve", n: 28 });
    s += prism(E, o, X, Z, Y, prof, c.Yc - 22, c.Yc - 8, { asm: "valve", cls: "lobe" });
    s += cyl(E, ctr, Y, 11, 11, -29, -22, { asm: "valve", n: 28, on: (sc) => `<path class="f cavw" d="${P2(circ3(E, add(ctr, mul(Y, sc)), X, Z, 2.2, 12), 1)}"/>` });
    return s;
  }

  // ----- static cylinder: block, bore, coolant jacket, head, ports -----
  const portPoly = (p0, p1, p2, w0, w1) => {
    const L = [], R = [];
    for (let i = 0; i <= 18; i++) {
      const t = i / 18;
      const q = [(1 - t) ** 2 * p0[0] + 2 * (1 - t) * t * p1[0] + t * t * p2[0], (1 - t) ** 2 * p0[1] + 2 * (1 - t) * t * p1[1] + t * t * p2[1]];
      const d = [2 * (1 - t) * (p1[0] - p0[0]) + 2 * t * (p2[0] - p1[0]), 2 * (1 - t) * (p1[1] - p0[1]) + 2 * t * (p2[1] - p1[1])];
      const l = Math.hypot(d[0], d[1]); const nn = [-d[1] / l, d[0] / l]; const hw = lerp(w0, w1, t);
      L.push([q[0] + nn[0] * hw, q[1] + nn[1] * hw]); R.push([q[0] - nn[0] * hw, q[1] - nn[1] * hw]);
    }
    return L.concat(R.reverse());
  };
  function cylLayer(c) {
    const P = (poly, y = 0) => poly.map(([u, w]) => S(c, u, w, y));
    const block = [[-66, BASE], [66, BASE], [66, 97], [BW, 100], [BW, DECK - 3], [BW - 3, DECK], [-BW + 3, DECK], [-BW, DECK - 3], [-BW, 100], [-66, 97]];
    let s = `<g>`;
    s += prism(E, [0, c.Yc, 0], c.n, c.a, Y, block, 0, DEPTH, { cap: "cut", asm: "cyl" });
    // bore: the far half of the cylinder wall, seen through the cut
    const ch = rect2(-M.R, BASE, M.R, DECK);
    const cid = "svb" + c.key;
    s += `<clipPath id="${cid}"><path d="${P2(P(ch), 1)}"/></clipPath><g clip-path="url(#${cid})" data-asm="cyl">${boreIn(E, add([0, c.Yc, 0], mul(c.a, 0)), c.a, c.n, Y, M.R, BASE, DECK)}</g><path class="e" d="${P2(P(ch), 1)}"/>`;
    s += `<path class="bore-plate" d="${P2(P([[-M.R, BASE], [-M.R, DECK]]))}${P2(P([[M.R, BASE], [M.R, DECK]]))}"/>`;
    // coolant jacket either side of the bore
    s += recess(E, [P(rrect2(45, 104, 56, 190, 3)), P(rrect2(-56, 104, -45, 190, 3))], [0, 34, 0], "cool", "coolw", { asm: "cyl cool" }).svg;
    s += `<text class="engrave" transform="${faceMatrix(E, W(c, -52, 90.6), [c.a[2], 0, -c.a[0]], c.a)}" font-size="6.4" text-anchor="middle">${c.short}</text>`;
    s += `</g><g>`;
    // head casting
    const head = [[-BW, DECK], [BW, DECK], [BW, 236], [82, 258], [82, 320], [78, 338], [62, 350], [-62, 350], [-78, 338], [-82, 320], [-82, 258], [-BW, 236]];
    const bolts = [-34, 34].map((u) => hexBolt(E, W(c, u, 350, 34), c.a, 4.6, 5, { asm: "head" })).join("");
    s += prism(E, [0, c.Yc, 0], c.n, c.a, Y, head, 0, DEPTH, { cap: "cut", asm: "head" });
    // combustion chamber (pent roof) with the firing glow
    const chamber = [[-M.R, DECK], [M.R, DECK]];
    for (let u = M.R; u >= -M.R; u -= 4.5) chamber.push([u, Math.max(DECK, roof(u))]);
    const chP = P(chamber);
    s += recess(E, [chP], [0, 30, 0], "cavf", "cavw", { asm: "head", inner: `<path class="flash" data-flash="${c.key}" d="${P2(chP, 1)}" opacity="0"/>` }).svg;
    // ports
    const inP = portPoly(vpt(VAL.in, 7), vpt(VAL.in, 38), [82, 252], 11.5, 13.5);
    const exP = portPoly(vpt(VAL.ex, 7), vpt(VAL.ex, 30), [-BW, 228], 10, 12);
    s += recess(E, [P(inP), P(exP)], [0, 14, 0], "cavf", "cavw", { asm: "head" }).svg;
    // cam box with the bucket bores and spring pockets
    const pocket = (v) => [vpt(v, 40, -15), vpt(v, 40, 15), vpt(v, 110, 15), vpt(v, 110, -15)];
    s += recess(E, [P(rrect2(-76, 262, 76, 344, 10)), P(pocket(VAL.in)), P(pocket(VAL.ex))], [0, 20, 0], "cavf", "cavw", { asm: "head" }).svg;
    // coolant passages round the chamber
    s += recess(E, [P(rrect2(44, 199, 58, 213, 3)), P(rrect2(-58, 199, -44, 213, 3))], [0, 22, 0], "cool", "coolw", { asm: "head cool" }).svg;
    s += bolts + `</g>`;
    return s;
  }

  // ----- layers in painter's order -----
  const [FR, RE] = M.cyls;
  const valvetrain = (c, st) => {
    const dIn = wrap180((st.local - IN_PEAK) / 2), dEx = wrap180((st.local - EX_PEAK) / 2);
    return valveSvg(c, VAL.ex, st.lex) + valveSvg(c, VAL.in, st.lin) + camSvg(c, VAL.ex, dEx) + camSvg(c, VAL.in, dIn);
  };
  const layers = [
    { stat: caseLayer },
    { dyn: (t, S2) => crankLayer(t) },
    { stat: () => cylLayer(RE) },
    { dyn: (t, S2) => rodSvg(RE, t, S2[1]) + pistonSvg(RE, S2[1]) + valvetrain(RE, S2[1]) },
    { stat: () => cylLayer(FR) },
    { dyn: (t, S2) => rodSvg(FR, t, S2[0]) + pinEnd(t) + pistonSvg(FR, S2[0]) + valvetrain(FR, S2[0]) },
  ];
  return { E, layers };
}

/* ============================ Honda CBR650R ============================ */
function cbrModel() {
  const M = {
    key: "cbr", r: 23, L: 98, bore: 67, R: 33.5, pitch: 80, cant: 30,
    cyls: [1, 2, 3, 4].map((n) => ({ key: "c" + n, n, label: "Cyl " + n, short: String(n), fire: { 1: 0, 2: 180, 4: 360, 3: 540 }[n] })),
    cam: { rb: 14, h: 6.8, w: 74 },
  };
  M.rho = camRho(M.cam.rb, M.cam.h, M.cam.w);
  M.T = liftTable(M.rho, M.cam.rb);
  // Drawn in the engine's own frame and seen square to the cut plane, which
  // contains the crank axis and the cylinder axes (canted 30° forward on the bike).
  M.a = [0, 0, 1];             // cylinder axis
  M.t = [0, -1, 0];            // toward the viewer: the front of the engine
  M.d = [0, 1, 0];             // away from the viewer
  // #1 is on the rider's left, which is the right of this front view.
  for (const c of M.cyls) c.X = (2.5 - c.n) * M.pitch;
  M.pinPsi = (theta, c) => theta - c.fire;
  M.state = (theta) => M.cyls.map((c) => {
    const local = theta - c.fire;
    const ph = phaseOf(local);
    const x = slider(M.r, M.L, ph.local % 360);
    const lin = lookLift(M.T, wrap180((ph.local - IN_PEAK) / 2));
    const lex = lookLift(M.T, wrap180((ph.local - EX_PEAK) / 2));
    return { c, local: ph.local, x, travel: M.r + M.L - x, phase: ph, lin, lex };
  });
  return M;
}

function cbrDrawing(M) {
  const E = camera(32, 0.5);
  const A = M.a, T = M.t, Dv = M.d;
  const G = (Xg, w, t = 0) => add([Xg, 0, 0], mul(A, w), mul(T, t));
  const GP = (poly, t = 0) => poly.map(([x, w]) => E.p(G(x, w, t)));
  const HALF = 184, BASE = 66, DECK = 148, TOP = 232;
  const ang = 12.5 * D2R;
  const roofW = (t) => DECK + 7.2 - Math.abs(t) * Math.tan(ang);
  const VAL = {
    ex: { t: 11, rh: 11, side: 1, xs: [-12, 12] },
    in: { t: -12, rh: 13, side: -1, xs: [-13, 13] },
  };
  for (const k in VAL) {
    const v = VAL[k];
    v.w = roofW(v.t);
    v.ax = norm(add(mul(A, Math.cos(ang)), mul(T, v.side * Math.sin(ang))));
  }
  const CAM_S = 90 + M.cam.rb + 0.15;
  const seat = (v, Xg) => G(Xg, v.w, v.t);

  // ----- crankcase: far half, cut behind the crank, with bearing webs -----
  function caseLayer() {
    const o = [0, 0, 0];
    const outline = rrect2(-HALF, -96, HALF, BASE, 10);
    const on = () => {
      let s = "";
      for (const x of [-172, 172]) for (const w of [-80, 40]) s += `<path class="f m3" d="${P2(circ3(E, add(G(x, w), mul(Dv, 50)), X, A, 3.6, 18), 1)}"/><path class="cr" d="${P2(circ3(E, add(G(x, w), mul(Dv, 50)), X, A, 5.2, 20), 1)}"/>`;
      return s;
    };
    let s = prism(E, o, X, A, Dv, outline, 50, 84, { cap: "cut", asm: "case", on });
    for (const c of M.cyls) s += `<text class="engrave" transform="${faceMatrix(E, add(G(c.X, -88), mul(Dv, 50)), X, A)}" font-size="9" text-anchor="middle">${c.n}</text>`;
    // main bearing webs, cut 20 mm behind the crank axis
    const webs = [-2, -1, 0, 1, 2].map((k) => k * M.pitch);
    for (const xb of webs) {
      const x0 = xb - (Math.abs(xb) === 2 * M.pitch ? 10 : 14), x1 = xb + (Math.abs(xb) === 2 * M.pitch ? 10 : 14);
      const poly = [[x0, -86], [x1, -86], [x1, 34], [x0, 34]];
      const studs = (proj) => {
        let t = "";
        for (const xs of [x0 + 7, x1 - 7]) {
          const ch = rect2(xs - 2.6, -70, xs + 2.6, 28);
          t += `<path class="f cavw" d="${P2(ch.map(proj), 1)}"/><path class="f m4" d="${P2(rect2(xs - 1.8, -70, xs + 1.8, 28).map(proj), 1)}"/><path class="cr" d="${P2(ch.map(proj), 1)}"/>`;
        }
        return t;
      };
      s += prism(E, o, X, A, Dv, poly, 20, 50, { cap: "cut", asm: "case", on: (proj) => proj ? studs(proj) : "" });
    }
    return s;
  }

  // ----- block, bores, coolant, head, chambers, plug wells -----
  function blockLayer() {
    let s = "";
    const block = [[-HALF, BASE], [HALF, BASE], [HALF, DECK - 3], [HALF - 3, DECK], [-HALF + 3, DECK], [-HALF, DECK - 3]];
    s += prism(E, [0, 0, 0], X, A, Dv, block, 0, 72, { cap: "cut", asm: "cyl" });
    for (const c of M.cyls) {
      const id = "cbrb" + c.n;
      const ch = GP(rect2(c.X - M.R, BASE, c.X + M.R, DECK));
      s += `<clipPath id="${id}"><path d="${P2(ch, 1)}"/></clipPath><g clip-path="url(#${id})" data-asm="cyl">${boreIn(E, [c.X, 0, 0], A, X, Dv, M.R, BASE, DECK)}</g><path class="e" d="${P2(ch, 1)}"/>`;
      s += `<path class="bore-plate" d="${P2(GP([[c.X - M.R, BASE], [c.X - M.R, DECK]]))}${P2(GP([[c.X + M.R, BASE], [c.X + M.R, DECK]]))}"/>`;
    }
    s += recess(E, [GP(rrect2(-HALF + 6, 76, -HALF + 16, 142, 3)), GP(rrect2(HALF - 16, 76, HALF - 6, 142, 3))], mul(Dv, 30), "cool", "coolw", { asm: "cyl cool" }).svg;
    return s;
  }

  let chamberClip = "";
  function headLayer() {
    let s = "";
    const head = [[-HALF, DECK], [HALF, DECK], [HALF, TOP - 6], [HALF - 6, TOP], [-HALF + 6, TOP], [-HALF, TOP - 6]];
    s += prism(E, [0, 0, 0], X, A, Dv, head, 0, 70, { cap: "cut", asm: "head" });
    const chambers = M.cyls.map((c) => GP([[c.X - M.R, DECK], [c.X + M.R, DECK], [c.X + 26, DECK + 7.2], [c.X - 26, DECK + 7.2]]));
    const flashes = M.cyls.map((c, i) => `<path class="flash" data-flash="${c.key}" d="${P2(chambers[i], 1)}" opacity="0"/>`).join("");
    const ch = recess(E, chambers, mul(Dv, 26), "cavf", "cavw", { asm: "head", inner: flashes, idp: "cbrch" });
    chamberClip = ch.id;
    s += ch.svg;
    s += recess(E, M.cyls.map((c) => GP(rrect2(c.X - 7, DECK + 7.2, c.X + 7, TOP, 2))), mul(Dv, 9), "cavf", "cavw", { asm: "head" }).svg;
    const cool = [];
    for (let k = -2; k <= 2; k++) { const xm = k * M.pitch; const hw = Math.abs(k) === 2 ? 0 : 5; if (hw) cool.push(GP(rrect2(xm - hw, 156, xm + hw, 186, 2))); }
    cool.push(GP(rrect2(-HALF + 8, 154, -HALF + 18, 196, 3)), GP(rrect2(HALF - 18, 154, HALF - 8, 196, 3)));
    s += recess(E, cool, mul(Dv, 24), "cool", "coolw", { asm: "head cool" }).svg;
    return s;
  }

  // ----- valves -----
  function valveSvg(v, Xg, lift, whole) {
    const sp0 = seat(v, Xg);
    const ax = v.ax;
    const at = (s) => add(sp0, mul(ax, s - lift));
    const tag = { asm: "valve" };
    if (!whole) {
      // intake side, behind the cut: head in the chamber, bucket above the deck
      const sDeck = (TOP - v.w) / dot(ax, A);
      const head = cyl(E, at(0), ax, v.rh, v.rh - 0.6, 0, 2.2, { ...tag, n: 32 }) + cyl(E, at(0), ax, v.rh - 1.6, 2.4, 2.2, 10, { ...tag, n: 28 });
      const bucket = cyl(E, sp0, ax, 12.5, 12.5, Math.max(sDeck, 76 - lift), 90 - lift, { ...tag, n: 32, rings: [[88.6 - lift, "cr"]] });
      return { head, bucket, bore: `<path class="cr" data-asm="valve" d="${P2(circ3(E, add(sp0, mul(ax, sDeck)), X, norm(cross(ax, X)), 13.4, 32), 1)}"/>` };
    }
    const sp = coil(E, add(sp0, mul(ax, 36)), ax, 8.4, 0, 72 - lift - 36, 6, 1.3);
    let s = cyl(E, add(sp0, mul(ax, 34)), ax, 10.2, 10.2, 0, 2, { ...tag, n: 28 });
    s += `<g data-asm="valve">${sp.back}</g>`;
    s += cyl(E, at(0), ax, 2.1, 2.1, 10, 87, { ...tag, n: 14 });
    s += cyl(E, at(0), ax, v.rh - 1.6, 2.4, 2.2, 10, { ...tag, n: 28 });
    s += cyl(E, at(0), ax, v.rh, v.rh - 0.6, 0, 2.2, { ...tag, n: 32 });
    s += cyl(E, at(0), ax, 5.2, 9.4, 68.5, 72, { ...tag, n: 24 }) + cyl(E, at(0), ax, 9.4, 9.4, 72, 74, { ...tag, n: 24 });
    s += `<g data-asm="valve">${sp.front}</g>`;
    s += cyl(E, at(0), ax, 12.5, 12.5, 78, 90, { ...tag, n: 32, rings: [[88.6, "cr"]] });
    return s;
  }

  // camshaft across all four cylinders, lobes in order of x
  function camSvg(v, deltas) {
    const ctr = (Xg) => add(seat(v, Xg), mul(v.ax, CAM_S));
    const c0 = ctr(0);
    const toYZ = (p) => [p[1], p[2]];
    const ax2 = [-v.ax[1], -v.ax[2]];
    const rotYZ = ([y, z], deg) => { const cs = Math.cos(deg * D2R), sn = Math.sin(deg * D2R); return [y * cs - z * sn, y * sn + z * cs]; };
    const lobes = [];
    for (const c of M.cyls) for (const xo of v.xs) lobes.push({ x0: c.X + xo - 6.5, x1: c.X + xo + 6.5, d: deltas[c.n] });
    lobes.sort((a, b) => a.x0 - b.x0);
    const shaft = (x0, x1) => cyl(E, [x0, c0[1], c0[2]], X, 10, 10, 0, x1 - x0, { asm: "valve", n: 28 });
    let s = "", x = -HALF + 14;
    for (const l of lobes) {
      if (l.x0 > x) s += shaft(x, l.x0);
      const dir = rotYZ(ax2, l.d);
      const prof = [];
      for (let b = -180; b < 180; b += 6) { const d = rotYZ(dir, b); const r = M.rho(b); prof.push([d[0] * r, d[1] * r]); }
      s += prism(E, [0, c0[1], c0[2]], Y, Z, X, prof, l.x0, l.x1, { asm: "valve", cls: "lobe" });
      x = l.x1;
    }
    s += shaft(x, HALF - 14);
    void toYZ;
    return s;
  }

  // cam holders on the deck behind the cut (intake side)
  function holderLayer() {
    let s = "";
    const v = VAL.in;
    const c0 = add(seat(v, 0), mul(v.ax, CAM_S));
    const tC = -dot(c0, Dv), wC = dot(c0, A);
    for (let k = -2; k <= 2; k++) {
      const xb = k * M.pitch, hw = 8;
      const poly = [[tC - 15, TOP], [tC + 15, TOP], [tC + 15, wC + 4], [tC + 11, wC + 13], [tC - 11, wC + 13], [tC - 15, wC + 4]];
      const o = [xb - hw, 0, 0];
      s += prism(E, o, T, A, X, poly, 0, 2 * hw, { asm: "head" });
      for (const tt of [tC - 9, tC + 9]) s += hexBolt(E, add([xb, 0, 0], mul(T, tt), mul(A, wC + 13)), A, 3.8, 4, { asm: "head" });
    }
    return s;
  }

  // ----- crank, rods, pistons -----
  const webProfile = hull([...circ2(M.r, 0, 20, 28), ...circ2(0, 0, 22, 28), ...circ2(0, 0, 46, 24, 180 - 62, 180 + 62)]);
  const rodProfile = hull([...circ2(0, 0, 24, 36), ...circ2(M.L, 0, 11, 24)]);
  const plane = (psi) => {
    const p = psi * D2R;
    const u = [0, -Math.sin(p), Math.cos(p)];
    const v = norm(cross(X, u));
    return { u, v };
  };
  function crankSvg(theta, S2) {
    let s = "";
    const xs = M.cyls.map((c) => c.X).sort((a, b) => a - b);
    const byX = M.cyls.slice().sort((a, b) => a.X - b.X);
    const main = (x0, x1) => cyl(E, [x0, 0, 0], X, 16, 16, 0, x1 - x0, { asm: "crank", n: 36 });
    s += main(-HALF + 20, xs[0] - 22);
    byX.forEach((c, i) => {
      const { u, v } = plane(M.pinPsi(theta, c));
      const pin = mul(u, M.r);
      const st = S2[c.n - 1];
      const web = (x0, x1) => prism(E, [0, 0, 0], u, v, X, webProfile, x0, x1, {
        asm: "crank", on: (proj) => proj ? `<path class="f rec" d="${P2(circ2(-34, 0, 5, 16).map(proj), 1)}"/><path class="e" d="${P2(circ2(-34, 0, 5, 16).map(proj), 1)}"/><path class="cr" d="${P2(circ2(0, 0, 17, 28).map(proj), 1)}"/>` : "",
      });
      s += web(c.X - 22, c.X - 10);
      s += cyl(E, add([c.X - 10, 0, 0], pin), X, 15, 15, 0, 20, { asm: "crank rod", n: 36 });
      // rod
      const wrist = add([c.X, 0, 0], mul(A, st.x));
      const ru = norm(sub(wrist, add([c.X, 0, 0], pin)));
      const rv = norm(cross(X, ru));
      const pin3 = add([0, 0, 0], pin);
      const nub = (sg) => prism(E, pin3, ru, rv, X, rect2(-21, sg * 16, -12, sg * 22), c.X - 6, c.X + 6, { asm: "rod", cls: "bolt" });
      const on = (proj) => {
        if (!proj) return "";
        const beam = [[29, -8.5], [M.L - 18, -4.6], [M.L - 18, 4.6], [29, 8.5]];
        return `<path class="f rec" d="${P2(beam.map(proj), 1)}"/><path class="cr" d="${P2(beam.map(proj), 1)}"/>` +
          `<path class="cr" d="${P2(circ2(0, 0, 16.4, 36).map(proj), 1)}${P2([[0, 16.4], [0, 24]].map(proj))}${P2([[0, -16.4], [0, -24]].map(proj))}"/>` +
          `<path class="f m5" d="${P2(circ2(M.L, 0, 7.6, 20).map(proj), 1)}"/><path class="e" d="${P2(circ2(M.L, 0, 7.6, 20).map(proj), 1)}"/>`;
      };
      s += nub(1) + nub(-1) + prism(E, pin3, ru, rv, X, rodProfile, c.X - 9, c.X + 9, { asm: "rod", on });
      s += web(c.X + 10, c.X + 22);
      s += pistonSvg(c, st);
      const next = byX[i + 1];
      s += main(c.X + 22, next ? next.X - 22 : HALF - 20);
    });
    return s;
  }
  function pistonSvg(c, st) {
    const base = add([c.X, 0, 0], mul(A, st.x));
    const rings = [[22.5, "ring"], [19, "ring"], [15.2, "ring2"], [13.6, "ring2"]];
    let s = cyl(E, base, A, M.R, M.R, -16, 26, {
      asm: "piston", n: 56, rings, cap: "crown",
      on: (sc) => `<path class="cr" d="${P2(circ3(E, add(base, mul(A, sc)), X, T, M.R - 2.6, 48), 1)}"/>`,
    });
    const boss = add(base, [M.R - 1.2, 0, 0]);
    s += `<g data-asm="piston"><path class="f m5" d="${P2(circ3(E, boss, T, A, 8, 22), 1)}"/><path class="e" d="${P2(circ3(E, boss, T, A, 8, 22), 1)}"/><path class="cr" d="${P2(circ3(E, boss, T, A, 5.6, 18), 1)}"/></g>`;
    return s;
  }

  const deltas = (S2, peak) => Object.fromEntries(S2.map((st) => [st.c.n, wrap180((st.local - peak) / 2)]));
  const byX = () => M.cyls.slice().sort((a, b) => a.X - b.X);

  const layers = [
    { stat: caseLayer },
    { stat: blockLayer },
    { stat: headLayer },
    {
      dyn: (t, S2) => {
        // intake side behind the cut: valve heads seen in the chambers, buckets and cam on the deck
        let heads = "", bores = "", buckets = "";
        for (const c of byX()) for (const xo of VAL.in.xs) {
          const r = valveSvg(VAL.in, c.X + xo, S2[c.n - 1].lin, false);
          heads += r.head; bores += r.bore; buckets += r.bucket;
        }
        return `<g clip-path="url(#${chamberClip})">${heads}</g>` + bores + buckets + camSvg(VAL.in, deltas(S2, IN_PEAK));
      },
    },
    { stat: holderLayer },
    {
      dyn: (t, S2) => {
        let s = crankSvg(t, S2);
        for (const c of byX()) for (const xo of VAL.ex.xs) s += valveSvg(VAL.ex, c.X + xo, S2[c.n - 1].lex, true);
        s += camSvg(VAL.ex, deltas(S2, EX_PEAK));
        return s;
      },
    },
  ];
  return { E, layers };
}

// A transform that lays text in the plane spanned by e1 (text x) and e2 (text up).
function faceMatrix(E, o, e1, e2) {
  const p0 = E.p(o), px = E.p(add(o, e1)), py = E.p(add(o, mul(e2, -1)));
  return `matrix(${r1x(px[0] - p0[0])} ${r1x(px[1] - p0[1])} ${r1x(py[0] - p0[0])} ${r1x(py[1] - p0[1])} ${r1(p0[0])} ${r1(p0[1])})`;
}
const r1x = (n) => Math.round(n * 1000) / 1000;
