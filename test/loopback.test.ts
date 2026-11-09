import test from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { LoopbackServer } from "../dist/transport/loopback.js";
import type { WebhookPayload } from "../dist/types/payload.js";

test("loopback - receives and dispatches webhook event", async () => {
  const events: Array<{ event: string; payload: WebhookPayload }> = [];

  const server = new LoopbackServer({
    onEvent: (event, payload) => {
      events.push({ event, payload });
    },
  });

  const port = await server.start();
  assert.ok(port > 0);

  const payload = { action: "completed", check: true };
  const res = await fetch(`http://127.0.0.1:${port}/webhook`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-GitHub-Event": "workflow_run",
    },
    body: JSON.stringify(payload),
  });

  assert.equal(res.status, 200);
  const data = (await res.json()) as { received: boolean };
  assert.equal(data.received, true);

  // Give microtask queue time to deliver
  await new Promise((r) => setTimeout(r, 50));

  assert.equal(events.length, 1);
  assert.equal(events[0].event, "workflow_run");
  assert.equal(events[0].payload.check, true);

  await server.stop();
});

test("loopback - verifies signature correctly", async () => {
  const secret = "test-secret-123";
  let received = false;

  const server = new LoopbackServer({
    secret,
    onEvent: () => {
      received = true;
    },
  });

  const port = await server.start();
  const rawBody = JSON.stringify({ ping: "pong" });
  const signature =
    "sha256=" + createHmac("sha256", secret).update(rawBody).digest("hex");

  // Valid signature
  const resValid = await fetch(`http://127.0.0.1:${port}/webhook`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-GitHub-Event": "ping",
      "X-Hub-Signature-256": signature,
    },
    body: rawBody,
  });
  assert.equal(resValid.status, 200);

  // Give microtask queue time to deliver
  await new Promise((r) => setTimeout(r, 50));
  assert.equal(received, true);

  // Invalid signature
  const resInvalid = await fetch(`http://127.0.0.1:${port}/webhook`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-GitHub-Event": "ping",
      "X-Hub-Signature-256": "sha256=invalid-signature-hash",
    },
    body: rawBody,
  });
  assert.equal(resInvalid.status, 401);

  await server.stop();
});
