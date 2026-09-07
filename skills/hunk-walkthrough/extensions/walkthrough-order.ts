import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { HunkExtensionAPI } from "hunkdiff/extension";

interface WalkthroughOrder {
	version: 1;
	expiresAt: string;
	files: string[];
}

function readWalkthroughOrder(cwd: string): WalkthroughOrder | null {
	try {
		const gitPath = execFileSync(
			"git",
			["rev-parse", "--git-path", "hunk-walkthrough-order.json"],
			{ cwd, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] },
		).trim();
		const parsed = JSON.parse(readFileSync(resolve(cwd, gitPath), "utf8")) as Partial<WalkthroughOrder>;
		const expiresAt = typeof parsed.expiresAt === "string" ? Date.parse(parsed.expiresAt) : Number.NaN;
		if (
			parsed.version !== 1 ||
			!Number.isFinite(expiresAt) ||
			!Array.isArray(parsed.files) ||
			!parsed.files.every((path): path is string => typeof path === "string" && path.length > 0) ||
			expiresAt <= Date.now()
		) {
			return null;
		}
		return parsed as WalkthroughOrder;
	} catch {
		return null;
	}
}

function hasSamePaths(left: readonly string[], right: readonly string[]): boolean {
	if (left.length !== right.length || new Set(left).size !== left.length) {
		return false;
	}
	const expected = new Set(right);
	return left.every((path) => expected.has(path));
}

export default function walkthroughOrderExtension(hunk: HunkExtensionAPI): void {
	hunk.transformChangeset((changeset, ctx) => {
		const order = readWalkthroughOrder(ctx.cwd);
		const currentPaths = changeset.files.map((file) => file.path);
		if (!order || !hasSamePaths(order.files, currentPaths)) {
			return changeset;
		}

		const filesByPath = new Map(changeset.files.map((file) => [file.path, file]));
		return {
			...changeset,
			files: order.files.map((path) => filesByPath.get(path)!),
		};
	});
}
