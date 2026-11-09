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
    if (!(await fileExists(fullPath))) continue;

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
  return null;
}

export async function resolveGitDir(cwd: string): Promise<string | null> {
  try {
    const { stdout } = await execFileAsync(
      "git",
      ["rev-parse", "--absolute-git-dir"],
      { cwd },
    );
    return stdout.trim();
  } catch {
    return null;
  }
}

export function parseHeadBranch(content: string): string | null {
  const refMatch = content.match(/^ref: refs\/heads\/(.+)$/m);
  if (refMatch) return refMatch[1].trim();

  const hashMatch = content.match(/^[0-9a-f]{40}/i);
  return hashMatch ? hashMatch[0].slice(0, 7) : null;
}

async function readHeadBranch(gitDir: string): Promise<string | null> {
  try {
    const headContent = await readFile(join(gitDir, "HEAD"), "utf8");
    return parseHeadBranch(headContent);
  } catch {
    return null;
  }
}

async function execGitBranch(cwd: string): Promise<string> {
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

export async function resolveGitBranch(cwd: string): Promise<string> {
  const gitDir = await resolveGitDir(cwd);
  if (gitDir) {
    const fileBranch = await readHeadBranch(gitDir);
    if (fileBranch) return fileBranch;
  }
  return execGitBranch(cwd);
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
