#!/usr/bin/env node
// GitHub Action entry point. Reads INPUT_* variables and writes a job summary, outputs and annotations.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { audit } from './index.js';
import * as reporters from './reporters.js';

const pkg = JSON.parse(fs.readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'package.json'), 'utf8'));

export function input(name, env = process.env) {
  return (env[`INPUT_${name.toUpperCase()}`] ?? env[`INPUT_${name.toUpperCase().replace(/-/g, '_')}`] ?? '').trim();
}

const bool = (v) => /^(true|yes|1|on)$/i.test(v);
const list = (v) => v.split(/[\s,]+/).filter(Boolean);
const escapeData = (s) => String(s).replace(/%/g, '%25').replace(/\r/g, '%0D').replace(/\n/g, '%0A');
const escapeProp = (s) => escapeData(s).replace(/:/g, '%3A').replace(/,/g, '%2C');

function setOutput(name, value, env) {
  if (env.GITHUB_OUTPUT) fs.appendFileSync(env.GITHUB_OUTPUT, `${name}=${value}\n`);
}

export function run(env = process.env, stdout = process.stdout) {
  const workspace = env.GITHUB_WORKSPACE || process.cwd();
  const root = path.resolve(workspace, input('path', env) || '.');
  const minScoreRaw = input('min-score', env);
  const minScore = minScoreRaw ? Number(minScoreRaw) : undefined;
  if (minScoreRaw && !Number.isFinite(minScore)) throw new Error(`min-score must be a number, got "${minScoreRaw}"`);

  const report = audit(root, {
    fix: bool(input('fix', env)),
    license: input('license', env) || undefined,
    contact: input('contact', env) || undefined,
    only: list(input('only', env)),
    skip: list(input('skip', env)),
    minScore,
  });

  stdout.write(reporters.text(report, { color: true }));

  for (const r of report.results.filter((x) => x.status === 'fail')) {
    const level = r.severity === 'error' ? 'error' : r.severity === 'warning' ? 'warning' : 'notice';
    const fileDetail = (r.details || []).map((d) => String(d).match(/^([^\s:]+):(\d+)\b/)).find(Boolean);
    const loc = fileDetail ? `file=${escapeProp(fileDetail[1])},line=${fileDetail[2]},` : '';
    stdout.write(`::${level} ${loc}title=${escapeProp(`repo-ready: ${r.title}`)}::${escapeData(r.message)}\n`);
  }

  if (env.GITHUB_STEP_SUMMARY && !/^false$/i.test(input('summary', env))) {
    fs.appendFileSync(env.GITHUB_STEP_SUMMARY, reporters.markdown(report));
  }

  const sarifPath = input('sarif-file', env);
  if (sarifPath) fs.writeFileSync(path.resolve(workspace, sarifPath), reporters.sarif(report, { version: pkg.version }));

  setOutput('score', report.score, env);
  setOutput('grade', report.grade, env);
  setOutput('failed', report.counts.fail, env);
  setOutput('fixed', report.fixed.map((f) => f.file).join(','), env);
  setOutput('badge-url', reporters.badge(report), env);

  if (report.minScore != null && report.score < report.minScore) {
    stdout.write(`::error title=repo-ready::Score ${report.score} is below the minimum of ${report.minScore}\n`);
    return 1;
  }
  if (bool(input('strict', env)) && report.results.some((r) => r.status === 'fail' && r.severity === 'error')) {
    stdout.write('::error title=repo-ready::Error-level checks failed (strict mode)\n');
    return 1;
  }
  return 0;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  try {
    process.exitCode = run();
  } catch (err) {
    process.stdout.write(`::error title=repo-ready::${escapeData(err.message)}\n`);
    process.exitCode = 1;
  }
}
