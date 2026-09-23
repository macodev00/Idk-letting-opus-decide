#!/usr/bin/env node
// Zero-dependency lint: syntax-check every JS file and flag trailing whitespace / missing final newline.
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const DIRS = ['bin', 'src', 'scripts', 'test'];
const problems = [];

function walk(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) return e.name === 'fixtures' ? [] : walk(p);
    return p.endsWith('.js') ? [p] : [];
  });
}

const files = DIRS.flatMap(walk);
for (const file of files) {
  try {
    execFileSync(process.execPath, ['--check', file], { stdio: 'pipe' });
  } catch (err) {
    problems.push(`${file}: syntax error\n${err.stderr}`);
  }
  const text = fs.readFileSync(file, 'utf8');
  text.split('\n').forEach((line, i) => {
    if (/[ \t]+$/.test(line)) problems.push(`${file}:${i + 1}: trailing whitespace`);
  });
  if (!text.endsWith('\n')) problems.push(`${file}: missing final newline`);
}

if (problems.length) {
  console.error(problems.join('\n'));
  process.exit(1);
}
console.log(`lint: ${files.length} files OK`);
