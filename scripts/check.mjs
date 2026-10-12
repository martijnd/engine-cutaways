import { readFileSync } from "node:fs";
const code = ["render.js", "engines.js"].map((f) => readFileSync("src/" + f, "utf8")).join("\n") + "\nreturn {svModel, cbrModel, D2R};";
const { svModel, cbrModel, D2R } = new Function(code)();
for (const M of [svModel(), cbrModel()]) {
  const res = {};
  for (const c of M.cyls) res[c.key] = { min: 1e9, max: -1e9, rodMin: 1e9, rodMax: -1e9, tdc: [] };
  let prev = null;
  for (let t = 0; t < 720; t += 0.25) {
    const S = M.state(t);
    S.forEach((st, i) => {
      const r = res[st.c.key];
      r.min = Math.min(r.min, st.travel); r.max = Math.max(r.max, st.travel);
      // pin and wrist in 3D, as the drawing builds them
      let pin, wrist;
      if (M.key === "sv") { const p = M.psi(t) * D2R; pin = [-M.r * Math.sin(p), M.r * Math.cos(p)]; wrist = [st.c.a[0] * st.x, st.c.a[2] * st.x]; }
      else { const p = M.pinPsi(t, st.c) * D2R; pin = [-M.r * Math.sin(p), M.r * Math.cos(p)]; wrist = [0, st.x]; }
      const L = Math.hypot(wrist[0] - pin[0], wrist[1] - pin[1]);
      r.rodMin = Math.min(r.rodMin, L); r.rodMax = Math.max(r.rodMax, L);
      if (st.travel < 1e-6 && st.phase.index === 0 && st.local < 1) r.tdc.push(t);
    });
  }
  console.log(M.key, Object.fromEntries(Object.entries(res).map(([k, r]) => [k, { stroke: +(r.max - r.min).toFixed(3), rod: [+r.rodMin.toFixed(4), +r.rodMax.toFixed(4)], firesAt: r.tdc }])));
  const order = M.cyls.slice().sort((a, b) => a.fire - b.fire).map((c) => c.short + "@" + c.fire);
  console.log("  firing order", order.join(" "), " displacement cc", (Math.PI / 4 * (M.bore / 10) ** 2 * (2 * M.r / 10) * M.cyls.length).toFixed(1));
}
