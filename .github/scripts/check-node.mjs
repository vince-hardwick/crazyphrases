import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

export function assertSupportedNode(version = process.versions.node, ci = false) {
  const parts = /^(\d+)\.(\d+)\.(\d+)$/.exec(version);
  const [major, minor, patch] = parts ? parts.slice(1).map(Number) : [];
  const supported22 = !ci && major === 22 && (minor > 23 || (minor === 23 && patch >= 4));
  const supported24 = major === 24 && (minor > 22 || (minor === 22 && patch >= 1));
  if (!supported22 && !supported24) {
    throw new Error(`Use ${ci ? 'Node 24.22.1+ within 24.x' : 'Node 22.23.4+ within 22.x or 24.22.1+ within 24.x'}; found ${version}.`);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  assertSupportedNode(process.versions.node, process.argv.includes('--ci'));
}
