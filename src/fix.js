import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { renderLicense, normalizeLicenseId, SUPPORTED_LICENSES } from './licenses.js';
import * as t from './templates.js';

function gitConfig(root, key) {
  try {
    return execFileSync('git', ['config', '--get', key], { cwd: root, stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim() || null;
  } catch {
    return null;
  }
}

function defaultHolder(ctx) {
  const pkg = ctx.readJson('package.json');
  const author = typeof pkg?.author === 'string' ? pkg.author.replace(/\s*[<(].*$/, '') : pkg?.author?.name;
  return author || gitConfig(ctx.root, 'user.name') || ctx.project.remote?.owner || 'The contributors';
}

function defaultLicense(ctx) {
  const pkg = ctx.readJson('package.json');
  const declared = normalizeLicenseId(pkg?.license);
  return SUPPORTED_LICENSES.find((l) => l === declared) || 'MIT';
}

const FIXERS = {
  license: (ctx, o) => [['LICENSE', renderLicense(o.license, { holder: o.holder })]],
  readme: (ctx, o) => (ctx.state.readmeFile ? [] : [['README.md', t.readme(ctx, o)]]),
  contributing: (ctx) => [['CONTRIBUTING.md', t.contributing(ctx)]],
  'code-of-conduct': (ctx, o) => [['CODE_OF_CONDUCT.md', t.codeOfConduct(ctx, o)]],
  'security-policy': (ctx, o) => [['SECURITY.md', t.security(ctx, o)]],
  'issue-templates': (ctx) => [
    ['.github/ISSUE_TEMPLATE/bug_report.yml', t.bugReport()],
    ['.github/ISSUE_TEMPLATE/feature_request.yml', t.featureRequest()],
    ['.github/ISSUE_TEMPLATE/config.yml', t.issueConfig(ctx)],
  ],
  'pr-template': () => [['.github/PULL_REQUEST_TEMPLATE.md', t.prTemplate()]],
  changelog: () => [['CHANGELOG.md', t.changelog()]],
  gitignore: (ctx) => (ctx.find('.gitignore') ? [] : [['.gitignore', t.gitignore(ctx)]]),
  ci: (ctx) => {
    const wf = t.ciWorkflow(ctx);
    return wf ? [['.github/workflows/ci.yml', wf]] : [];
  },
  'dependency-updates': (ctx) => [['.github/dependabot.yml', t.dependabot(ctx)]],
  'agents-md': (ctx) => [['AGENTS.md', t.agentsMd(ctx)]],
};

export function isFixable(checkId) {
  return checkId in FIXERS;
}

/**
 * Create missing files for failed checks. Never overwrites existing files.
 * Returns the list of files that were (or, with dryRun, would be) written.
 */
export function applyFixes(ctx, results, options = {}) {
  const license = options.license ? SUPPORTED_LICENSES.find((l) => l.toLowerCase() === String(options.license).toLowerCase()) : defaultLicense(ctx);
  if (!license) throw new Error(`Unsupported license "${options.license}". Supported: ${SUPPORTED_LICENSES.join(', ')}`);
  const opts = {
    license,
    holder: options.holder || defaultHolder(ctx),
    contact: options.contact || null,
  };

  const written = [];
  for (const result of results) {
    if (result.status !== 'fail' || !FIXERS[result.id]) continue;
    for (const [rel, content] of FIXERS[result.id](ctx, opts)) {
      const abs = path.join(ctx.root, rel);
      if (fs.existsSync(abs)) continue;
      if (!options.dryRun) {
        fs.mkdirSync(path.dirname(abs), { recursive: true });
        fs.writeFileSync(abs, content.endsWith('\n') ? content : `${content}\n`);
      }
      written.push({ check: result.id, file: rel });
    }
  }
  return written;
}
