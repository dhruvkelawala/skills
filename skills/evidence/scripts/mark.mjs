#!/usr/bin/env node
// One marked image from a before and after pair: the panes side by side or stacked, each under its
// label, a numbered circle with an arrow at each difference, and a legend under them, one line per
// number. The sheet is at most 1200 px wide.
//
//   mark.mjs <spec.json> <out.png>
//
// The spec names its PNG captures relative to its own folder:
//
//   { "layout": "side",
//     "panes": [{ "file": "before.png", "label": "Before" }, { "file": "after.png", "label": "After" }],
//     "marks": [{ "n": 1, "text": "The title uses the 60 px token", "at": [[455, 190], [505, 422]] }] }
//
// `layout` is `side` or `stack`. `at` holds one point per pane, in that capture's pixels, or null for
// a pane the mark doesn't apply to. The sheet is an HTML page that agent-browser renders headless and
// screenshots, so the script needs no npm package.

import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const USAGE = "usage: mark.mjs <spec.json> <out.png>";
const MAX_WIDTH = 1200;
const PAD = 24;
const GAP = 24;
const FRAME = 1;
const ACCENT = "#ff3d71";
// A circle's radius to the middle of its white ring, the ring's width, and the arrow from the
// circle's centre to the point.
const RADIUS = 17;
const RING = 3;
const OUTER = RADIUS + RING / 2;
const ARROW = 80;
const HEAD = 16;
// Where a circle may sit around its point, most wanted first once sorted toward the pane's middle.
const DIRECTIONS = [[-1, -1], [1, -1], [-1, 1], [1, 1], [-1, 0], [1, 0], [0, -1], [0, 1]].map(([x, y]) => unit(x, y));
const READY = "Promise.all([...document.images].map((image) => image.decode())).then(() => document.fonts.ready).then(() => true)";

function sheetOf(spec, captures) {
  const side = spec.layout !== "stack";
  const panes = captures.map(({ capture }) => ({ left: 0, top: 0, ...capture }));
  const frames = 2 * FRAME * (side ? panes.length : 1);
  const room = MAX_WIDTH - 2 * PAD - frames - (side ? GAP * (panes.length - 1) : 0);
  const widths = panes.map((pane) => pane.width);
  const natural = side ? widths.reduce((a, b) => a + b, 0) : Math.max(...widths);
  const scale = Math.min(1, room / natural);
  const width = scale < 1 ? MAX_WIDTH : Math.round(natural + frames + 2 * PAD + (side ? GAP * (panes.length - 1) : 0));
  return {
    side,
    width,
    panes: panes.map((pane, i) => {
      const points = spec.marks.flatMap(({ n, at }) => {
        const point = at[i];
        return point ? [{ n, x: (point[0] - pane.left) * scale, y: (point[1] - pane.top) * scale }] : [];
      });
      const box = { width: Math.floor(pane.width * scale), height: Math.floor(pane.height * scale) };
      return { ...captures[i], ...box, scale, left: pane.left, top: pane.top, circles: placeCircles(points, box) };
    }),
  };
}

// Each circle goes beside its point, toward the pane's middle, inside the pane and clear of the other
// points and circles. A crowded or small pane gets shorter arrows before a circle is pushed inside it.
function placeCircles(points, box) {
  const placed = [];
  for (const point of points) {
    const inward = unit(box.width / 2 - point.x, box.height / 2 - point.y);
    const order = [...DIRECTIONS].sort((a, b) => dot(b, inward) - dot(a, inward));
    const others = points.filter((other) => other !== point);
    let best;
    for (const length of [ARROW, ARROW * 0.65]) {
      const fits = order
        .map(([dx, dy]) => ({ x: point.x + dx * length, y: point.y + dy * length }))
        .filter((spot) => fitsIn(spot, box))
        .map((spot) => ({ ...spot, room: Math.min(...[...others, ...placed].map((o) => Math.hypot(o.x - spot.x, o.y - spot.y))) }));
      best = fits.find((spot) => spot.room >= 3 * OUTER) ?? fits.sort((a, b) => b.room - a.room)[0];
      if (best) break;
    }
    const margin = OUTER + 2;
    best ??= {
      x: Math.min(Math.max(point.x - ARROW, margin), box.width - margin),
      y: Math.min(Math.max(point.y - ARROW, margin), box.height - margin),
    };
    placed.push({ n: point.n, x: best.x, y: best.y, point });
  }
  return placed;
}

const fitsIn = ({ x, y }, box) => x - OUTER - 2 >= 0 && y - OUTER - 2 >= 0 && x + OUTER + 2 <= box.width && y + OUTER + 2 <= box.height;

function unit(x, y) {
  const length = Math.hypot(x, y);
  return length ? [x / length, y / length] : [0, 0];
}

const dot = ([ax, ay], [bx, by]) => ax * bx + ay * by;

function pageOf(spec, sheet) {
  const columns = spec.marks.length > 2 && sheet.width >= 760 ? 2 : 1;
  const panes = sheet.panes.map((pane) => {
    const image = `left:${-pane.left * pane.scale}px;top:${-pane.top * pane.scale}px;width:${pane.capture.width * pane.scale}px;height:${pane.capture.height * pane.scale}px`;
    return `<figure><figcaption>${escape(pane.label)}</figcaption><div class="pane" style="width:${pane.width}px;height:${pane.height}px"><img src="data:image/png;base64,${pane.png.toString("base64")}" style="${image}">${overlay(pane)}</div></figure>`;
  });
  const legend = spec.marks.map(({ n, text }) => `<li><span class="dot">${n}</span><span>${escape(text)}</span></li>`);
  return `<!doctype html><meta charset="utf-8"><style>
* { margin: 0; padding: 0; }
html, body { background: #0a0a0a; width: ${sheet.width}px; }
main { box-sizing: border-box; width: ${sheet.width}px; padding: ${PAD}px; color: #e5e5e5; font: 500 20px/1.4 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; }
.panes { display: flex; flex-direction: ${sheet.side ? "row" : "column"}; gap: ${sheet.side ? GAP : 20}px; justify-content: center; align-items: flex-start; }
figcaption { margin-bottom: 8px; color: #a3a3a3; font-size: 15px; font-weight: 650; letter-spacing: 0.06em; text-transform: uppercase; }
.pane { position: relative; overflow: hidden; border: ${FRAME}px solid #262626; border-radius: 8px; }
.pane img { position: absolute; max-width: none; }
.pane svg { position: absolute; inset: 0; }
ol { display: grid; grid-template-columns: repeat(${columns}, 1fr); gap: 10px 32px; margin-top: 20px; list-style: none; }
li { display: flex; gap: 12px; align-items: flex-start; }
.dot { flex: none; box-sizing: border-box; width: 26px; height: 26px; margin-top: 1px; border: 2px solid #fff; border-radius: 50%; background: ${ACCENT}; color: #fff; font-size: 14px; font-weight: 700; line-height: 22px; text-align: center; }
</style><main><div class="panes">${panes.join("")}</div><ol>${legend.join("")}</ol></main>`;
}

// The arrows first, so no arrow crosses a circle's number.
function overlay(pane) {
  const arrows = pane.circles.map(({ x, y, point }) => {
    const [ux, uy] = unit(point.x - x, point.y - y);
    const start = [x + ux * (OUTER + 2.5), y + uy * (OUTER + 2.5)];
    const base = [point.x - ux * HEAD, point.y - uy * HEAD];
    const side = [-uy * HEAD * 0.45, ux * HEAD * 0.45];
    const head = [[point.x, point.y], [base[0] + side[0], base[1] + side[1]], [base[0] - side[0], base[1] - side[1]]];
    return `<line x1="${start[0]}" y1="${start[1]}" x2="${base[0] + ux}" y2="${base[1] + uy}" stroke="${ACCENT}" stroke-width="4" stroke-linecap="round"/><polygon points="${head.map((p) => p.join(",")).join(" ")}" fill="${ACCENT}"/>`;
  });
  const circles = pane.circles.map(({ n, x, y }) => {
    const size = String(n).length > 1 ? 15 : 18;
    return `<circle cx="${x}" cy="${y}" r="${RADIUS}" fill="${ACCENT}" stroke="#fff" stroke-width="${RING}"/><text x="${x}" y="${y}" fill="#fff" font-size="${size}" font-weight="700" text-anchor="middle" dominant-baseline="central">${n}</text>`;
  });
  return `<svg width="${pane.width}" height="${pane.height}" viewBox="0 0 ${pane.width} ${pane.height}">${arrows.join("")}${circles.join("")}</svg>`;
}

const escape = (text) => String(text).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

function pngSize(png, file) {
  if (png.toString("hex", 0, 8) !== "89504e470d0a1a0a" || png.toString("latin1", 12, 16) !== "IHDR") {
    throw new Error(`${file} is not a PNG; mark.mjs reads PNG captures`);
  }
  return { width: png.readUInt32BE(16), height: png.readUInt32BE(20) };
}

// A fresh session per sheet, closed even when the render fails, as Lore's evidence tools do.
function render(html, width, out) {
  const dir = mkdtempSync(join(tmpdir(), "mark-"));
  const session = ["--session", `mark-${randomUUID()}`];
  const browser = (...args) => execFileSync("agent-browser", [...session, ...args], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
  try {
    writeFileSync(join(dir, "sheet.html"), html);
    browser("set", "viewport", String(width), "100");
    browser("open", pathToFileURL(join(dir, "sheet.html")).href);
    browser("eval", READY);
    browser("screenshot", "--full", join(dir, "sheet.png"));
    mkdirSync(dirname(resolve(out)), { recursive: true });
    copyFileSync(join(dir, "sheet.png"), out);
  } catch (error) {
    if (error.code === "ENOENT") throw new Error("mark.mjs renders in agent-browser, which is not on PATH. Install it with `npm install -g agent-browser`.");
    throw new Error(`agent-browser failed: ${(error.stderr || error.stdout || error.message).trim()}`);
  } finally {
    try {
      browser("close");
    } catch {
      // The session never started, or is already gone.
    }
    rmSync(dir, { recursive: true, force: true });
  }
}

function main(argv) {
  if (argv.length !== 2) {
    console.error(USAGE);
    return 2;
  }
  const [specFile, out] = argv;
  try {
    const spec = JSON.parse(readFileSync(specFile, "utf8"));
    const folder = dirname(resolve(specFile));
    const captures = spec.panes.map((pane) => {
      const png = readFileSync(resolve(folder, pane.file));
      return { label: pane.label, png, capture: pngSize(png, pane.file) };
    });
    const sheet = sheetOf(spec, captures);
    render(pageOf(spec, sheet), sheet.width, out);
    const { width, height } = pngSize(readFileSync(out), out);
    console.log(`${out}: ${width} × ${height}`);
    return 0;
  } catch (error) {
    console.error(error.message);
    return 1;
  }
}

if (process.argv[1] && existsSync(process.argv[1]) && realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exit(main(process.argv.slice(2)));
}
