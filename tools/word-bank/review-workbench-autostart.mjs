import { closeSync, openSync } from "node:fs";
import { mkdir, readFile } from "node:fs/promises";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const defaultProjectRoot = path.resolve(scriptDir, "..", "..");

export function isExpectedWritableReviewService({
  health,
  lock,
  projectRoot,
  reviewDataRoot,
}) {
  return Boolean(
    health?.service === "crazyphrases-word-bank-review" &&
      health.mode === "writable" &&
      Number.isInteger(health.pid) &&
      health.pid === lock?.pid &&
      samePath(health.projectRoot, projectRoot) &&
      samePath(health.reviewDataRoot, reviewDataRoot),
  );
}

export function isLockFromPreviousBoot(lock, bootStartedAt) {
  const lockStartedAt = Date.parse(lock?.startedAt);
  const bootTime = new Date(bootStartedAt).getTime();
  return Number.isFinite(lockStartedAt) && Number.isFinite(bootTime) && lockStartedAt < bootTime;
}

export async function ensureReviewWorkbench({
  projectRoot = defaultProjectRoot,
  reviewDataRoot = path.join(projectRoot, "tools", "word-bank", "review-data"),
  port = 4177,
  bootStartedAt = new Date(Date.now() - os.uptime() * 1000),
  startupTimeoutMs = 15_000,
  probePort = isTcpPortOpen,
  requestHealth = fetchReviewHealth,
  launchServer = spawnReviewServer,
  wait = delay,
} = {}) {
  const resolvedProjectRoot = path.resolve(projectRoot);
  const resolvedReviewDataRoot = path.resolve(reviewDataRoot);
  const lockPath = path.join(resolvedReviewDataRoot, ".review.lock");
  const origin = `http://127.0.0.1:${port}`;

  if (await probePort(port)) {
    const [health, lock] = await Promise.all([
      requestHealth(origin).catch(() => null),
      readReviewLock(lockPath),
    ]);
    if (
      isExpectedWritableReviewService({
        health,
        lock,
        projectRoot: resolvedProjectRoot,
        reviewDataRoot: resolvedReviewDataRoot,
      })
    ) {
      return { status: "already-running", origin, pid: health.pid };
    }
    throw new Error(
      `${origin} is occupied by an unverified or different service; refusing to start another review writer.`,
    );
  }

  const existingLock = await readReviewLock(lockPath);
  let recoverPreviousBootLock = false;
  if (existingLock) {
    if (!isLockFromPreviousBoot(existingLock, bootStartedAt)) {
      throw new Error(
        "The review lock was created during the current boot or has invalid metadata; use the explicit manual stale-lock recovery after confirming no writer remains.",
      );
    }
    recoverPreviousBootLock = true;
  }

  const child = await launchServer({
    projectRoot: resolvedProjectRoot,
    port,
    recoverPreviousBootLock,
  });
  const deadline = Date.now() + startupTimeoutMs;

  while (Date.now() < deadline) {
    if (child.exitCode !== null) {
      throw new Error(
        `The Word Bank review server exited during startup with code ${child.exitCode}; inspect output/word-bank-review/server-error.log.`,
      );
    }

    if (await probePort(port)) {
      const [health, lock] = await Promise.all([
        requestHealth(origin).catch(() => null),
        readReviewLock(lockPath),
      ]);
      if (
        isExpectedWritableReviewService({
          health,
          lock,
          projectRoot: resolvedProjectRoot,
          reviewDataRoot: resolvedReviewDataRoot,
        })
      ) {
        return { status: "started", origin, pid: health.pid };
      }
    }

    await wait(200);
  }

  throw new Error(
    `The Word Bank review server did not become a verified writable service within ${startupTimeoutMs}ms.`,
  );
}

async function spawnReviewServer({ projectRoot, port, recoverPreviousBootLock }) {
  const logRoot = path.join(projectRoot, "output", "word-bank-review");
  await mkdir(logRoot, { recursive: true });
  const outputHandle = openSync(path.join(logRoot, "server-output.log"), "a");
  const errorHandle = openSync(path.join(logRoot, "server-error.log"), "a");
  const args = [
    path.join(projectRoot, "tools", "word-bank", "review-workbench.mjs"),
    "--port",
    String(port),
  ];
  if (recoverPreviousBootLock) {
    args.push("--recover-stale-lock", "--confirm-no-writer");
  }

  try {
    const child = spawn(process.execPath, args, {
      cwd: projectRoot,
      detached: true,
      stdio: ["ignore", outputHandle, errorHandle],
      windowsHide: true,
    });
    child.unref();
    return child;
  } finally {
    closeSync(outputHandle);
    closeSync(errorHandle);
  }
}

async function readReviewLock(lockPath) {
  try {
    return JSON.parse(await readFile(lockPath, "utf8"));
  } catch (error) {
    if (error?.code === "ENOENT") {
      return null;
    }
    throw error;
  }
}

async function fetchReviewHealth(origin) {
  const response = await fetch(`${origin}/api/health`, {
    signal: AbortSignal.timeout(1_500),
  });
  if (!response.ok) {
    throw new Error(`Health request returned HTTP ${response.status}.`);
  }
  return response.json();
}

function isTcpPortOpen(port) {
  return new Promise((resolve) => {
    const socket = net.createConnection({ host: "127.0.0.1", port });
    const finish = (result) => {
      socket.destroy();
      resolve(result);
    };
    socket.setTimeout(750);
    socket.once("connect", () => finish(true));
    socket.once("timeout", () => finish(false));
    socket.once("error", () => finish(false));
  });
}

function samePath(left, right) {
  if (typeof left !== "string" || typeof right !== "string") {
    return false;
  }
  const normalise = (value) => {
    const resolved = path.resolve(value);
    return process.platform === "win32" ? resolved.toLowerCase() : resolved;
  };
  return normalise(left) === normalise(right);
}

function delay(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function parseArgs(rawArgs) {
  const parsed = { port: 4177 };
  for (let index = 0; index < rawArgs.length; index += 1) {
    const arg = rawArgs[index];
    if (arg === "--port") {
      parsed.port = Number(rawArgs[index + 1]);
      index += 1;
    } else {
      throw new Error(`Unknown review-workbench-autostart option: ${arg}`);
    }
  }
  if (!Number.isInteger(parsed.port) || parsed.port < 1 || parsed.port > 65535) {
    throw new Error("Autostart port must be an integer from 1 to 65535.");
  }
  return parsed;
}

const invokedUrl = process.argv[1] ? pathToFileURL(path.resolve(process.argv[1])).href : null;
if (invokedUrl === import.meta.url) {
  try {
    const args = parseArgs(process.argv.slice(2));
    const result = await ensureReviewWorkbench({ port: args.port });
    console.log(`PASS: Word Bank review workbench ${result.status} at ${result.origin} (PID ${result.pid}).`);
  } catch (error) {
    console.error(`FAIL: ${error.message}`);
    process.exitCode = 1;
  }
}
