import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { crc32, deflateSync, inflateSync } from "node:zlib";

const MARK = fileURLToPath(new URL("./mark.mjs", import.meta.url));
const NO_BROWSER = spawnSync("agent-browser", ["--version"]).error ? "agent-browser is not on PATH, and mark.mjs renders in it" : false;

// The captures are generated here, in colours the marked sheet never draws, so the test can find
// each pane, and any capture pixel outside the crop, in the output.
const SCREEN = [214, 232, 250];
const GREEN = [0, 160, 80];
const BLUE = [40, 90, 220];
const RED = [255, 0, 0];
// T3 Code's accent, which the issue asks the circles and arrows to use.
const ACCENT = [255, 61, 113];
const WIDTH = 900;
const HEIGHT = 600;
const TITLE = [100, 100, 200, 60];
const CARD = [500, 350, 160, 80];

function fixture(t) {
  const dir = mkdtempSync(join(tmpdir(), "mark-"));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const capture = (file, blocks, inside = [0, 0, WIDTH, HEIGHT]) =>
    writePng(join(dir, file), WIDTH, HEIGHT, (x, y) => {
      if (!within([x, y], inside)) return RED;
      return blocks.find(([, box]) => within([x, y], box))?.[0] ?? SCREEN;
    });
  const mark = (spec) => {
    writeFileSync(join(dir, "spec.json"), JSON.stringify(spec));
    const out = join(dir, "out", "marked.png");
    return { out, ...spawnSync(process.execPath, [MARK, join(dir, "spec.json"), out], { encoding: "utf8" }) };
  };
  const sheet = (spec) => {
    const run = mark(spec);
    assert.equal(run.status, 0, run.stderr);
    return decodePng(readFileSync(run.out));
  };
  return { capture, mark, sheet };
}

const within = ([x, y], [left, top, width, height]) => x >= left && x < left + width && y >= top && y < top + height;

test("draws every pane under its label, a circle and arrow at each point, and a legend line per mark, at most 1200 px wide", { skip: NO_BROWSER }, (t) => {
  const f = fixture(t);
  f.capture("before.png", [[GREEN, TITLE]]);
  f.capture("after.png", [[GREEN, TITLE], [BLUE, CARD]]);
  const sheet = f.sheet({
    layout: "side",
    panes: [{ file: "before.png", label: "Before" }, { file: "after.png", label: "After" }],
    marks: [
      { n: 1, text: "The title block", at: [[200, 130], [200, 130]] },
      { n: 2, text: "A new blue card", at: [null, [580, 390]] },
    ],
  });

  const panes = panesOf(sheet);
  assert.equal(panes.length, 2, "one pane per capture");
  assert.ok(panes[1].x0 > panes[0].x1, "side by side");
  for (const pane of panes) {
    assert.ok(Math.abs(pane.width / pane.height - WIDTH / HEIGHT) < 0.02, "the whole capture, uncropped");
    assert.ok(inkAbove(sheet, pane) > 30, "a label above the pane");
  }

  const circles = circlesOf(sheet);
  const inPane = panes.map((pane) => circles.filter((circle) => insidePane(circle, pane)).length);
  assert.deepEqual(inPane, [1, 2], "mark 1 on both panes, mark 2 only where its point is not null");
  const legend = circles.filter((circle) => circle.y0 > Math.max(...panes.map((pane) => pane.y1)));
  assert.equal(legend.length, 2, "a legend line for each mark");

  const tips = [[0, [200, 130]], [1, [200, 130]], [1, [580, 390]]];
  for (const [pane, point] of tips) {
    assert.ok(accentNear(sheet, onSheet(panes[pane], point)), `an arrow ends at ${point} on pane ${pane + 1}`);
  }
  // Two 900 px captures side by side are wider than the cap, so the sheet is scaled to it, and it
  // ends just under the legend.
  assert.equal(sheet.width, 1200);
  assert.ok(sheet.height - Math.max(...legend.map((circle) => circle.y1)) < 60, `no empty band under the legend in a ${sheet.height} px sheet`);
});

test("crops every pane to the same region, and each point stays on the spot it names in its capture", { skip: NO_BROWSER }, (t) => {
  const f = fixture(t);
  const crop = [100, 50, 700, 400];
  f.capture("before.png", [[GREEN, TITLE]], crop);
  f.capture("after.png", [[GREEN, TITLE], [BLUE, CARD]], crop);
  const sheet = f.sheet({
    layout: "stack",
    crop,
    panes: [{ file: "before.png", label: "Before" }, { file: "after.png", label: "After" }],
    marks: [
      { n: 1, text: "The blue card is new", at: [null, [580, 390]] },
      { n: 2, text: "The title block", at: [[200, 130], [200, 130]] },
    ],
  });

  assert.equal(blobs(sheet, RED, 40).length, 0, "nothing of either capture outside the crop");
  const panes = panesOf(sheet);
  assert.equal(panes.length, 2, "one pane per capture");
  assert.ok(panes[1].y0 > panes[0].y1, "stacked");
  for (const pane of panes) {
    assert.ok(Math.abs(pane.width - 700) <= 1 && Math.abs(pane.height - 400) <= 1, `a 700 × 400 pane, got ${pane.width} × ${pane.height}`);
  }
  const tips = [[0, [200, 130]], [1, [200, 130]], [1, [580, 390]]];
  for (const [pane, point] of tips) {
    assert.ok(accentNear(sheet, onSheet(panes[pane], point, crop)), `an arrow ends at ${point} on pane ${pane + 1}`);
  }
});

const PAIR = [{ file: "before.png", label: "Before" }, { file: "after.png", label: "After" }];
const refusals = [
  {
    name: "a point inside its capture but outside the crop",
    spec: {
      crop: [100, 50, 700, 400],
      marks: [
        { n: 1, text: "The title block", at: [[200, 130], [200, 130]] },
        { n: 2, text: "The footer", at: [null, [850, 300]] },
      ],
    },
    names: /^- mark 2: its point \[850, 300\] on After is outside the crop \[100, 50, 700, 400\]$/m,
  },
  {
    name: "a crop that runs past a capture",
    spec: { crop: [300, 100, 700, 400], marks: [{ n: 1, text: "The blue card", at: [null, [580, 390]] }] },
    names: /^- crop \[300, 100, 700, 400\] runs past before\.png, which is 900 × 600$/m,
  },
  {
    name: "a mark with one point for two panes",
    spec: { marks: [{ n: 1, text: "The title block", at: [[200, 130]] }] },
    names: /^- mark 1: at has 1 point for 2 panes/m,
  },
];

for (const { name, spec, names } of refusals) {
  test(`refuses ${name}, naming it and why, and writes nothing`, (t) => {
    const f = fixture(t);
    f.capture("before.png", [[GREEN, TITLE]]);
    f.capture("after.png", [[GREEN, TITLE], [BLUE, CARD]]);
    const run = f.mark({ layout: "side", panes: PAIR, ...spec });
    assert.equal(run.status, 1, `expected a refusal, got: ${run.stdout}${run.stderr}`);
    assert.match(run.stderr, names);
    assert.equal(existsSync(run.out), false, "no image written");
  });
}

// The panes are the two largest areas of the capture's screen colour, left to right or top to bottom.
function panesOf(sheet) {
  return blobs(sheet, SCREEN, 10)
    .filter((blob) => blob.pixels > 20000)
    .sort((a, b) => a.x0 - b.x0 || a.y0 - b.y0);
}

// A circle is a near-square accent blob that fills most of its box; an arrow is long and thin.
function circlesOf(sheet) {
  return blobs(sheet, ACCENT, 48).filter((blob) => {
    const square = Math.abs(blob.width - blob.height) <= 3;
    return square && blob.width >= 14 && blob.pixels / (blob.width * blob.height) >= 0.5;
  });
}

const insidePane = (blob, pane) => blob.x0 >= pane.x0 && blob.x1 <= pane.x1 && blob.y0 >= pane.y0 && blob.y1 <= pane.y1;

function onSheet(pane, [x, y], [left, top, width] = [0, 0, WIDTH]) {
  const scale = pane.width / width;
  return [pane.x0 + (x - left) * scale, pane.y0 + (y - top) * scale];
}

function accentNear(sheet, [cx, cy], radius = 6) {
  for (let y = Math.round(cy - radius); y <= cy + radius; y++) {
    for (let x = Math.round(cx - radius); x <= cx + radius; x++) {
      if (near(sheet.at(x, y), ACCENT, 48)) return true;
    }
  }
  return false;
}

// Bright pixels on the dark sheet in the band just above a pane, where its label sits.
function inkAbove(sheet, pane) {
  let ink = 0;
  for (let y = pane.y0 - 34; y < pane.y0 - 2; y++) {
    for (let x = pane.x0; x < pane.x0 + 160; x++) if (Math.max(...sheet.at(x, y)) > 90) ink++;
  }
  return ink;
}

const near = (rgb, colour, tolerance) => rgb.every((value, i) => Math.abs(value - colour[i]) <= tolerance);

function blobs(image, colour, tolerance) {
  const { width, height } = image;
  const seen = new Uint8Array(width * height);
  const found = [];
  for (let start = 0; start < seen.length; start++) {
    if (seen[start] || !near(image.at(start % width, Math.floor(start / width)), colour, tolerance)) continue;
    const blob = { x0: width, y0: height, x1: 0, y1: 0, pixels: 0 };
    const stack = [start];
    seen[start] = 1;
    while (stack.length) {
      const i = stack.pop();
      const x = i % width;
      const y = (i - x) / width;
      Object.assign(blob, { x0: Math.min(blob.x0, x), y0: Math.min(blob.y0, y), x1: Math.max(blob.x1, x), y1: Math.max(blob.y1, y) });
      blob.pixels++;
      for (const [nx, ny] of [[x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1]]) {
        const j = ny * width + nx;
        if (nx < 0 || ny < 0 || nx >= width || ny >= height || seen[j] || !near(image.at(nx, ny), colour, tolerance)) continue;
        seen[j] = 1;
        stack.push(j);
      }
    }
    found.push({ ...blob, width: blob.x1 - blob.x0 + 1, height: blob.y1 - blob.y0 + 1 });
  }
  return found;
}

function writePng(path, width, height, colourAt) {
  const stride = width * 3 + 1;
  const raw = Buffer.alloc(height * stride);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) raw.set(colourAt(x, y), y * stride + 1 + x * 3);
  }
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header.set([8, 2], 8);
  const chunk = (type, data) => {
    const body = Buffer.concat([Buffer.from(type, "latin1"), data]);
    const length = Buffer.alloc(4);
    const check = Buffer.alloc(4);
    length.writeUInt32BE(data.length);
    check.writeUInt32BE(crc32(body));
    return Buffer.concat([length, body, check]);
  };
  const signature = Buffer.from("89504e470d0a1a0a", "hex");
  writeFileSync(path, Buffer.concat([signature, chunk("IHDR", header), chunk("IDAT", deflateSync(raw)), chunk("IEND", Buffer.alloc(0))]));
}

// 8-bit RGB or RGBA, not interlaced, which is what Chromium's screenshots are.
function decodePng(buffer) {
  const data = [];
  let width;
  let height;
  let channels;
  for (let at = 8; at < buffer.length;) {
    const length = buffer.readUInt32BE(at);
    const type = buffer.toString("latin1", at + 4, at + 8);
    const body = buffer.subarray(at + 8, at + 8 + length);
    if (type === "IHDR") {
      [width, height] = [body.readUInt32BE(0), body.readUInt32BE(4)];
      assert.equal(body[8], 8, "8 bits per channel");
      channels = { 2: 3, 6: 4 }[body[9]];
    }
    if (type === "IDAT") data.push(body);
    at += length + 12;
  }
  const stride = width * channels;
  const raw = inflateSync(Buffer.concat(data));
  const pixels = Buffer.alloc(height * stride);
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)];
    for (let i = 0; i < stride; i++) {
      const left = i >= channels ? pixels[y * stride + i - channels] : 0;
      const up = y > 0 ? pixels[(y - 1) * stride + i] : 0;
      const corner = i >= channels && y > 0 ? pixels[(y - 1) * stride + i - channels] : 0;
      const predicted = [0, left, up, (left + up) >> 1, paeth(left, up, corner)][filter];
      pixels[y * stride + i] = (raw[y * (stride + 1) + 1 + i] + predicted) & 255;
    }
  }
  const at = (x, y) => {
    if (x < 0 || y < 0 || x >= width || y >= height) return [0, 0, 0];
    const i = Math.floor(y) * stride + Math.floor(x) * channels;
    return [pixels[i], pixels[i + 1], pixels[i + 2]];
  };
  return { width, height, at };
}

function paeth(left, up, corner) {
  const guess = left + up - corner;
  const [a, b, c] = [Math.abs(guess - left), Math.abs(guess - up), Math.abs(guess - corner)];
  return a <= b && a <= c ? left : b <= c ? up : corner;
}
