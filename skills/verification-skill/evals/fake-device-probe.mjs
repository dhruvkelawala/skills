import { spawnSync } from "node:child_process";

export function probeDevices() {
  const run = (tool, args) => spawnSync(tool, args, { encoding: "utf8" }).status;
  return {
    install: run("xcrun", ["devicectl", "device", "install", "app", "--device", "PHYSICAL-DEVICE-ID", "demo.app"]),
    process: run("xcrun", ["devicectl", "device", "process", "launch", "--device", "PHYSICAL-DEVICE-ID", "demo"]),
    build: run("xcodebuild", ["-destination", "id=PHYSICAL-DEVICE-ID", "build"]),
    xcrunBuild: run("xcrun", ["xcodebuild", "-destination", "id=PHYSICAL-DEVICE-ID", "build"]),
    simulator: run("xcrun", ["simctl", "install", "DEMO-UDID", "demo.app"]),
    simulatorBuild: run("xcodebuild", ["-destination", "platform=iOS Simulator,id=DEMO-UDID", "build"]),
  };
}
