#!/usr/bin/env node
// Render check for an eli25 page. Needs Node 22 or newer and any Chrome or Chromium.
// Usage: node render-check.mjs <page.html | url> [--out <dir>]
// Exits 0 when every check passes, 1 when one fails, 2 when it cannot run.
import { execFileSync, spawn } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { basename, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const KEY = "eli25-theme";
const WIDTHS = [1280, 390];
const STATES = [
  { name: "system-light", os: "light", pick: null },
  { name: "system-dark", os: "dark", pick: null },
  { name: "light-on-dark-os", os: "dark", pick: "light" },
  { name: "dark-on-light-os", os: "light", pick: "dark" },
];

const args = process.argv.slice(2);
const outFlag = args.indexOf("--out");
const target = args.find((a, i) => !a.startsWith("--") && (outFlag < 0 || i !== outFlag + 1));
if (!target) {
  console.error("usage: node render-check.mjs <page.html | url> [--out <dir>]");
  process.exit(2);
}
const url = /^(https?|file):/.test(target) ? target : pathToFileURL(resolve(target)).href;
const slug = basename(target).replace(/\.html?$/, "") || "page";
const outDir = outFlag >= 0 ? resolve(args[outFlag + 1]) : join(tmpdir(), "eli25-render", slug);
mkdirSync(outDir, { recursive: true });

function findChrome() {
  if (process.env.CHROME_PATH && existsSync(process.env.CHROME_PATH)) return process.env.CHROME_PATH;
  for (const root of [join(homedir(), "Library/Caches/ms-playwright"), join(homedir(), ".cache/ms-playwright")]) {
    if (!existsSync(root)) continue;
    for (const dir of readdirSync(root).filter((d) => d.startsWith("chromium_headless_shell-")).sort().reverse()) {
      for (const sub of readdirSync(join(root, dir))) {
        for (const exe of ["chrome-headless-shell", "headless_shell"]) {
          const p = join(root, dir, sub, exe);
          if (existsSync(p)) return p;
        }
      }
    }
  }
  for (const app of ["Google Chrome", "Chromium", "Microsoft Edge", "Brave Browser"]) {
    const p = `/Applications/${app}.app/Contents/MacOS/${app}`;
    if (existsSync(p)) return p;
  }
  for (const name of ["google-chrome", "chromium", "chromium-browser", "chrome"]) {
    try {
      return execFileSync("which", [name], { encoding: "utf8" }).trim();
    } catch {}
  }
  return null;
}

const chrome = findChrome();
if (!chrome) {
  console.error("No Chrome or Chromium found. Set CHROME_PATH to a Chrome binary.");
  process.exit(2);
}
const profile = mkdtempSync(join(tmpdir(), "eli25-chrome-"));
const proc = spawn(
  chrome,
  ["--headless=new", "--disable-gpu", "--hide-scrollbars", "--no-first-run", "--no-default-browser-check",
   "--remote-debugging-port=0", `--user-data-dir=${profile}`, "about:blank"],
  { stdio: ["ignore", "ignore", "pipe"] },
);
const cleanup = async () => {
  const exited = new Promise((ok) => (proc.exitCode !== null ? ok() : proc.once("exit", ok)));
  proc.kill();
  await Promise.race([exited, new Promise((ok) => setTimeout(ok, 3000))]);
  try {
    rmSync(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
  } catch {}
};
setTimeout(() => {
  console.error("Render check timed out after 180 s.");
  proc.kill();
  process.exit(2);
}, 180_000).unref();

const wsUrl = await new Promise((ok, fail) => {
  let buf = "";
  proc.stderr.on("data", (d) => {
    buf += d;
    const m = buf.match(/DevTools listening on (ws:\/\/\S+)/);
    if (m) ok(m[1]);
  });
  proc.on("exit", (code) => fail(new Error(`Chrome exited with code ${code}`)));
});
const ws = new WebSocket(wsUrl);
await new Promise((ok, fail) => {
  ws.onopen = ok;
  ws.onerror = fail;
});

let nextId = 0;
const pending = new Map();
const listeners = new Set();
ws.onmessage = (ev) => {
  const msg = JSON.parse(ev.data);
  if (msg.id && pending.has(msg.id)) {
    const { ok, fail } = pending.get(msg.id);
    pending.delete(msg.id);
    if (msg.error) fail(new Error(msg.error.message));
    else ok(msg.result);
  } else for (const fn of listeners) fn(msg);
};
const send = (method, params = {}, sessionId) =>
  new Promise((ok, fail) => {
    const id = ++nextId;
    pending.set(id, { ok, fail });
    ws.send(JSON.stringify({ id, method, params, sessionId }));
  });

const { targetId } = await send("Target.createTarget", { url: "about:blank" });
const { sessionId } = await send("Target.attachToTarget", { targetId, flatten: true });
const page = (method, params) => send(method, params, sessionId);
const scriptErrors = [];
listeners.add((msg) => {
  if (msg.sessionId === sessionId && msg.method === "Runtime.exceptionThrown") {
    const d = msg.params.exceptionDetails;
    scriptErrors.push(d.exception?.description?.split("\n")[0] || d.text);
  }
});
await page("Page.enable");
await page("Runtime.enable");

async function evaluate(expression) {
  const r = await page("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
  if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text);
  return r.result.value;
}
async function setView(width, os) {
  await page("Emulation.setDeviceMetricsOverride", { width, height: 900, deviceScaleFactor: 1, mobile: width < 600 });
  await page("Emulation.setEmulatedMedia", {
    features: [{ name: "prefers-color-scheme", value: os }, { name: "prefers-reduced-motion", value: "reduce" }],
  });
}
async function load() {
  const loaded = new Promise((ok) => {
    const fn = (msg) => {
      if (msg.sessionId === sessionId && msg.method === "Page.loadEventFired") {
        listeners.delete(fn);
        ok();
      }
    };
    listeners.add(fn);
    setTimeout(ok, 30_000);
  });
  await page("Page.navigate", { url });
  await loaded;
  await evaluate(`Promise.race([document.fonts.ready, new Promise(r => setTimeout(r, 5000))]).then(() => true)`);
  await evaluate(`new Promise(r => { const t0 = Date.now(); (function poll() {
    const waiting = [...document.querySelectorAll(".mermaid")].some(m => !m.querySelector("svg"));
    if (!waiting || Date.now() - t0 > 10000) return r(true); setTimeout(poll, 200); })(); })`);
  await evaluate(`new Promise(r => setTimeout(() => r(true), 300))`);
}
async function setPick(pick) {
  await evaluate(`(() => { try { ${pick ? `localStorage.setItem("${KEY}", "${pick}")` : `localStorage.removeItem("${KEY}")`} } catch (e) {} return true; })()`);
}
async function screenshot(file) {
  const { cssContentSize: size } = await page("Page.getLayoutMetrics");
  const shot = await page("Page.captureScreenshot", {
    format: "png",
    captureBeyondViewport: true,
    clip: { x: 0, y: 0, width: Math.ceil(size.width), height: Math.min(Math.ceil(size.height), 16000), scale: 1 },
  });
  writeFileSync(file, Buffer.from(shot.data, "base64"));
  return file;
}

const DESCRIBE = `const describe = (el) => el.tagName.toLowerCase() + (el.id ? "#" + el.id : "") +
  (typeof el.className === "string" && el.className.trim() ? "." + el.className.trim().split(/\\s+/).join(".") : "");`;
const OVERFLOW = `(() => { ${DESCRIBE}
  const w = document.documentElement.clientWidth, sw = document.documentElement.scrollWidth, offenders = [];
  if (sw > w + 1) for (const el of document.body.querySelectorAll("*")) {
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.right <= w + 1) continue;
    let p = el.parentElement, clipped = false;
    while (p && p !== document.body) { if (getComputedStyle(p).overflowX !== "visible") { clipped = true; break; } p = p.parentElement; }
    if (!clipped) offenders.push(describe(el) + " ends at " + Math.round(r.right) + "px");
    if (offenders.length === 3) break;
  }
  return { w, sw, offenders };
})()`;
const COLOURS = `(() => { ${DESCRIBE}
  return [...document.querySelectorAll("body *")].filter(el => !el.closest("#theme-toggle")).map(el => {
    const cs = getComputedStyle(el);
    return [describe(el), [cs.backgroundColor, cs.color, cs.borderTopColor, cs.fill, cs.stroke].join(" ")];
  });
})()`;
const TEXT = `(() => {
  const proseSkip = "svg, pre, nav, .mermaid, .diagram-shell, #theme-toggle";
  const prose = [], plain = [];
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    const el = n.parentElement;
    if (!el || el.closest("script, style, noscript")) continue;
    if (!el.closest("pre, code")) plain.push(n.textContent);
    const figureLabel = el.closest("figure") && !el.closest("figcaption");
    if (!el.closest(proseSkip) && !figureLabel) prose.push(n.textContent);
  }
  const text = plain.join(" ");
  const count = (re) => (text.match(re) || []).length;
  return {
    proseWords: (prose.join(" ").match(/[A-Za-z0-9][A-Za-z0-9'.#-]*/g) || []).length,
    emDashes: count(/\\u2014/g), enDashes: count(/\\u2013/g),
    curlyQuotes: count(/[\\u2018\\u2019\\u201C\\u201D]/g),
    arrows: count(/[\\u2190-\\u21FF\\u27F5-\\u27FF]|->|=>|<-/g),
    headings: [...document.querySelectorAll("h1, h2, h3")].map(h => h.tagName.toLowerCase() + " " + h.textContent.replace(/\\s+/g, " ").trim()),
  };
})()`;

const results = [];
const check = (ok, label, detail = "") => results.push({ ok, label, detail });
try {
  // Toggle: cycles system, light, dark, system and stores the pick.
  await setView(1280, "light");
  await load();
  await setPick(null);
  await load();
  const hasButton = await evaluate(`!!document.getElementById("theme-toggle")`);
  const seen = [await evaluate(`[document.documentElement.dataset.theme || "system", localStorage.getItem("${KEY}")]`)];
  if (hasButton) {
    for (let i = 0; i < 3; i++) {
      seen.push(await evaluate(`(() => { const b = document.getElementById("theme-toggle"); b.click();
        const s = document.documentElement.dataset.theme || "system";
        return [s, localStorage.getItem("${KEY}"), b.textContent.toLowerCase().includes(s)]; })()`));
    }
  }
  const expected = [["system", null], ["light", "light"], ["dark", "dark"], ["system", null]];
  const cycles = hasButton && expected.every(([s, k], i) => seen[i][0] === s && seen[i][1] === k && seen[i][2] !== false);
  check(cycles, `#theme-toggle cycles system, light, dark, system and stores the pick under "${KEY}"`,
    hasButton ? `saw ${seen.map((x) => x[0]).join(", ")}` : "no #theme-toggle button");

  // No flash: the stored pick is applied by an inline head script before any stylesheet.
  const head = await evaluate(`(() => { const kids = [...document.head.children];
    return { sheet: kids.findIndex(e => e.matches('style, link[rel="stylesheet"]')),
             script: kids.findIndex(e => e.tagName === "SCRIPT" && !e.src && e.textContent.includes("${KEY}")) }; })()`);
  await setPick("dark");
  await load();
  const restored = await evaluate(`document.documentElement.dataset.theme || "system"`);
  check(head.script >= 0 && (head.sheet < 0 || head.script < head.sheet) && restored === "dark",
    "an inline head script applies the stored pick before the first stylesheet",
    `script at head child ${head.script}, first stylesheet at ${head.sheet}, reload restored ${restored}`);

  // Every theme state at every width: colours, overflow, screenshots.
  const colours = {};
  const overflow = [];
  const shots = [];
  for (const width of WIDTHS) {
    for (const state of STATES) {
      await setView(width, state.os);
      await setPick(state.pick);
      await load();
      if (width === WIDTHS[0]) colours[state.name] = await evaluate(COLOURS);
      const o = await evaluate(OVERFLOW);
      if (o.sw > o.w + 1) overflow.push(`${state.name} at ${width}px: page is ${o.sw}px wide; ${o.offenders.join("; ") || "no single offender found"}`);
      if (width === WIDTHS[0] || state.pick === null) shots.push(await screenshot(join(outDir, `${slug}-${width}-${state.name}.png`)));
    }
  }
  const differ = (a, b) => a.filter((x, i) => !b[i] || x[1] !== b[i][1]).map((x) => x[0]);
  const lightLeak = differ(colours["light-on-dark-os"], colours["system-light"]);
  const darkLeak = differ(colours["dark-on-light-os"], colours["system-dark"]);
  const themed = differ(colours["system-light"], colours["system-dark"]).length;
  check(themed > 0 && lightLeak.length === 0 && darkLeak.length === 0,
    "an explicit pick beats the OS scheme in both directions, and light differs from dark",
    themed === 0 ? "light and dark look identical"
      : [lightLeak.length && `light pick on a dark OS differs at ${lightLeak.slice(0, 3).join(", ")}`,
         darkLeak.length && `dark pick on a light OS differs at ${darkLeak.slice(0, 3).join(", ")}`].filter(Boolean).join("; ") || `${themed} elements change colour`);
  if (overflow.length) overflow.push("A grid track of 1fr grows to fit wide content; minmax(0, 1fr) lets it shrink.");
  check(overflow.length === 0, `no horizontal overflow at ${WIDTHS.join(" and ")}px in all four theme states`, overflow.join("\n      "));
  check(scriptErrors.length === 0, "no script errors", [...new Set(scriptErrors)].join("; "));

  const t = await evaluate(TEXT);
  const banned = { "em dashes": t.emDashes, "en dashes": t.enDashes, "curly quotes": t.curlyQuotes, "text arrows": t.arrows };
  const found = Object.entries(banned).filter(([, n]) => n > 0);
  check(found.length === 0, "no em dashes, en dashes, curly quotes or text arrows outside code",
    found.map(([k, n]) => `${n} ${k}`).join(", "));

  for (const r of results) console.log(`${r.ok ? "PASS" : "FAIL"}  ${r.label}${r.detail && (!r.ok || r.label.startsWith("an explicit")) ? `\n      ${r.detail}` : ""}`);
  console.log(`INFO  prose words: ${t.proseWords} (text inside <figure>, <svg> and <pre> not counted, captions counted)`);
  console.log(`INFO  headings:\n      ${t.headings.join("\n      ")}`);
  console.log(`INFO  screenshots:\n      ${shots.join("\n      ")}`);
} catch (err) {
  console.error(`Render check could not finish: ${err.message}`);
  await cleanup();
  process.exit(2);
}
await cleanup();
process.exit(results.every((r) => r.ok) ? 0 : 1);
