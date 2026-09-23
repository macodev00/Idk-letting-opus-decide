import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { audit } from '../src/index.js';
import { main } from '../src/cli.js';
import { makeRepo, result, captureIo } from './helpers.js';

const token = 'ghp_' + 'Zq9'.repeat(12);

function git(dir, ...args) {
  return execFileSync('git', ['-c', 'user.name=Test', '-c', 'user.email=test@example.com', '-c', 'commit.gpgsign=false', ...args], { cwd: dir, encoding: 'utf8' });
}

function repoWithDeletedSecret() {
  const dir = makeRepo({ 'config.js': `export const token = "${token}";\n`, 'tests/fake.js': `"${token}"\n` });
  git(dir, 'init', '-q');
  git(dir, 'add', '-A');
  git(dir, 'commit', '-qm', 'add config');
  fs.writeFileSync(path.join(dir, 'config.js'), 'export const token = process.env.TOKEN;\n');
  git(dir, 'commit', '-qam', 'remove token');
  return dir;
}

test('history scanning is off by default', () => {
  const report = audit(repoWithDeletedSecret());
  assert.equal(result(report, 'secrets').status, 'pass');
  assert.equal(result(report, 'secrets-history').status, 'skip');
});

test('--history finds secrets deleted in later commits', () => {
  const dir = repoWithDeletedSecret();
  const first = git(dir, 'rev-list', '--max-parents=0', 'HEAD').trim().slice(0, 7);
  const r = result(audit(dir, { history: true }), 'secrets-history');
  assert.equal(r.status, 'fail');
  assert.equal(r.details.length, 1, 'test paths are skipped and duplicates collapsed');
  assert.match(r.details[0], new RegExp(`^config\\.js GitHub token \\(ghp_.+\\) in commit ${first}$`));
  assert.ok(!r.details[0].includes(token), 'secret is redacted');
});

test('history scan passes on a clean history and via config', () => {
  const dir = makeRepo({ 'a.js': 'ok\n', '.repo-ready.json': JSON.stringify({ secrets: { history: true } }) });
  git(dir, 'init', '-q');
  git(dir, 'add', '-A');
  git(dir, 'commit', '-qm', 'init');
  const r = result(audit(dir), 'secrets-history');
  assert.equal(r.status, 'pass');
  assert.match(r.message, /Scanned 1 commit/);
});

test('history check skips outside git repositories', () => {
  assert.equal(result(audit(makeRepo(), { history: true }), 'secrets-history').status, 'skip');
});

test('CLI --history flag', async () => {
  const c = captureIo();
  const code = await main([repoWithDeletedSecret(), '--history', '--strict', '--only', 'secrets-history'], c.io);
  assert.equal(code, 1);
  assert.match(c.stdout, /No secrets in git history/);
});
