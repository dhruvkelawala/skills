import test from "node:test";
import assert from "node:assert/strict";

import { strain } from "./strain.mjs";

const HOME = "/Users/me";
const GB_IN_KIB = 1e9 / 1024;

const df = (freeGb) =>
  "Filesystem 1024-blocks Used Available Capacity Mounted on\n" +
  `/dev/disk3s5 971350180 751611340 ${Math.round(freeGb * GB_IN_KIB)} 81% /System/Volumes/Data\n`;

const du = [
  `${117187500}\t${HOME}/Library/Developer`,
  `${48828125}\t${HOME}/Library/Caches`,
  `${292968750}\t${HOME}/Library`,
  `${97656250}\t${HOME}/development/app`,
  `${195312500}\t${HOME}/development`,
  `${500000000}\t${HOME}`,
].join("\n");

const ps = [
  "  2249136 /System/Library/Frameworks/Virtualization.framework/XPCServices/VirtualMachine.xpc/Contents/MacOS/VirtualMachine",
  "  3000000 /Applications/Helium.app/Contents/Frameworks/Helium Framework.framework/Helpers/Helium Helper (Renderer).app/Contents/MacOS/Helium Helper (Renderer)",
  "  1000000 /Applications/Helium.app/Contents/MacOS/Helium",
  "   574736 opencode",
].join("\n");

const meminfo = (availableKib) => `MemTotal:       32000000 kB\nMemFree:          100000 kB\nMemAvailable:   ${availableKib} kB\n`;

function machine(outputs) {
  return async (command, args) => {
    const key = [command, ...args].join(" ");
    if (!(key in outputs)) throw new Error(`unexpected command: ${key}`);
    if (outputs[key] instanceof Error) throw outputs[key];
    return outputs[key];
  };
}

const mac = ({ freeGb, level }) =>
  machine({
    [`df -kP ${HOME}`]: df(freeGb),
    "sysctl -n kern.memorystatus_vm_pressure_level": `${level}\n`,
    [`du -xkd 2 ${HOME}`]: du,
    "ps -A -o rss=,comm=": ps,
  });

test("the strain line appears only under 50 GB free or at memory warning, naming the biggest cause", async () => {
  const cases = [
    { name: "fine", freeGb: 190, level: 1, line: "" },
    { name: "exactly 50 GB is not under 50", freeGb: 50, level: 1, line: "" },
    {
      name: "low disk",
      freeGb: 38,
      level: 1,
      line: "Strain: 38 GB free on disk, biggest ~/Library (300 GB, of which ~/Library/Developer 120 GB).",
    },
    {
      name: "memory warning",
      freeGb: 190,
      level: 2,
      line: "Strain: memory pressure at warning, biggest Helium (4.1 GB in 2 processes).",
    },
    {
      name: "both, memory critical",
      freeGb: 7.5,
      level: 4,
      line:
        "Strain: 7.5 GB free on disk, biggest ~/Library (300 GB, of which ~/Library/Developer 120 GB); " +
        "memory pressure at critical, biggest Helium (4.1 GB in 2 processes).",
    },
  ];
  for (const { name, freeGb, level, line } of cases) {
    assert.equal(await strain({ platform: "darwin", home: HOME, run: mac({ freeGb, level }) }), line, name);
  }
});

test("a folder scan that runs out of time still reports the low disk", async () => {
  const run = machine({
    [`df -kP ${HOME}`]: df(38),
    "sysctl -n kern.memorystatus_vm_pressure_level": "1\n",
    [`du -xkd 2 ${HOME}`]: Object.assign(new Error(`Command failed: du -xkd 2 ${HOME}`), { killed: true, signal: "SIGTERM" }),
  });
  assert.equal(
    await strain({ platform: "darwin", home: HOME, run }),
    "Strain: 38 GB free on disk, biggest folder unknown (du found no answer in 5 minutes).",
  );
});

test("on Linux, memory pressure comes from the share of memory still available", async () => {
  const linux = (availableKib) =>
    machine({
      [`df -kP ${HOME}`]: df(190),
      "cat /proc/meminfo": meminfo(availableKib),
      "ps -A -o rss=,comm=": "  6100000 node\n  2000000 node\n   300000 bash\n",
    });
  assert.equal(await strain({ platform: "linux", home: HOME, run: linux(9_000_000) }), "");
  assert.equal(
    await strain({ platform: "linux", home: HOME, run: linux(2_880_000) }),
    "Strain: memory pressure at warning, biggest node (8.3 GB in 2 processes).",
  );
  assert.equal(
    await strain({ platform: "linux", home: HOME, run: linux(1_280_000) }),
    "Strain: memory pressure at critical, biggest node (8.3 GB in 2 processes).",
  );
});

test("a platform with no memory pressure reading fails instead of reporting no strain", async () => {
  await assert.rejects(strain({ platform: "win32", home: HOME, run: machine({ [`df -kP ${HOME}`]: df(190) }) }), /win32/);
});
