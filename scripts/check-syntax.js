import { readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

const roots = ['src', 'tests', 'scripts'];
const cwd = process.cwd();

function listJsFiles(dir, acc = []) {
  let entries;
  try {
    entries = readdirSync(dir);
  } catch {
    return acc;
  }
  for (const entry of entries) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      listJsFiles(full, acc);
    } else if (entry.endsWith('.js')) {
      acc.push(full);
    }
  }
  return acc;
}

const files = roots.flatMap((r) => listJsFiles(join(cwd, r)));
let failed = 0;
for (const f of files) {
  const res = spawnSync(process.execPath, ['--check', f], { stdio: 'inherit' });
  if (res.status !== 0) failed++;
}
if (failed > 0) {
  console.error(`\nSyntax check FAILED for ${failed} file(s).`);
  process.exit(1);
}
console.log(`\nSyntax check passed for ${files.length} file(s).`);
