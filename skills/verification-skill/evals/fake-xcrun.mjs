// Stands in for `xcrun simctl` in run.test.mjs: list, boot and shut down the simulators whose states FAKE_XCRUN_STATE
// holds, as a JSON object from UDID to state.
import { readFileSync, writeFileSync } from "node:fs";

const [tool, command, udid] = process.argv.slice(2);
const file = process.env.FAKE_XCRUN_STATE;
const states = JSON.parse(readFileSync(file, "utf8"));
if (tool === "xcdevice" && command === "list") {
  if (process.env.FAKE_DEVICE_INVENTORY === "fails") process.exit(1);
  console.log(JSON.stringify([{ identifier: "PHYSICAL-DEVICE-ID", name: "iPhone", simulator: false, available: false }, { identifier: "DEMO-UDID", simulator: true }]));
  process.exit(0);
}
if (tool !== "simctl") process.exit(0);
if (command === "list") {
  const devices = Object.entries(states).map(([id, state]) => ({ udid: id, name: `Demo ${id}`, state }));
  console.log(JSON.stringify({ devices: { "com.apple.CoreSimulator.SimRuntime.iOS-27-0": devices } }));
} else if (command === "boot" || command === "shutdown") {
  writeFileSync(file, JSON.stringify({ ...states, [udid]: command === "boot" ? "Booted" : "Shutdown" }));
} else if (command === "install") {
  console.log(JSON.stringify(process.argv.slice(2)));
  process.exit(0);
} else {
  process.exit(1);
}
