import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  parseGitHubRepo,
  loadProjectConfig,
  resolveGitDir,
  resolveGitBranch,
} from "../dist/config/loader.js";

test("loader - parses git remote URLs correctly", () => {
  assert.equal(
    parseGitHubRepo("git@github.com:xifan2333/pi-ghwebhook.git"),
    "xifan2333/pi-ghwebhook",
  );
  assert.equal(
    parseGitHubRepo("https://github.com/xifan2333/pi-ghwebhook.git"),
    "xifan2333/pi-ghwebhook",
  );
  assert.equal(
    parseGitHubRepo("https://github.com/xifan2333/pi-ghwebhook"),
    "xifan2333/pi-ghwebhook",
  );
  assert.equal(parseGitHubRepo("https://gitlab.com/user/repo.git"), null);
});

test("loader - loads .pi/ghwebhook.json correctly", async () => {
  const tempDir = await mkdtemp(join(tmpdir(), "pi-ghwebhook-test-"));
  const piDir = join(tempDir, ".pi");
  await mkdir(piDir, { recursive: true });

  const configContent = {
    name: "Test Workflow",
    on: { push: {} },
    jobs: {
      alert: { prompt: "Pushed" },
    },
  };
  await writeFile(join(piDir, "ghwebhook.json"), JSON.stringify(configContent));

  const loaded = await loadProjectConfig(tempDir);
  assert.ok(loaded != null);
  assert.equal(loaded.name, "Test Workflow");
  assert.ok(loaded.on != null);
  assert.ok(loaded.jobs.alert != null);

  await rm(tempDir, { recursive: true, force: true });
});

test("loader - resolves git directory correctly", async () => {
  const gitDir = await resolveGitDir(process.cwd());
  assert.ok(gitDir != null);
  assert.ok(gitDir.endsWith(".git"));
});

test("loader - resolves git branch correctly via HEAD reading", async () => {
  const branch = await resolveGitBranch(process.cwd());
  assert.ok(typeof branch === "string");
  assert.ok(branch.length > 0);
});
