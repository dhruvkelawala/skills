import { spawnSync } from "node:child_process";
import { appendFileSync, chmodSync, copyFileSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

export function installDeviceGuard(bin, log) {
  const tools = {};
  for (const tool of ["xcrun", "xcodebuild"]) {
    const found = spawnSync("which", [tool], { encoding: "utf8" });
    if (found.status !== 0) throw new Error(`${tool} is required for device guarding`);
    tools[tool] = found.stdout.trim();
  }
  const script = join(bin, "device-guard.mjs");
  const config = join(bin, "device-guard.json");
  copyFileSync(fileURLToPath(import.meta.url), script);
  writeFileSync(config, JSON.stringify({ tools, log }));
  const quote = (s) => `'${s.replaceAll("'", "'\\''")}'`;
  for (const tool of Object.keys(tools)) {
    const wrapper = join(bin, tool);
    writeFileSync(wrapper, `#!/bin/sh\nexec ${[process.execPath, script, "--guard", config, tool].map(quote).join(" ")} "$@"\n`);
    chmodSync(wrapper, 0o755);
  }
}

function guard({ tools, log }, tool, args) {
  const refuse = (why) => {
    const message = `${tool} refused by eval device guard: ${why}`;
    appendFileSync(log, `${new Date().toISOString()} ${message}\n`);
    console.error(message);
    return 1;
  };
  if (args.includes("devicectl") && (args.includes("device") || args.includes("--device"))) return refuse("physical-device operations are disabled");
  const command = [...args];
  while (command[0]?.startsWith("-")) {
    if (["--sdk", "-sdk", "--toolchain", "-toolchain"].includes(command.shift())) command.shift();
  }
  const simulator = tool === "xcrun" && command[0] === "simctl";
  const readOnly = args.length === 0
    || (args.length === 1 && ["-version", "--version", "-help", "--help"].includes(args[0]))
    || (tool === "xcrun" && args.length === 2 && ["--find", "-find"].includes(args[0]))
    || (tool === "xcodebuild" && args.join(" ") === "-license check");
  if (!simulator && !readOnly) {
    const inventory = spawnSync(tools.xcrun, ["xcdevice", "list"], { encoding: "utf8", timeout: 30_000, maxBuffer: 4 << 20 });
    let devices;
    try {
      if (inventory.status !== 0) throw new Error();
      devices = JSON.parse(inventory.stdout);
      if (!Array.isArray(devices)) throw new Error();
    } catch {
      return refuse("could not identify physical devices");
    }
    const text = args.join(" ").toLowerCase();
    const destinations = args.flatMap((arg, i) => arg === "-destination" ? [args[i + 1] ?? ""] : arg.startsWith("-destination=") ? [arg.slice(13)] : []);
    const names = destinations.flatMap((d) => d.split(",").filter((p) => p.startsWith("name=")).map((p) => p.slice(5)));
    for (let i = 0; i < args.length; i++) {
      if (["--device", "-w"].includes(args[i])) names.push(args[i + 1] ?? "");
      if (args[i].startsWith("--device=")) names.push(args[i].slice(9));
    }
    for (const device of devices.filter((d) => d.simulator === false)) {
      if ((device.identifier && text.includes(device.identifier.toLowerCase()))
        || (device.name && names.some((n) => n.toLowerCase() === device.name.toLowerCase()))) return refuse("command names a physical device");
    }
    if (destinations.some((d) => /(?:^|,)platform=(?:iOS|tvOS|watchOS|visionOS)(?:,|$)/i.test(d))) return refuse("destination selects physical hardware");
  }
  const result = spawnSync(tools[tool], args, { stdio: "inherit" });
  return result.status ?? 1;
}

if (process.argv[2] === "--guard") {
  const [, , , config, tool, ...args] = process.argv;
  process.exitCode = guard(JSON.parse(readFileSync(config, "utf8")), tool, args);
}
