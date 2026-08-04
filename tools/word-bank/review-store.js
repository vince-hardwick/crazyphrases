import { createHash, randomUUID } from "node:crypto";
import {
  mkdir,
  open,
  readFile,
  rename,
  rm,
  writeFile,
} from "node:fs/promises";
import path from "node:path";

const LOCK_FILE_NAME = ".review.lock";

export async function openReviewStore({ root } = {}) {
  const resolvedRoot = path.resolve(root ?? "");
  await mkdir(resolvedRoot, { recursive: true });
  const lockPath = path.join(resolvedRoot, LOCK_FILE_NAME);
  const ownerToken = randomUUID();
  let mode = "writable";

  try {
    const lockHandle = await open(lockPath, "wx");
    await lockHandle.writeFile(
      `${JSON.stringify({
        ownerToken,
        pid: process.pid,
        startedAt: new Date().toISOString(),
      })}\n`,
      "utf8",
    );
    await lockHandle.close();
  } catch (error) {
    if (error?.code !== "EEXIST") {
      throw error;
    }

    mode = "readOnly";
  }

  let closed = false;

  return {
    mode,
    root: resolvedRoot,
    async load(relativePath) {
      assertOpen(closed);
      const targetPath = resolveReviewPath(resolvedRoot, relativePath);
      const source = await readFile(targetPath, "utf8");
      return {
        data: JSON.parse(source),
        hash: hashText(source),
      };
    },
    async save(relativePath, replacement, { expectedHash, validate } = {}) {
      assertOpen(closed);

      if (mode !== "writable") {
        throw new Error("This review workbench instance is read-only.");
      }

      if (typeof validate !== "function") {
        throw new Error("A complete replacement validator is required.");
      }

      validate(replacement);
      const targetPath = resolveReviewPath(resolvedRoot, relativePath);
      const currentSource = await readFile(targetPath, "utf8");

      if (hashText(currentSource) !== expectedHash) {
        throw new Error(
          `${relativePath} changed outside the workbench; reload before saving.`,
        );
      }

      const replacementSource = `${JSON.stringify(replacement, null, 2)}\n`;
      const temporaryPath = path.join(
        path.dirname(targetPath),
        `.${path.basename(targetPath)}.${ownerToken}.tmp`,
      );

      try {
        await writeFile(temporaryPath, replacementSource, {
          encoding: "utf8",
          flag: "wx",
        });
        await rename(temporaryPath, targetPath);
      } catch (error) {
        await rm(temporaryPath, { force: true });
        throw error;
      }

      return {
        data: replacement,
        hash: hashText(replacementSource),
      };
    },
    async close() {
      if (closed) {
        return;
      }

      closed = true;

      if (mode !== "writable") {
        return;
      }

      const lock = await readLock(lockPath);

      if (lock?.ownerToken === ownerToken) {
        await rm(lockPath, { force: true });
      }
    },
  };
}

export async function recoverStaleReviewLock({
  root,
  confirmed,
  isProcessRunning = defaultIsProcessRunning,
} = {}) {
  if (confirmed !== true) {
    throw new Error("Stale-lock recovery requires explicit confirmation.");
  }

  const lockPath = path.join(path.resolve(root ?? ""), LOCK_FILE_NAME);
  const lock = await readLock(lockPath);

  if (!lock) {
    return;
  }

  if (Number.isInteger(lock.pid) && isProcessRunning(lock.pid)) {
    throw new Error(`Writable review process ${lock.pid} is still running.`);
  }

  await rm(lockPath, { force: true });
}

function resolveReviewPath(root, relativePath) {
  const targetPath = path.resolve(root, String(relativePath ?? ""));

  if (targetPath !== root && !targetPath.startsWith(`${root}${path.sep}`)) {
    throw new Error("The requested path is outside review-data.");
  }

  return targetPath;
}

async function readLock(lockPath) {
  try {
    return JSON.parse(await readFile(lockPath, "utf8"));
  } catch (error) {
    if (error?.code === "ENOENT") {
      return null;
    }

    throw error;
  }
}

function defaultIsProcessRunning(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return error?.code === "EPERM";
  }
}

function hashText(value) {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function assertOpen(closed) {
  if (closed) {
    throw new Error("The review store is closed.");
  }
}
