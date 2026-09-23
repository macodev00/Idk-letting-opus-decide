import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { run, input } from '../src/action.js';
import { makeRepo } from './helpers.js';

function actionEnv(dir, inputs = {}) {
  const env = { GITHUB_WORKSPACE: dir, GITHUB_OUTPUT: path.join(dir, '.out'), GITHUB_STEP_SUMMARY: path.join(dir, '.summary') };
  for (const [k, v] of Object.entries(inputs)) env[`INPUT_${k.toUpperCase()}`] = v;
  return env;
}

const sink = () => {
  const chunks = [];
  return { write: (s) => chunks.push(s), get text() { return chunks.join(''); } };
};

test('input() reads hyphenated and underscored names', () => {
  assert.equal(input('min-score', { 'INPUT_MIN-SCORE': ' 80 ' }), '80');
  assert.equal(input('min-score', { INPUT_MIN_SCORE: '70' }), '70');
  assert.equal(input('missing', {}), '');
});

test('writes outputs, summary and annotations', () => {
  const dir = makeRepo();
  const out = sink();
  const code = run(actionEnv(dir), out);
  assert.equal(code, 0);
  const outputs = fs.readFileSync(path.join(dir, '.out'), 'utf8');
  assert.match(outputs, /^score=\d+$/m);
  assert.match(outputs, /^grade=[A-F]$/m);
  assert.match(outputs, /^badge-url=https:\/\/img\.shields\.io/m);
  assert.match(fs.readFileSync(path.join(dir, '.summary'), 'utf8'), /## repo-ready/);
  assert.match(out.text, /::error title=repo-ready%3A License file::No LICENSE file found\./);
});

test('min-score and strict fail the step', () => {
  assert.equal(run(actionEnv(makeRepo(), { 'min-score': '95' }), sink()), 1);
  assert.equal(run(actionEnv(makeRepo(), { strict: 'true' }), sink()), 1);
  assert.throws(() => run(actionEnv(makeRepo(), { 'min-score': 'high' }), sink()), /must be a number/);
});

test('fix and sarif-file inputs', () => {
  const dir = makeRepo();
  run(actionEnv(dir, { fix: 'true', license: 'ISC', 'sarif-file': 'results.sarif', summary: 'false' }), sink());
  assert.match(fs.readFileSync(path.join(dir, 'LICENSE'), 'utf8'), /^ISC License/);
  assert.equal(JSON.parse(fs.readFileSync(path.join(dir, 'results.sarif'), 'utf8')).version, '2.1.0');
  assert.ok(!fs.existsSync(path.join(dir, '.summary')));
  assert.match(fs.readFileSync(path.join(dir, '.out'), 'utf8'), /^fixed=.*LICENSE/m);
});
