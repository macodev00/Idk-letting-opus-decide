import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { main, parseArgs } from '../src/cli.js';
import { makeRepo, captureIo } from './helpers.js';

const BIN = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'bin', 'repo-ready.js');

test('parseArgs handles values, = syntax and positionals', () => {
  const a = parseArgs(['some/dir', '--format=json', '--min-score', '80', '--fix', '-o', 'out.json']);
  assert.deepEqual(a._, ['some/dir']);
  assert.equal(a.format, 'json');
  assert.equal(a['min-score'], '80');
  assert.equal(a.fix, true);
  assert.equal(a.output, 'out.json');
  assert.throws(() => parseArgs(['--bogus']), /Unknown option/);
  assert.throws(() => parseArgs(['--format']), /requires a value/);
});

test('--help and --version', async () => {
  const c = captureIo();
  assert.equal(await main(['--help'], c.io), 0);
  assert.match(c.stdout, /Usage/);
  const v = captureIo();
  assert.equal(await main(['--version'], v.io), 0);
  assert.match(v.stdout, /^\d+\.\d+\.\d+\n$/);
});

test('--list-checks prints every check', async () => {
  const c = captureIo();
  assert.equal(await main(['--list-checks'], c.io), 0);
  assert.match(c.stdout, /license\s+error/);
  assert.match(c.stdout, /secrets\s+error/);
});

test('--min-score controls the exit code', async () => {
  const dir = makeRepo();
  assert.equal(await main([dir, '--min-score', '90'], captureIo().io), 1);
  assert.equal(await main([dir, '--min-score', '0'], captureIo().io), 0);
  assert.equal(await main([dir, '--min-score', 'abc'], captureIo().io), 2);
});

test('--strict fails on error-level problems', async () => {
  assert.equal(await main([makeRepo(), '--strict'], captureIo().io), 1);
});

test('json output is valid and complete', async () => {
  const c = captureIo();
  await main([makeRepo(), '--format', 'json'], c.io);
  const report = JSON.parse(c.stdout);
  assert.equal(typeof report.score, 'number');
  assert.ok(Array.isArray(report.results));
});

test('markdown and sarif output', async () => {
  const md = captureIo();
  await main([makeRepo(), '--format', 'markdown'], md.io);
  assert.match(md.stdout, /^## repo-ready: \d+\/100/);
  assert.match(md.stdout, /Top improvements/);

  const sarif = captureIo();
  await main([makeRepo(), '--format', 'sarif'], sarif.io);
  const doc = JSON.parse(sarif.stdout);
  assert.equal(doc.version, '2.1.0');
  assert.ok(doc.runs[0].results.length > 0);
});

test('--output writes the report to a file', async () => {
  const dir = makeRepo();
  const out = path.join(dir, 'report.json');
  const c = captureIo();
  await main([dir, '--format', 'json', '--output', out], c.io);
  assert.equal(typeof JSON.parse(fs.readFileSync(out, 'utf8')).score, 'number');
  assert.match(c.stdout, /Score:/);
});

test('invalid usage exits with 2', async () => {
  assert.equal(await main(['--format', 'xml'], captureIo().io), 2);
  assert.equal(await main(['/definitely/not/a/dir'], captureIo().io), 2);
  assert.equal(await main(['--only', 'nope'], captureIo().io), 2);
});

test('--badge prints a shields.io URL', async () => {
  const c = captureIo();
  await main([makeRepo(), '--badge'], c.io);
  assert.match(c.stdout, /img\.shields\.io\/badge\/repo--ready-\d+%2F100/);
});

test('the bin script runs end to end', () => {
  const dir = makeRepo();
  const out = execFileSync(process.execPath, [BIN, dir, '--fix', '--no-color'], { encoding: 'utf8' });
  assert.match(out, /Created/);
  assert.ok(fs.existsSync(path.join(dir, 'LICENSE')));
});
