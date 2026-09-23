#!/usr/bin/env node
// Renders real `repo-ready` output for a sample repository into docs/demo.svg.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const bin = path.join(root, 'bin', 'repo-ready.js');

const sample = fs.mkdtempSync(path.join(os.tmpdir(), 'my-cool-lib-'));
const target = path.join(sample, 'my-cool-lib');
fs.mkdirSync(path.join(target, 'src'), { recursive: true });
fs.writeFileSync(path.join(target, 'package.json'), JSON.stringify({ name: 'my-cool-lib', version: '0.1.0', license: 'MIT', scripts: { test: 'node --test' } }, null, 2));
fs.writeFileSync(path.join(target, 'README.md'), '# my-cool-lib\n\nA tiny library.\n\nSee [the docs](docs/usage.md).\n');
fs.writeFileSync(path.join(target, 'src', 'index.js'), `export const client = new Client({ token: "${'ghp_' + 'x7Kd9'.repeat(8)}" });\n`);
fs.writeFileSync(path.join(target, '.env'), 'DATABASE_URL=postgres://localhost/dev\n');

const run = (args) => execFileSync(process.execPath, [bin, ...args], { cwd: target, env: { ...process.env, FORCE_COLOR: '1' }, encoding: 'utf8' });
const first = run(['.']).replace(target, '~/my-cool-lib');
const fixed = run(['.', '--fix']);
const plain = (l) => l.replace(/\x1b\[\d+m/g, '');
const created = fixed.split('\n').filter((l) => /^\s+\+ |^Score/.test(plain(l)));

const lines = [
  '\x1b[32m$\x1b[0m npx repo-ready',
  ...first.trim().split('\n'),
  '',
  '\x1b[32m$\x1b[0m npx repo-ready --fix',
  '\x1b[2m  ...\x1b[0m',
  ...created,
];

const PALETTE = { 1: null, 2: '#8b949e', 31: '#ff7b72', 32: '#3fb950', 33: '#d29922', 36: '#39c5cf' };
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function toTspans(line) {
  const out = [];
  let color = null;
  let bold = false;
  for (const part of line.split(/(\x1b\[\d+m)/)) {
    const m = part.match(/^\x1b\[(\d+)m$/);
    if (m) {
      const code = Number(m[1]);
      if (code === 0) { color = null; bold = false; } else if (code === 1) bold = true; else color = PALETTE[code] || color;
      continue;
    }
    if (!part) continue;
    const attrs = [color && `fill="${color}"`, bold && 'font-weight="bold"'].filter(Boolean).join(' ');
    out.push(attrs ? `<tspan ${attrs}>${esc(part)}</tspan>` : esc(part));
  }
  return out.join('');
}

const lineHeight = 19;
const width = Math.ceil(Math.max(...lines.map((l) => l.replace(/\x1b\[\d+m/g, '').length)) * 8.2) + 40;
const height = 48 + lines.length * lineHeight + 16;
const body = lines.map((l, i) => `<text x="20" y="${56 + i * lineHeight}" xml:space="preserve">${toTspans(l)}</text>`).join('\n  ');

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="repo-ready terminal demo">
  <rect width="${width}" height="${height}" rx="10" fill="#0d1117"/>
  <circle cx="22" cy="20" r="6" fill="#ff5f56"/><circle cx="42" cy="20" r="6" fill="#ffbd2e"/><circle cx="62" cy="20" r="6" fill="#27c93f"/>
  <g font-family="ui-monospace, SFMono-Regular, Menlo, Consolas, monospace" font-size="13.5" fill="#e6edf3">
  ${body}
  </g>
</svg>
`;

fs.mkdirSync(path.join(root, 'docs'), { recursive: true });
fs.writeFileSync(path.join(root, 'docs', 'demo.svg'), svg);
fs.rmSync(sample, { recursive: true, force: true });
console.log(`docs/demo.svg (${lines.length} lines)`);
