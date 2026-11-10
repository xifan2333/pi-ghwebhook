import test from "node:test";
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import type { ChildProcess } from "node:child_process";
import { GhForwarder } from "../dist/transport/forwarder.js";

class MockChildProcess extends EventEmitter implements Partial<ChildProcess> {
  stdout = new EventEmitter();
  stderr = new EventEmitter();
  killed = false;

  kill(_signal?: NodeJS.Signals | number): boolean {
    this.killed = true;
    this.emit("exit", 0, "SIGTERM");
    return true;
  }
}

test("forwarder - starts and transitions to running, stops to stopped", () => {
  let mockChild: MockChildProcess | null = null;
  const statusHistory: string[] = [];

  const forwarder = new GhForwarder({
    repo: "owner/repo",
    url: "http://127.0.0.1:35021/webhook",
    spawnFn: () => {
      mockChild = new MockChildProcess();
      return mockChild as unknown as ChildProcess;
    },
    onStatusChange: (status) => statusHistory.push(status),
  });

  assert.equal(forwarder.getStatus(), "idle");
  forwarder.start();

  assert.equal(forwarder.getStatus(), "running");
  assert.equal(forwarder.isRunning(), true);

  forwarder.stop();
  assert.equal(forwarder.getStatus(), "stopped");
  assert.equal(forwarder.isRunning(), false);
  assert.deepEqual(statusHistory, ["running", "stopped"]);
});

test("forwarder - unexpected exit triggers reconnect and exponential backoff", async () => {
  let mockChild: MockChildProcess | null = null;
  const statusHistory: string[] = [];

  const forwarder = new GhForwarder({
    repo: "owner/repo",
    url: "http://127.0.0.1:35021/webhook",
    minRetryDelayMs: 20, // fast test interval
    maxRetryDelayMs: 100,
    spawnFn: () => {
      mockChild = new MockChildProcess();
      return mockChild as unknown as ChildProcess;
    },
    onStatusChange: (status) => statusHistory.push(status),
  });

  forwarder.start();
  assert.equal(forwarder.getStatus(), "running");

  // Simulate child process unexpected crash (e.g. network timeout)
  mockChild!.emit("exit", 1, null);

  assert.equal(forwarder.getStatus(), "reconnecting");
  assert.equal(forwarder.getRetryCount(), 1);

  // Wait for reconnect timer to fire
  await new Promise((r) => setTimeout(r, 50));

  // Should have restarted
  assert.equal(forwarder.getStatus(), "running");

  forwarder.stop();
});

test("forwarder - cleans up stale hooks when 'Hook already exists' is detected", async () => {
  let mockChild: MockChildProcess | null = null;
  let cleanedRepo = "";

  const forwarder = new GhForwarder({
    repo: "owner/repo",
    url: "http://127.0.0.1:35021/webhook",
    minRetryDelayMs: 20,
    spawnFn: () => {
      mockChild = new MockChildProcess();
      return mockChild as unknown as ChildProcess;
    },
    cleanupStaleHooks: async (repo) => {
      cleanedRepo = repo;
      return true;
    },
  });

  forwarder.start();

  // Simulate stderr with Hook already exists and then exit
  mockChild!.stderr.emit(
    "data",
    Buffer.from(
      "Error: error creating webhook: HTTP 422: Validation Failed\nHook already exists on this repository\n",
    ),
  );
  mockChild!.emit("exit", 1, null);

  // Wait a microtask tick for async cleanup handler
  await new Promise((r) => setTimeout(r, 10));

  assert.equal(cleanedRepo, "owner/repo");
  forwarder.stop();
});

test("forwarder - resets retryCount on successful data output", () => {
  let mockChild: MockChildProcess | null = null;

  const forwarder = new GhForwarder({
    repo: "owner/repo",
    url: "http://127.0.0.1:35021/webhook",
    minRetryDelayMs: 20,
    spawnFn: () => {
      mockChild = new MockChildProcess();
      return mockChild as unknown as ChildProcess;
    },
  });

  forwarder.start();
  mockChild!.emit("exit", 1, null);
  assert.equal(forwarder.getRetryCount(), 1);

  // Restarted
  forwarder.start();
  mockChild!.stdout.emit(
    "data",
    Buffer.from("Forwarding Webhook events from GitHub...\n"),
  );

  assert.equal(forwarder.getRetryCount(), 0);
  forwarder.stop();
});
