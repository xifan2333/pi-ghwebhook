import { readFile, access } from "node:fs/promises";
import { join } from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { GhWebhookWorkflow } from "../types/schema.js";

const execFileAsync = promisify(execFile);

const CONFIG_CANDIDATES = [
  ".pi/ghwebhook.json",
  ".agents/ghwebhook.json",
  "ghwebhook.json",
];

async function fileExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

export async function loadProjectConfig(
  cwd: string,
): Promise<GhWebhookWorkflow | null> {
  for (const relPath of CONFIG_CANDIDATES) {
    const fullPath = join(cwd, relPath);
    if (await fileExists(fullPath)) {
      try {
        const content = await readFile(fullPath, "utf8");
        const parsed = JSON.parse(content) as GhWebhookWorkflow;
        if (parsed && typeof parsed === "object" && parsed.on && parsed.jobs) {
          return parsed;
        }
      } catch (err) {
        console.error(
          `[pi-ghwebhook] Failed to load config from ${fullPath}:`,
          err,
        );
      }
    }
  }
  return null;
}

export async function resolveGitBranch(cwd: string): Promise<string> {
  try {
    const { stdout } = await execFileAsync(
      "git",
      ["rev-parse", "--abbrev-ref", "HEAD"],
      { cwd },
    );
    return stdout.trim();
  } catch {
    return "main";
  }
}

export function parseGitHubRepo(remoteUrl: string): string | null {
  const normalized = remoteUrl.trim();
  const match = normalized.match(
    /github\.com[:/]([a-zA-Z0-9_.-]+)\/([a-zA-Z0-9_.-]+?)(?:\.git)?$/i,
  );
  if (!match) return null;
  return `${match[1]}/${match[2]}`;
}

export async function resolveGitRepo(cwd: string): Promise<string | null> {
  try {
    const { stdout } = await execFileAsync(
      "git",
      ["remote", "get-url", "origin"],
      { cwd },
    );
    return parseGitHubRepo(stdout);
  } catch {
    return null;
  }
}
