import fs from 'node:fs';
import path from 'node:path';
import { createContext } from './context.js';
import { checks, SEVERITY_WEIGHT, findReadme } from './checks.js';
import { applyFixes, isFixable } from './fix.js';

export { checks } from './checks.js';
export { detectLicense, renderLicense, SUPPORTED_LICENSES } from './licenses.js';
export { scanText, SECRET_RULES } from './secrets.js';

export function loadConfig(root) {
  const file = path.join(root, '.repo-ready.json');
  if (fs.existsSync(file)) {
    try {
      return JSON.parse(fs.readFileSync(file, 'utf8'));
    } catch (err) {
      throw new Error(`Invalid JSON in .repo-ready.json: ${err.message}`);
    }
  }
  try {
    const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
    if (pkg['repo-ready'] && typeof pkg['repo-ready'] === 'object') return pkg['repo-ready'];
  } catch {
    // no package.json or not JSON
  }
  return {};
}

function selectChecks({ only = [], skip = [] }) {
  const known = new Set(checks.map((c) => c.id));
  for (const id of [...only, ...skip]) {
    if (!known.has(id)) throw new Error(`Unknown check "${id}". Run with --list-checks to see all checks.`);
  }
  return checks.filter((c) => (!only.length || only.includes(c.id)) && !skip.includes(c.id));
}

export function score(results) {
  let total = 0;
  let earned = 0;
  for (const r of results) {
    if (r.status === 'skip') continue;
    const w = SEVERITY_WEIGHT[r.severity];
    total += w;
    if (r.status === 'pass') earned += w;
  }
  return total ? Math.round((earned / total) * 100) : 100;
}

export function grade(value) {
  if (value >= 90) return 'A';
  if (value >= 80) return 'B';
  if (value >= 65) return 'C';
  if (value >= 50) return 'D';
  return 'F';
}

function runAll(ctx, selected) {
  ctx.state.readmeFile = findReadme(ctx);
  return selected.map((check) => {
    let result;
    try {
      result = check.run(ctx);
    } catch (err) {
      result = { status: 'fail', message: `Check crashed: ${err.message}` };
    }
    return {
      id: check.id,
      title: check.title,
      category: check.category,
      severity: check.severity,
      description: check.description,
      fixable: isFixable(check.id),
      details: [],
      ...result,
    };
  });
}

/**
 * Audit a repository. With `fix: true`, missing files are generated and the audit re-runs.
 */
export function audit(root = '.', options = {}) {
  const config = { ...loadConfig(path.resolve(root)), ...(options.config || {}) };
  if (options.history) config.secrets = { ...config.secrets, history: true };
  const selected = selectChecks({
    only: options.only?.length ? options.only : config.only || [],
    skip: [...(config.skip || []), ...(options.skip || [])],
  });

  let ctx = createContext(root);
  ctx.config = config;
  ctx.state = {};
  let results = runAll(ctx, selected);
  let fixed = [];

  if (options.fix) {
    fixed = applyFixes(ctx, results, options);
    if (fixed.length && !options.dryRun) {
      ctx = createContext(root);
      ctx.config = config;
      ctx.state = {};
      results = runAll(ctx, selected);
    }
  }

  const value = score(results);
  const counts = { pass: 0, fail: 0, skip: 0 };
  for (const r of results) counts[r.status]++;
  return {
    root: ctx.root,
    project: ctx.project,
    score: value,
    grade: grade(value),
    counts,
    results,
    fixed,
    minScore: options.minScore ?? config.minScore ?? null,
  };
}
