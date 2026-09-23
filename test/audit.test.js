import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { audit, score, grade, checks } from '../src/index.js';
import { renderLicense } from '../src/licenses.js';
import { makeRepo, result, GOOD_README } from './helpers.js';

const completeRepo = () => makeRepo({
  'package.json': { name: 'demo', description: 'd', repository: 'x/y', keywords: ['a'], license: 'MIT', scripts: { test: 'node --test' } },
  'package-lock.json': '{}',
  'README.md': GOOD_README,
  LICENSE: renderLicense('MIT', { holder: 'Test' }),
  'CONTRIBUTING.md': '# Contributing',
  'CODE_OF_CONDUCT.md': '# CoC',
  'SECURITY.md': '# Security',
  '.github/ISSUE_TEMPLATE/bug.yml': 'name: bug',
  '.github/PULL_REQUEST_TEMPLATE.md': '## PR',
  '.github/workflows/ci.yml': 'name: CI',
  '.github/dependabot.yml': 'version: 2',
  'CHANGELOG.md': '# Changelog',
  '.gitignore': 'node_modules/',
  'AGENTS.md': '# Agents',
  'test/index.test.js': '',
});

test('an empty directory scores poorly', () => {
  const report = audit(makeRepo());
  assert.ok(report.score < 30, `score ${report.score}`);
  assert.equal(report.grade, 'F');
  assert.equal(result(report, 'license').status, 'fail');
  assert.equal(result(report, 'readme').status, 'fail');
});

test('a complete repository scores 100', () => {
  const report = audit(completeRepo());
  const failing = report.results.filter((r) => r.status === 'fail').map((r) => `${r.id}: ${r.message}`);
  assert.deepEqual(failing, []);
  assert.equal(report.score, 100);
  assert.equal(report.grade, 'A');
});

test('--fix creates missing files and raises the score', () => {
  const dir = makeRepo({
    'package.json': { name: 'demo', description: 'd', repository: 'x/y', keywords: ['a'], license: 'Apache-2.0', author: 'Ada Lovelace <ada@example.com>', scripts: { test: 'node --test' } },
    'README.md': GOOD_README.replace('[MIT](LICENSE)', 'Apache-2.0'),
    'test/a.test.js': '',
  });
  const before = audit(dir).score;
  const report = audit(dir, { fix: true, contact: 'security@example.com' });
  assert.ok(report.score > before);
  assert.ok(report.score >= 95, `score ${report.score}`);
  const created = report.fixed.map((f) => f.file);
  for (const f of ['LICENSE', 'CONTRIBUTING.md', 'CODE_OF_CONDUCT.md', 'SECURITY.md', '.github/workflows/ci.yml', '.gitignore', 'AGENTS.md', '.github/dependabot.yml']) {
    assert.ok(created.includes(f), `${f} not created`);
    assert.ok(fs.existsSync(path.join(dir, f)));
  }
  const license = fs.readFileSync(path.join(dir, 'LICENSE'), 'utf8');
  assert.match(license, /Apache License/, 'uses license declared in package.json');
  assert.match(fs.readFileSync(path.join(dir, 'SECURITY.md'), 'utf8'), /security@example\.com/);
  assert.match(fs.readFileSync(path.join(dir, '.github/workflows/ci.yml'), 'utf8'), /npm test/);
  assert.doesNotMatch(fs.readFileSync(path.join(dir, '.github/workflows/ci.yml'), 'utf8'), /cache: npm/, 'no cache without lockfile');
  assert.equal(result(report, 'license-consistency').status, 'pass');
});

test('--fix never overwrites existing files', () => {
  const dir = makeRepo({ 'CONTRIBUTING.md': 'mine', '.github/ISSUE_TEMPLATE/config.yml': 'mine' });
  audit(dir, { fix: true });
  assert.equal(fs.readFileSync(path.join(dir, 'CONTRIBUTING.md'), 'utf8'), 'mine');
  assert.equal(fs.readFileSync(path.join(dir, '.github/ISSUE_TEMPLATE/config.yml'), 'utf8'), 'mine');
  assert.ok(fs.existsSync(path.join(dir, '.github/ISSUE_TEMPLATE/bug_report.yml')));
});

test('--fix --dry-run writes nothing', () => {
  const dir = makeRepo();
  const report = audit(dir, { fix: true, dryRun: true });
  assert.ok(report.fixed.length > 0);
  assert.deepEqual(fs.readdirSync(dir), []);
});

test('--fix with an explicit license and holder', () => {
  const dir = makeRepo();
  audit(dir, { fix: true, license: 'bsd-3-clause', holder: 'ACME Inc.' });
  const text = fs.readFileSync(path.join(dir, 'LICENSE'), 'utf8');
  assert.match(text, /ACME Inc\./);
  assert.match(text, /Neither the name/);
  assert.throws(() => audit(dir, { fix: true, license: 'nope' }), /Unsupported license/);
});

test('generates python CI and dependabot config', () => {
  const dir = makeRepo({ 'pyproject.toml': '[project]\nname = "pydemo"\n' });
  audit(dir, { fix: true, only: ['ci', 'dependency-updates', 'gitignore'] });
  assert.match(fs.readFileSync(path.join(dir, '.github/workflows/ci.yml'), 'utf8'), /setup-python/);
  assert.match(fs.readFileSync(path.join(dir, '.github/dependabot.yml'), 'utf8'), /package-ecosystem: pip/);
  assert.match(fs.readFileSync(path.join(dir, '.gitignore'), 'utf8'), /__pycache__/);
});

test('generates CI for Java, Ruby, PHP and .NET projects', () => {
  const cases = [
    [{ 'pom.xml': '<project/>' }, [/setup-java@v6/, /cache: maven/, /mvn -B verify/]],
    [{ 'build.gradle': '' }, [/setup-gradle@v6/, /\.\/gradlew build/]],
    [{ Gemfile: '', 'spec/a_spec.rb': '' }, [/setup-ruby@v1/, /bundle exec rspec/]],
    [{ Gemfile: '' }, [/bundle exec rake$/m]],
    [{ 'composer.json': { scripts: { test: 'phpunit' } } }, [/setup-php@v2/, /composer test/]],
    [{ 'composer.json': {} }, [/vendor\/bin\/phpunit/]],
    [{ 'App.csproj': '<Project/>' }, [/setup-dotnet@v6/, /dotnet test --no-build/]],
  ];
  for (const [files, patterns] of cases) {
    const dir = makeRepo(files);
    audit(dir, { fix: true, only: ['ci'] });
    const wf = fs.readFileSync(path.join(dir, '.github/workflows/ci.yml'), 'utf8');
    for (const p of patterns) assert.match(wf, p, `${Object.keys(files)[0]}: ${p}`);
  }
});

test('license-consistency catches mismatches', () => {
  const dir = makeRepo({ LICENSE: renderLicense('MIT'), 'package.json': { name: 'x', license: 'Apache-2.0' } });
  const r = result(audit(dir), 'license-consistency');
  assert.equal(r.status, 'fail');
  assert.match(r.message, /MIT.*Apache-2\.0/);
});

test('license-consistency accepts SPDX expressions', () => {
  const dir = makeRepo({ LICENSE: renderLicense('MIT'), 'package.json': { name: 'x', license: '(MIT OR Apache-2.0)' } });
  assert.equal(result(audit(dir), 'license-consistency').status, 'pass');
});

test('readme-links reports broken relative links only', () => {
  const dir = makeRepo({
    'README.md': `${GOOD_README}\n[ok](docs/guide.md) [anchor](#usage) [web](https://example.com) [bad](docs/missing.md) ![img](assets/logo.png)\n\n[ref]: ./also-missing.md\n`,
    'docs/guide.md': '#',
    'CONTRIBUTING.md': '#',
    LICENSE: 'x',
  });
  const r = result(audit(dir), 'readme-links');
  assert.equal(r.status, 'fail');
  assert.deepEqual(r.details.sort(), ['./also-missing.md', 'assets/logo.png', 'docs/missing.md']);
});

test('readme-sections lists what is missing', () => {
  const dir = makeRepo({ 'README.md': `# x\n\n## Usage\n\n${'word '.repeat(60)}` });
  const r = result(audit(dir), 'readme-sections');
  assert.equal(r.status, 'fail');
  assert.match(r.message, /installation, license, contributing/);
});

test('detects committed .env files with credentials but allows examples', () => {
  const dir = makeRepo({
    '.env': 'API_KEY=abc123def456',
    'app/.env.production': 'export DB_PASSWORD="s3cr3t-value"',
    '.env.example': 'API_KEY=abc123def456',
    'web/.env': '# settings\nTERMINAL_WIDTH=3000\nSECRET_KEY=\n',
  });
  const r = result(audit(dir), 'env-files');
  assert.equal(r.status, 'fail');
  assert.deepEqual(r.details.sort(), ['.env', 'app/.env.production']);
});

test('harmless .env files pass', () => {
  const dir = makeRepo({ '.env': 'TERMINAL_WIDTH=3000\nNODE_ENV=development\n' });
  const r = result(audit(dir, { only: ['env-files'] }), 'env-files');
  assert.equal(r.status, 'pass');
  assert.match(r.message, /none with credential-like values/);
});

test('readme-sections accepts install commands and license mentions in the body', () => {
  const dir = makeRepo({ 'README.md': `# x\n\n${'word '.repeat(60)}\n\n\`\`\`sh\nnpm install x\n\`\`\`\n\n\`\`\`js\nx()\n\`\`\`\n\nMIT licensed. Contributions welcome!\n` });
  assert.equal(result(audit(dir, { only: ['readme-sections'] }), 'readme-sections').status, 'pass');
});

test('recognizes MIT-LICENSE and other license file names', () => {
  for (const name of ['MIT-LICENSE', 'LICENSE-MIT', 'UNLICENSE', 'COPYING', 'license.rst']) {
    const dir = makeRepo({ [name]: renderLicense('MIT') });
    assert.equal(result(audit(dir, { only: ['license'] }), 'license').status, 'pass', name);
  }
  const dir = makeRepo({ 'docs/LICENSE': renderLicense('MIT') });
  assert.equal(result(audit(dir, { only: ['license'] }), 'license').status, 'fail');
});

test('monorepo package changelogs count', () => {
  const dir = makeRepo({ 'packages/core/CHANGELOG.md': '#', 'activerecord/CHANGELOG.md': '#' });
  assert.equal(result(audit(dir, { only: ['changelog'] }), 'changelog').status, 'pass');
});

test('fixture directories do not trip env-files or gitignore', () => {
  const dir = makeRepo({
    '.gitignore': 'node_modules',
    'playground/env/.env': 'A=1',
    'src/__tests__/env/.env.production': 'A=1',
    'test/fixtures/pkg/node_modules/x/index.js': '',
  });
  const report = audit(dir, { only: ['env-files', 'gitignore'] });
  assert.equal(result(report, 'env-files').status, 'pass');
  assert.equal(result(report, 'gitignore').status, 'pass');
});

test('recognizes other CI providers and docs locations', () => {
  const dir = makeRepo({ '.gitlab-ci.yml': 'x', 'docs/CONTRIBUTING.md': 'x', '.github/SECURITY.md': 'x' });
  const report = audit(dir);
  assert.equal(result(report, 'ci').status, 'pass');
  assert.equal(result(report, 'contributing').status, 'pass');
  assert.equal(result(report, 'security-policy').status, 'pass');
});

test('config file can skip checks', () => {
  const dir = makeRepo({ '.repo-ready.json': JSON.stringify({ skip: ['agents-md', 'changelog'], minScore: 50 }) });
  const report = audit(dir);
  assert.equal(result(report, 'agents-md'), undefined);
  assert.equal(result(report, 'changelog'), undefined);
  assert.equal(report.minScore, 50);
});

test('package.json "repo-ready" key is used as config', () => {
  const dir = makeRepo({ 'package.json': { name: 'x', 'repo-ready': { skip: ['tests'] } } });
  assert.equal(result(audit(dir), 'tests'), undefined);
});

test('unknown check ids are rejected', () => {
  assert.throws(() => audit(makeRepo(), { only: ['nope'] }), /Unknown check "nope"/);
});

test('private packages skip the metadata check', () => {
  const dir = makeRepo({ 'package.json': { name: 'x', private: true } });
  assert.equal(result(audit(dir), 'package-metadata').status, 'skip');
});

test('score and grade', () => {
  assert.equal(score([]), 100);
  assert.equal(score([{ status: 'pass', severity: 'error' }, { status: 'fail', severity: 'error' }]), 50);
  assert.equal(score([{ status: 'skip', severity: 'error' }, { status: 'pass', severity: 'info' }]), 100);
  assert.equal(grade(95), 'A');
  assert.equal(grade(85), 'B');
  assert.equal(grade(70), 'C');
  assert.equal(grade(55), 'D');
  assert.equal(grade(10), 'F');
});

test('every check has the required metadata', () => {
  const ids = new Set();
  for (const c of checks) {
    assert.ok(c.id && c.title && c.description && c.category, c.id);
    assert.ok(['error', 'warning', 'info'].includes(c.severity), c.id);
    assert.ok(!ids.has(c.id), `duplicate ${c.id}`);
    ids.add(c.id);
  }
});
