#!/usr/bin/env node
/** Builds each TypeScript test against a vscode stub, then runs every test. */
import { execFileSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as url from 'node:url';

const root = path.join(path.dirname(url.fileURLToPath(import.meta.url)), '..');
const testDir = path.join(root, 'test');
const outDir = path.join(testDir, 'out');
fs.mkdirSync(outDir, { recursive: true });

const ts = fs.readdirSync(testDir).filter((f) => f.endsWith('.test.ts'));
const mjs = fs.readdirSync(testDir).filter((f) => f.endsWith('.test.mjs'));

const run = (file, args) => {
  process.stdout.write(`\n── ${file} ${'─'.repeat(Math.max(0, 56 - file.length))}\n`);
  try {
    execFileSync(process.execPath, args, { stdio: 'inherit', cwd: root });
    return true;
  } catch {
    return false;
  }
};

let failures = 0;

for (const file of ts) {
  const out = path.join(outDir, file.replace(/\.ts$/, '.js'));
  execFileSync(
    path.join(root, 'node_modules', '.bin', 'esbuild'),
    [path.join(testDir, file), '--bundle', `--outfile=${out}`, '--platform=node',
     '--format=cjs', `--alias:vscode=${path.join(testDir, 'stub', 'vscode.js')}`, '--log-level=error'],
    { stdio: 'inherit', cwd: root },
  );
  if (!run(file, [out])) failures++;
}

for (const file of mjs) {
  if (!run(file, [path.join(testDir, file)])) failures++;
}

console.log(`\n${'='.repeat(60)}`);
console.log(failures === 0 ? 'ALL SUITES PASSED' : `${failures} SUITE(S) FAILED`);
process.exit(failures ? 1 : 0);
