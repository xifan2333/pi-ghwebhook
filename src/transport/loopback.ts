import {
  createServer,
  type Server,
  type IncomingMessage,
  type ServerResponse,
} from "node:http";
import { createHmac, timingSafeEqual } from "node:crypto";
import type { WebhookPayload } from "../types/payload.js";

export type WebhookEventHandler = (
  event: string,
  payload: WebhookPayload,
) => void | Promise<void>;

export interface LoopbackOptions {
  port?: number;
  secret?: string;
  getStatus?: () => Record<string, unknown>;
  onEvent: WebhookEventHandler;
}

export class LoopbackServer {
  private server: Server | null = null;
  private port = 0;
  private readonly targetPort: number;
  private readonly secret?: string;
  private readonly getStatus?: () => Record<string, unknown>;
  private readonly onEvent: WebhookEventHandler;

  constructor(options: LoopbackOptions) {
    this.targetPort = options.port ?? 0;
    this.secret = options.secret;
    this.getStatus = options.getStatus;
    this.onEvent = options.onEvent;
  }

  getPort(): number {
    return this.port;
  }

  getUrl(): string {
    return `http://127.0.0.1:${this.port}/webhook`;
  }

  async start(): Promise<number> {
    this.server = createServer((req, res) => {
      this.handleRequest(req, res);
    });

    return new Promise((resolve, reject) => {
      this.server!.once("error", reject);
      this.server!.listen(this.targetPort, "127.0.0.1", () => {
        const addr = this.server!.address();
        if (typeof addr === "object" && addr !== null) {
          this.port = addr.port;
          resolve(this.port);
        } else {
          reject(new Error("Failed to get loopback server port"));
        }
      });
    });
  }

  async stop(): Promise<void> {
    if (!this.server) return;
    const s = this.server;
    this.server = null;
    return new Promise((resolve) => {
      s.close(() => resolve());
    });
  }

  private handleRequest(req: IncomingMessage, res: ServerResponse): void {
    if (req.method === "GET") {
      res.writeHead(200, { "Content-Type": "application/json" });
      const statusData = this.getStatus
        ? this.getStatus()
        : { status: "active", package: "pi-ghwebhook", port: this.port };
      res.end(JSON.stringify(statusData, null, 2));
      return;
    }

    if (req.method !== "POST") {
      res.writeHead(405, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Method Not Allowed" }));
      return;
    }

    const event = req.headers["x-github-event"];
    if (typeof event !== "string") {
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Missing X-GitHub-Event header" }));
      return;
    }

    const signature = req.headers["x-hub-signature-256"];
    const chunks: Buffer[] = [];

    req.on("data", (chunk: Buffer) => {
      chunks.push(chunk);
    });

    req.on("end", () => {
      const rawBody = Buffer.concat(chunks);

      if (this.secret && !this.verifySignature(rawBody, signature)) {
        res.writeHead(401, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Invalid signature" }));
        return;
      }

      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ received: true }));

      try {
        const payload = JSON.parse(rawBody.toString("utf8")) as WebhookPayload;
        Promise.resolve(this.onEvent(event, payload)).catch((err) => {
          console.error("[pi-ghwebhook] Error handling event:", err);
        });
      } catch (err) {
        console.error("[pi-ghwebhook] Failed to parse JSON body:", err);
      }
    });
  }

  private verifySignature(
    rawBody: Buffer,
    signature: string | string[] | undefined,
  ): boolean {
    if (typeof signature !== "string" || !signature.startsWith("sha256=")) {
      return false;
    }

    const hmac = createHmac("sha256", this.secret!)
      .update(rawBody)
      .digest("hex");
    const expected = `sha256=${hmac}`;

    if (signature.length !== expected.length) {
      return false;
    }

    return timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
  }
}
