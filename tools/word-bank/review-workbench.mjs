import path from "node:path";
import { fileURLToPath } from "node:url";

import { recoverStaleReviewLock } from "./review-store.js";
import { createReviewWorkbenchServer } from "./review-workbench-server.js";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDir, "..", "..");
const reviewDataRoot = path.join(scriptDir, "review-data");
const args = parseArgs(process.argv.slice(2));

if (args.recoverStaleLock) {
  await recoverStaleReviewLock({
    root: reviewDataRoot,
    confirmed: args.confirmNoWriter,
  });
}

const server = await createReviewWorkbenchServer({
  projectRoot,
  reviewDataRoot,
  port: args.port,
});
const address = await server.listen();

console.log(`Word Bank review workbench: ${address.origin}`);
console.log(
  server.mode === "writable"
    ? "Mode: writable (this process holds the review-data lock)."
    : "Mode: read-only (another process holds the review-data lock).",
);
console.log("Press Ctrl+C to stop. The workbench never stages, commits, publishes, or deploys.");

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.once(signal, async () => {
    await server.close();
    process.exit(0);
  });
}

function parseArgs(rawArgs) {
  const parsed = {
    port: 4177,
    recoverStaleLock: false,
    confirmNoWriter: false,
  };

  for (let index = 0; index < rawArgs.length; index += 1) {
    const arg = rawArgs[index];

    if (arg === "--port") {
      parsed.port = Number(rawArgs[index + 1]);
      index += 1;
    } else if (arg === "--recover-stale-lock") {
      parsed.recoverStaleLock = true;
    } else if (arg === "--confirm-no-writer") {
      parsed.confirmNoWriter = true;
    } else {
      throw new Error(`Unknown review-workbench option: ${arg}`);
    }
  }

  if (!Number.isInteger(parsed.port) || parsed.port < 0 || parsed.port > 65535) {
    throw new Error("Workbench port must be an integer from 0 to 65535.");
  }

  if (parsed.confirmNoWriter && !parsed.recoverStaleLock) {
    throw new Error("--confirm-no-writer is valid only with --recover-stale-lock.");
  }

  return parsed;
}
