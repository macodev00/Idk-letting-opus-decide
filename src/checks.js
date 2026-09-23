import path from 'node:path';
import { detectLicense, normalizeLicenseId } from './licenses.js';
import { scanSecrets, scanHistory } from './secrets.js';

const pass = (message, extra = {}) => ({ status: 'pass', message, ...extra });
const fail = (message, extra = {}) => ({ status: 'fail', message, ...extra });
const skip = (message) => ({ status: 'skip', message });

const DOC_DIRS = ['', '.github/', 'docs/'];
const inDocDirs = (...names) => DOC_DIRS.flatMap((d) => names.map((n) => d + n));

export function findLicenseFile(ctx) {
  return ctx.find(
    'LICENSE', 'LICENSE.md', 'LICENSE.txt', 'LICENCE', 'LICENCE.md', 'LICENCE.txt',
    'COPYING', 'COPYING.md', 'COPYING.txt', 'UNLICENSE', 'LICENSE-MIT', 'LICENSE-APACHE',
  ) || ctx.files.find((f) => !f.includes('/') && /^((un)?licen[cs]e|copying)([._-]|$)|[._-]licen[cs]e(\.(md|txt|rst))?$/i.test(f)) || null;
}

const SENSITIVE_ENV = /^\s*(?:export\s+)?[A-Z0-9_]*(KEY|SECRET|TOKEN|PASSWORD|PASSWD|PWD|PASS|AUTH|CREDENTIALS?|PRIVATE|DSN|DATABASE_URL|CONNECTION_STRING)[A-Z0-9_]*\s*=\s*["']?[^\s"'#]{6,}/im;

const FIXTURE_PATH = /(^|\/)(tests?|__tests__|spec|specs|fixtures?|__fixtures__|testdata|examples?|playground|samples?)\//i;

export function findReadme(ctx) {
  return ctx.find('README.md', 'README', 'README.rst', 'README.txt', 'README.markdown', 'readme.md', 'README.adoc');
}

function declaredLicenses(ctx) {
  const out = [];
  const pkg = ctx.readJson('package.json');
  if (pkg && typeof pkg.license === 'string') out.push({ file: 'package.json', id: pkg.license });
  for (const file of ['pyproject.toml', 'Cargo.toml']) {
    const text = ctx.read(file);
    if (!text) continue;
    const m = text.match(/^\s*license\s*=\s*(?:\{\s*text\s*=\s*)?["']([^"']+)["']/m);
    if (m) out.push({ file, id: m[1] });
  }
  const composer = ctx.readJson('composer.json');
  if (composer && typeof composer.license === 'string') out.push({ file: 'composer.json', id: composer.license });
  return out;
}

function markdownHeadings(text) {
  return [...text.matchAll(/^\s{0,3}#{1,6}\s+(.+?)\s*#*\s*$/gm)].map((m) => m[1].toLowerCase())
    .concat([...text.matchAll(/^(.+)\n(?:=+|-+)\s*$/gm)].map((m) => m[1].toLowerCase()));
}

const README_SECTIONS = [
  { key: 'installation', patterns: [/install/, /getting started/, /quick ?start/, /setup/] },
  { key: 'usage', patterns: [/usage/, /how to use/, /example/, /getting started/, /quick ?start/, /documentation/, /\bdocs\b/, /tutorial/, /\bapi\b/] },
  { key: 'license', patterns: [/licen[cs]e/, /copyright/] },
  { key: 'contributing', patterns: [/contribut/, /development/, /hacking/, /building from source/] },
];

export const checks = [
  {
    id: 'license',
    title: 'License file',
    category: 'legal',
    severity: 'error',
    description: 'Without a license, nobody can legally use, copy or modify your code.',
    fixable: true,
    run(ctx) {
      const file = findLicenseFile(ctx);
      if (!file) return fail('No LICENSE file found.');
      const id = detectLicense(ctx.read(file));
      ctx.state.license = id;
      if (!id) return pass(`${file} found (license type not recognized).`);
      return pass(`${file} (${id})`);
    },
  },
  {
    id: 'license-consistency',
    title: 'License matches package metadata',
    category: 'legal',
    severity: 'warning',
    description: 'The license declared in package metadata should match the LICENSE file.',
    run(ctx) {
      const declared = declaredLicenses(ctx);
      if (!declared.length) return skip('No package metadata declares a license.');
      const detected = ctx.state.license;
      if (!detected) return skip('LICENSE file missing or unrecognized.');
      const mismatches = declared.filter(({ id }) => {
        const ids = id.split(/\s+(?:OR|AND)\s+|[()]/i).map(normalizeLicenseId).filter(Boolean);
        return !ids.includes(detected);
      });
      if (mismatches.length) {
        return fail(`LICENSE is ${detected}, but ${mismatches.map((m) => `${m.file} says "${m.id}"`).join(', ')}.`);
      }
      return pass(`Metadata agrees: ${detected}.`);
    },
  },
  {
    id: 'readme',
    title: 'README',
    category: 'docs',
    severity: 'error',
    description: 'The README is the front page of your project.',
    fixable: true,
    run(ctx) {
      const file = findReadme(ctx);
      if (!file) return fail('No README found.');
      const text = ctx.read(file) || '';
      const words = text.split(/\s+/).filter(Boolean).length;
      if (words < 50) return fail(`${file} is nearly empty (${words} words).`, { fixable: false, details: ['Explain what the project does, how to install it and how to use it.'] });
      return pass(`${file} (${words} words)`);
    },
  },
  {
    id: 'readme-sections',
    title: 'README covers install, usage, license, contributing',
    category: 'docs',
    severity: 'warning',
    description: 'Visitors look for these sections first.',
    run(ctx) {
      const file = findReadme(ctx);
      if (!file) return skip('No README.');
      const text = ctx.read(file) || '';
      const headings = markdownHeadings(text);
      const codeBlocks = (text.match(/^\s*```/gm) || []).length / 2;
      const inBody = {
        installation: /\b(npm|pnpm|yarn|bun) (i|install|add)\b|\bpip install\b|\bcargo (add|install)\b|\bgo (get|install)\b|\bbrew install\b|\bgem install\b|\bcomposer require\b|\bdotnet add\b|\bdocker (run|pull)\b|\bnpx\b|\buvx?\b/i,
        usage: codeBlocks >= 2 ? /./ : null,
        license: /licen[cs]e/i,
        contributing: /contribut/i,
      };
      const missing = README_SECTIONS.filter(({ key, patterns }) => !headings.some((h) => patterns.some((p) => p.test(h))) && !inBody[key]?.test(text))
        .map((s) => s.key);
      if (missing.length) return fail(`Missing section(s): ${missing.join(', ')}.`);
      return pass('All key sections present.');
    },
  },
  {
    id: 'readme-example',
    title: 'README has a code example',
    category: 'docs',
    severity: 'info',
    description: 'A copy-pasteable example is the fastest way to get someone started.',
    run(ctx) {
      const file = findReadme(ctx);
      if (!file) return skip('No README.');
      const text = ctx.read(file) || '';
      if (/```|^( {4}|\t)\S/m.test(text) || /::\s*$/m.test(text)) return pass('Contains a code block.');
      return fail('No code block found.');
    },
  },
  {
    id: 'readme-links',
    title: 'README relative links resolve',
    category: 'docs',
    severity: 'warning',
    description: 'Broken links in the README look abandoned.',
    run(ctx) {
      const file = findReadme(ctx);
      if (!file) return skip('No README.');
      const text = (ctx.read(file) || '').replace(/```[\s\S]*?```/g, '');
      const links = [...text.matchAll(/!?\[[^\]]*\]\(\s*<?([^)\s>]+)>?(?:\s+"[^"]*")?\s*\)/g), ...text.matchAll(/^\s*\[[^\]]+\]:\s*(\S+)/gm)]
        .map((m) => m[1]);
      const broken = [];
      for (const link of links) {
        if (/^([a-z][a-z0-9+.-]*:|#|\/\/)/i.test(link)) continue;
        const target = decodeURIComponent(link.split('#')[0].split('?')[0]);
        if (!target) continue;
        const rel = path.posix.normalize(path.posix.join(path.posix.dirname(file), target.replace(/^\//, '')));
        if (!ctx.exists(rel)) broken.push(link);
      }
      if (!links.length) return skip('No relative links.');
      if (broken.length) return fail(`${broken.length} broken link(s).`, { details: [...new Set(broken)].slice(0, 20) });
      return pass('All relative links resolve.');
    },
  },
  {
    id: 'contributing',
    title: 'Contributing guide',
    category: 'community',
    severity: 'warning',
    description: 'Tells contributors how to set up, test and submit changes.',
    fixable: true,
    run(ctx) {
      const file = ctx.find(...inDocDirs('CONTRIBUTING.md', 'CONTRIBUTING', 'CONTRIBUTING.rst', 'CONTRIBUTING.txt'));
      return file ? pass(file) : fail('No CONTRIBUTING.md found.');
    },
  },
  {
    id: 'code-of-conduct',
    title: 'Code of conduct',
    category: 'community',
    severity: 'warning',
    description: 'Sets expectations for behavior and how problems are handled.',
    fixable: true,
    run(ctx) {
      const file = ctx.find(...inDocDirs('CODE_OF_CONDUCT.md', 'CODE_OF_CONDUCT', 'CODE-OF-CONDUCT.md', 'CODE_OF_CONDUCT.rst'));
      return file ? pass(file) : fail('No CODE_OF_CONDUCT.md found.');
    },
  },
  {
    id: 'security-policy',
    title: 'Security policy',
    category: 'security',
    severity: 'warning',
    description: 'Tells people how to report vulnerabilities privately instead of in public issues.',
    fixable: true,
    run(ctx) {
      const file = ctx.find(...inDocDirs('SECURITY.md', 'SECURITY', 'SECURITY.rst', 'SECURITY.txt'));
      return file ? pass(file) : fail('No SECURITY.md found.');
    },
  },
  {
    id: 'issue-templates',
    title: 'Issue templates',
    category: 'community',
    severity: 'info',
    description: 'Structured bug reports save maintainers a round-trip.',
    fixable: true,
    run(ctx) {
      const files = ctx.match(/^(\.github\/|docs\/)?ISSUE_TEMPLATE(\.md|\/.+\.(md|ya?ml))$/i).filter((f) => !/config\.ya?ml$/i.test(f));
      if (ctx.match(/^\.gitlab\/issue_templates\//i).length) return pass('GitLab issue templates found.');
      return files.length ? pass(`${files.length} template(s)`) : fail('No issue templates found.');
    },
  },
  {
    id: 'pr-template',
    title: 'Pull request template',
    category: 'community',
    severity: 'info',
    description: 'Reminds contributors to describe and test their change.',
    fixable: true,
    run(ctx) {
      const files = ctx.match(/^(\.github\/|docs\/)?PULL_REQUEST_TEMPLATE(\.md|\/.+\.md)$/i);
      if (ctx.match(/^\.gitlab\/merge_request_templates\//i).length) return pass('GitLab MR templates found.');
      return files.length ? pass(files[0]) : fail('No pull request template found.');
    },
  },
  {
    id: 'ci',
    title: 'Continuous integration',
    category: 'quality',
    severity: 'warning',
    description: 'Automated tests on every change give contributors confidence.',
    fixable: true,
    run(ctx) {
      const workflows = ctx.match(/^\.github\/workflows\/[^/]+\.ya?ml$/i);
      if (workflows.length) return pass(`${workflows.length} GitHub Actions workflow(s)`);
      const other = ctx.find('.gitlab-ci.yml', '.circleci/config.yml', '.travis.yml', 'azure-pipelines.yml',
        'Jenkinsfile', '.buildkite/pipeline.yml', 'bitbucket-pipelines.yml', '.drone.yml', '.woodpecker.yml');
      return other ? pass(other) : fail('No CI configuration found.');
    },
  },
  {
    id: 'tests',
    title: 'Tests',
    category: 'quality',
    severity: 'warning',
    description: 'A project with tests is far easier to contribute to safely.',
    run(ctx) {
      const tests = ctx.match(/(^|\/)(tests?|__tests__|spec|specs)\/|[._-](test|spec)\.[a-z0-9]+$|(^|\/)test_[^/]+\.py$|_test\.(go|py|rb|exs?)$/i);
      if (tests.length) return pass(`${tests.length} test file(s)`);
      if (ctx.project.ecosystems.includes('rust') && ctx.files.some((f) => f.endsWith('.rs') && /#\[(cfg\(test\)|test)\]/.test(ctx.read(f) || ''))) {
        return pass('Inline Rust tests found.');
      }
      return fail('No test files found.');
    },
  },
  {
    id: 'changelog',
    title: 'Changelog',
    category: 'docs',
    severity: 'info',
    description: 'Lets users see what changed between versions.',
    fixable: true,
    run(ctx) {
      const file = ctx.find('CHANGELOG.md', 'CHANGELOG', 'CHANGES.md', 'CHANGES', 'HISTORY.md', 'NEWS.md', 'RELEASES.md', 'CHANGELOG.rst', 'docs/CHANGELOG.md');
      if (file) return pass(file);
      const nested = ctx.files.filter((f) => /^[^/]+(\/[^/]+)?\/(CHANGELOG|CHANGES|HISTORY)(\.(md|rst|txt))?$/i.test(f) && !FIXTURE_PATH.test(f));
      if (nested.length) return pass(`${nested.length} package changelog(s), e.g. ${nested[0]}`);
      if (ctx.find('.changeset/config.json', '.release-please-manifest.json', 'release-please-config.json', '.releaserc', '.releaserc.json', 'cliff.toml')) {
        return pass('Automated release notes configured.');
      }
      return fail('No CHANGELOG found.');
    },
  },
  {
    id: 'gitignore',
    title: '.gitignore',
    category: 'quality',
    severity: 'warning',
    description: 'Keeps build output, dependencies and local config out of the repository.',
    fixable: true,
    run(ctx) {
      const file = ctx.find('.gitignore');
      if (!file) return fail('No .gitignore found.');
      const committed = ctx.files.filter((f) => /(^|\/)(node_modules|__pycache__|\.venv|\.DS_Store|Thumbs\.db)(\/|$)/.test(f) && !FIXTURE_PATH.test(f));
      if (committed.length) {
        return fail(`${committed.length} file(s) that are usually ignored are tracked.`, { fixable: false, details: committed.slice(0, 10) });
      }
      return pass(file);
    },
  },
  {
    id: 'secrets',
    title: 'No leaked secrets',
    category: 'security',
    severity: 'error',
    description: 'API keys, tokens and private keys committed to a public repo are harvested by bots within minutes.',
    run(ctx) {
      const findings = scanSecrets(ctx);
      if (!findings.length) return pass(`Scanned ${ctx.state.secretsScanned ?? 0} file(s).`);
      return fail(`${findings.length} potential secret(s) found.`, {
        details: findings.slice(0, 25).map((f) => `${f.file}:${f.line} ${f.rule}${f.preview ? ` (${f.preview})` : ''}`),
      });
    },
  },
  {
    id: 'secrets-history',
    title: 'No secrets in git history',
    category: 'security',
    severity: 'error',
    description: 'Deleting a secret in a later commit does not remove it: anyone can read old commits once the repo is public. Rotate the credential, then rewrite history (git filter-repo) if needed.',
    run(ctx) {
      if (!ctx.config.secrets?.history) return skip('Not enabled (use --history).');
      if (!ctx.git) return skip('Not a git repository.');
      const findings = scanHistory(ctx, { maxCommits: ctx.config.secrets.historyMaxCommits });
      const shallow = (ctx.state.historyShallow ? ' Shallow clone: fetch full history for a complete scan.' : '')
        + (ctx.state.historyLimited ? ' Commit limit reached: raise secrets.historyMaxCommits to scan further back.' : '');
      if (!findings.length) return pass(`Scanned ${ctx.state.historyCommits} commit(s).${shallow}`);
      return fail(`${findings.length} potential secret(s) in ${ctx.state.historyCommits} commit(s).${shallow}`, {
        details: findings.slice(0, 25).map((f) => `${f.file} ${f.rule}${f.preview ? ` (${f.preview})` : ''} in commit ${f.commit}`),
      });
    },
  },
  {
    id: 'env-files',
    title: 'No committed .env secrets',
    category: 'security',
    severity: 'error',
    description: '.env files usually contain credentials. Commit a .env.example instead.',
    run(ctx) {
      const envs = ctx.files.filter((f) => /(^|\/)\.env(\.[^/]*)?$/i.test(f) && !/\.(example|sample|template|dist|defaults?)$/i.test(f) && !FIXTURE_PATH.test(f));
      const risky = envs.filter((f) => SENSITIVE_ENV.test(ctx.read(f) || ''));
      if (risky.length) return fail(`${risky.length} .env file(s) with credential-like values tracked.`, { details: risky.slice(0, 10) });
      if (envs.length) return pass(`${envs.length} .env file(s) tracked, none with credential-like values.`);
      return pass('None found.');
    },
  },
  {
    id: 'large-files',
    title: 'No large files',
    category: 'quality',
    severity: 'info',
    description: 'Files over 5 MB bloat every clone forever. Use Git LFS or release assets.',
    run(ctx) {
      const lfs = (ctx.read('.gitattributes') || '').includes('filter=lfs');
      const big = ctx.files.map((f) => ({ f, size: ctx.size(f) })).filter(({ size }) => size > 5 * 1024 * 1024);
      if (big.length && !lfs) {
        return fail(`${big.length} file(s) over 5 MB.`, { details: big.slice(0, 10).map(({ f, size }) => `${f} (${(size / 1048576).toFixed(1)} MB)`) });
      }
      return pass(lfs && big.length ? 'Large files tracked with Git LFS.' : 'No files over 5 MB.');
    },
  },
  {
    id: 'package-metadata',
    title: 'Package metadata',
    category: 'docs',
    severity: 'warning',
    description: 'Registries use description, repository and keywords for search and linking.',
    run(ctx) {
      const pkg = ctx.readJson('package.json');
      if (pkg) {
        if (pkg.private === true) return skip('package.json is private.');
        const missing = ['description', 'repository', 'keywords', 'license'].filter((k) => !pkg[k] || (Array.isArray(pkg[k]) && !pkg[k].length));
        return missing.length ? fail(`package.json is missing: ${missing.join(', ')}.`) : pass('package.json is complete.');
      }
      const py = ctx.read('pyproject.toml');
      if (py && /^\[project\]/m.test(py)) {
        const missing = ['description', 'license', 'readme'].filter((k) => !new RegExp(`^\\s*${k}\\s*=`, 'm').test(py));
        if (!/^\[project\.urls\]/m.test(py)) missing.push('[project.urls]');
        return missing.length ? fail(`pyproject.toml is missing: ${missing.join(', ')}.`) : pass('pyproject.toml is complete.');
      }
      const cargo = ctx.read('Cargo.toml');
      if (cargo && /^\[package\]/m.test(cargo)) {
        const missing = ['description', 'license', 'repository'].filter((k) => !new RegExp(`^\\s*${k}(-file)?\\s*=`, 'm').test(cargo));
        return missing.length ? fail(`Cargo.toml is missing: ${missing.join(', ')}.`) : pass('Cargo.toml is complete.');
      }
      return skip('No package manifest found.');
    },
  },
  {
    id: 'dependency-updates',
    title: 'Automated dependency updates',
    category: 'security',
    severity: 'info',
    description: 'Dependabot or Renovate keep dependencies patched.',
    fixable: true,
    run(ctx) {
      if (!ctx.project.ecosystems.length) return skip('No dependency manifest found.');
      const file = ctx.find('.github/dependabot.yml', '.github/dependabot.yaml', 'renovate.json', 'renovate.json5',
        '.github/renovate.json', '.github/renovate.json5', '.renovaterc', '.renovaterc.json');
      if (file) return pass(file);
      const pkg = ctx.readJson('package.json');
      if (pkg?.renovate) return pass('Renovate configured in package.json.');
      return fail('Neither Dependabot nor Renovate is configured.');
    },
  },
  {
    id: 'agents-md',
    title: 'AGENTS.md for AI coding agents',
    category: 'community',
    severity: 'info',
    description: 'AGENTS.md tells Codex, Cursor, Copilot and other agents how to build and test your project.',
    fixable: true,
    run(ctx) {
      const file = ctx.find('AGENTS.md', 'CLAUDE.md', '.cursorrules', '.github/copilot-instructions.md', 'GEMINI.md')
        || ctx.match(/^\.cursor\/rules\//).at(0);
      return file ? pass(file) : fail('No AGENTS.md found.');
    },
  },
];

export const SEVERITY_WEIGHT = { error: 10, warning: 5, info: 2 };
