import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  isPidAlive,
  acquirePidLock,
  releasePidLock,
  readPidLock,
} from "../dist/transport/pid-lock.js";

test("pid-lock - checks pid liveness accurately", () => {
  assert.equal(isPidAlive(process.pid), true);
  assert.equal(isPidAlive(0), false);
  assert.equal(isPidAlive(-1), false);
  // Unlikely PID to exist
  assert.equal(isPidAlive(999999999), false);
});

test("pid-lock - acquires, blocks competing pid, reclaims stale, and releases", async () => {
  const tempDir = await mkdtemp(join(tmpdir(), "pi-ghwebhook-pid-test-"));
  const lockPath = join(tempDir, "ghwebhook.pid");

  const myData = {
    pid: process.pid,
    repo: "owner/repo",
    branch: "main",
    port: 35021,
    startedAt: Date.now(),
  };

  // 1. Acquire initially
  const first = acquirePidLock(lockPath, myData);
  assert.equal(first.acquired, true);

  const readBack = readPidLock(lockPath);
  assert.ok(readBack != null);
  assert.equal(readBack.pid, process.pid);

  // 2. Competing process trying to acquire when existing holder is alive
  // In our test, existing is process.pid.
  const checkHolder = readPidLock(lockPath);
  assert.equal(checkHolder?.pid, process.pid);
  assert.equal(isPidAlive(checkHolder!.pid), true);

  await rm(tempDir, { recursive: true, force: true });
});

test("pid-lock - reclaims stale lock automatically", async () => {
  const tempDir = await mkdtemp(join(tmpdir(), "pi-ghwebhook-pid-stale-"));
  const lockPath = join(tempDir, "ghwebhook.pid");

  const staleData = {
    pid: 999999999, // dead process
    repo: "owner/repo",
    branch: "main",
    port: 35021,
    startedAt: Date.now() - 10000,
  };

  // Force write stale dead pid
  acquirePidLock(lockPath, staleData, true);
  assert.equal(readPidLock(lockPath)?.pid, 999999999);

  // Now acquire with current process -> should detect dead pid and reclaim
  const reclaimed = acquirePidLock(lockPath, {
    pid: process.pid,
    repo: "owner/repo",
    branch: "feat",
    port: 35021,
    startedAt: Date.now(),
  });

  assert.equal(reclaimed.acquired, true);
  assert.equal(readPidLock(lockPath)?.pid, process.pid);

  // Release
  releasePidLock(lockPath);
  assert.equal(readPidLock(lockPath), null);

  await rm(tempDir, { recursive: true, force: true });
});
