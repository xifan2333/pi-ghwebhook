import {
  existsSync,
  readFileSync,
  writeFileSync,
  unlinkSync,
  mkdirSync,
} from "node:fs";
import { dirname } from "node:path";

export interface PidLockData {
  pid: number;
  repo: string;
  branch: string;
  port: number;
  startedAt: number;
}

export function isPidAlive(pid: number): boolean {
  if (typeof pid !== "number" || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (err: unknown) {
    const code = (err as NodeJS.ErrnoException)?.code;
    return code === "EPERM";
  }
}

export function readPidLock(lockPath: string): PidLockData | null {
  if (!existsSync(lockPath)) return null;
  try {
    const raw = readFileSync(lockPath, "utf8");
    const data = JSON.parse(raw) as PidLockData;
    if (
      typeof data === "object" &&
      data !== null &&
      typeof data.pid === "number"
    ) {
      return data;
    }
  } catch {
    // corrupted or unreadable lockfile
  }
  return null;
}

export interface AcquireResult {
  acquired: boolean;
  holder?: PidLockData;
}

export function acquirePidLock(
  lockPath: string,
  data: PidLockData,
  force = false,
): AcquireResult {
  const existing = readPidLock(lockPath);

  if (
    existing &&
    isPidAlive(existing.pid) &&
    existing.pid !== process.pid &&
    !force
  ) {
    return { acquired: false, holder: existing };
  }

  try {
    mkdirSync(dirname(lockPath), { recursive: true });
    writeFileSync(lockPath, JSON.stringify(data, null, 2) + "\n");
    return { acquired: true };
  } catch {
    return { acquired: false };
  }
}

export function releasePidLock(lockPath: string): void {
  try {
    const existing = readPidLock(lockPath);
    if (existing && existing.pid === process.pid) {
      unlinkSync(lockPath);
    }
  } catch {
    // ignore release errors
  }
}
