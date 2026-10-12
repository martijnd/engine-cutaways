import { readFileSync, writeFileSync } from "node:fs";
const src = (f) => readFileSync(new URL("./src/" + f, import.meta.url), "utf8");
const js = ["render.js", "engines.js", "app.js"].map(src).join("\n");
const html = src("page.html").replace("/*CSS*/", () => src("style.css")).replace("/*JS*/", () => '"use strict";\n' + js);
writeFileSync(new URL("./sv650-vs-cbr650r.html", import.meta.url), html);
console.log("wrote sv650-vs-cbr650r.html", html.length, "bytes");
