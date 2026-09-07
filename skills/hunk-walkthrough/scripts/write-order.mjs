#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

function usage(message) {
	if (message) {
		console.error(message);
	}
	console.error("usage: write-order.mjs --repo <path> [--ttl-hours <hours>]");
	process.exit(2);
}

const args = process.argv.slice(2);
let repo = null;
let ttlHours = 24;
for (let index = 0; index < args.length; index += 1) {
	const arg = args[index];
	if (arg === "--repo") {
		repo = args[++index] ?? null;
	} else if (arg === "--ttl-hours") {
		ttlHours = Number(args[++index]);
	} else {
		usage(`unknown argument: ${arg}`);
	}
}
if (!repo || !Number.isFinite(ttlHours) || ttlHours <= 0) {
	usage("--repo and a positive --ttl-hours are required");
}

let input;
try {
	input = JSON.parse(readFileSync(0, "utf8"));
} catch {
	usage("stdin must be valid JSON");
}
const files = input?.files;
if (
	!Array.isArray(files) ||
	files.length === 0 ||
	!files.every((path) => typeof path === "string" && path.length > 0) ||
	new Set(files).size !== files.length
) {
	usage('stdin must be {"files":["path", ...]} with unique non-empty paths');
}

const gitPath = execFileSync("git", ["rev-parse", "--git-path", "hunk-walkthrough-order.json"], {
	cwd: repo,
	encoding: "utf8",
	stdio: ["ignore", "pipe", "inherit"],
}).trim();
const outputPath = resolve(repo, gitPath);
const payload = {
	version: 1,
	createdAt: new Date().toISOString(),
	expiresAt: new Date(Date.now() + ttlHours * 60 * 60 * 1000).toISOString(),
	files,
};
mkdirSync(dirname(outputPath), { recursive: true });
const temporaryPath = `${outputPath}.${process.pid}.tmp`;
writeFileSync(temporaryPath, `${JSON.stringify(payload, null, 2)}\n`, { mode: 0o600 });
renameSync(temporaryPath, outputPath);
process.stdout.write(`${outputPath}\n`);
