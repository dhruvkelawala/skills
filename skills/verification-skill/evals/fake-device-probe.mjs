import { spawnSync } from "node:child_process";

export function probeDevices() {
  const run = (tool, args) => spawnSync(tool, args, { encoding: "utf8" }).status;
  const simulator = spawnSync("xcrun", ["simctl", "install", "DEMO-UDID", "demo.app"], { encoding: "utf8" });
  const simulatorBuild = spawnSync("xcodebuild", ["-destination", "platform=iOS Simulator,id=DEMO-UDID", "build"], { encoding: "utf8" });
  return {
    install: run("xcrun", ["devicectl", "device", "install", "app", "--device", "PHYSICAL-DEVICE-ID", "demo.app"]),
    process: run("xcrun", ["devicectl", "device", "process", "launch", "--device", "PHYSICAL-DEVICE-ID", "demo"]),
    build: run("xcodebuild", ["-destination", "id=PHYSICAL-DEVICE-ID", "build"]),
    xcrunBuild: run("xcrun", ["xcodebuild", "-destination", "id=PHYSICAL-DEVICE-ID", "build"]),
    simulator: simulator.status,
    simulatorOutput: simulator.stdout.trim(),
    simulatorBuild: simulatorBuild.status,
    simulatorBuildOutput: simulatorBuild.stdout.trim(),
  };
}
