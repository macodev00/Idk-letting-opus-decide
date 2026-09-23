import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { audit, checks } from './index.js';
import { SUPPORTED_LICENSES } from './licenses.js';
import * as reporters from './reporters.js';

const pkg = JSON.parse(fs.readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'package.json'), 'utf8'));

const HELP = `repo-ready ${pkg.version}
Check if your repository is ready for open source, and fix what's missing.

Usage
  repo-ready [path] [options]

Options
  --fix                 Create missing files (LICENSE, CONTRIBUTING.md, SECURITY.md, ...)
  --dry-run             With --fix, show what would be created without writing
  --license <id>        License to create with --fix (default: package.json license or MIT)
                        One of: ${SUPPORTED_LICENSES.join(', ')}
  --holder <name>       Copyright holder for the license (default: package author / git user.name)
  --contact <email>     Contact for SECURITY.md and CODE_OF_CONDUCT.md
  --history             Also scan every commit in git history for secrets
  --format <fmt>        text (default), json, markdown, sarif
  -o, --output <file>   Write the report to a file instead of stdout
  --min-score <n>       Exit with code 1 if the score is below n (0-100)
  --strict              Exit with code 1 if any error-level check fails
  --only <ids>          Only run these checks (comma-separated)
  --skip <ids>          Skip these checks (comma-separated)
  --badge               Print a shields.io badge URL for your score
  --list-checks         List all checks
  -v, --verbose         Show skipped checks and explanations
  --no-color            Disable colors
  -h, --help            Show this help
  --version             Show version

Examples
  npx repo-ready                    Audit the current directory
  npx repo-ready --fix              Audit and generate missing files
  npx repo-ready --history          Also check past commits before going public
  npx repo-ready --min-score 80     Fail CI below 80/100
  npx repo-ready --format markdown  Report for a PR comment or job summary

Configuration
  Put options in .repo-ready.json or a "repo-ready" key in package.json:
  { "skip": ["agents-md"], "minScore": 80, "secrets": { "ignorePaths": ["^test/fixtures/"] } }
`;

const VALUE_FLAGS = new Set(['--license', '--holder', '--contact', '--format', '--output', '-o', '--min-score', '--only', '--skip']);
const BOOL_FLAGS = new Set(['--fix', '--history', '--dry-run', '--strict', '--badge', '--list-checks', '--verbose', '-v', '--no-color', '--help', '-h', '--version']);

export function parseArgs(argv) {
  const args = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    let arg = argv[i];
    let value;
    if (arg.startsWith('--') && arg.includes('=')) [arg, value] = [arg.slice(0, arg.indexOf('=')), arg.slice(arg.indexOf('=') + 1)];
    if (VALUE_FLAGS.has(arg)) {
      if (value === undefined) value = argv[++i];
      if (value === undefined) throw new Error(`${arg} requires a value`);
      args[arg.replace(/^-+/, '')] = value;
    } else if (BOOL_FLAGS.has(arg)) {
      args[arg.replace(/^-+/, '')] = true;
    } else if (arg.startsWith('-')) {
      throw new Error(`Unknown option: ${arg}`);
    } else {
      args._.push(arg);
    }
  }
  if (args.o) args.output = args.o;
  if (args.v) args.verbose = true;
  if (args.h) args.help = true;
  return args;
}

const list = (s) => (s ? String(s).split(',').map((x) => x.trim()).filter(Boolean) : []);

export async function main(argv = process.argv.slice(2), io = { stdout: process.stdout, stderr: process.stderr }) {
  let args;
  try {
    args = parseArgs(argv);
  } catch (err) {
    io.stderr.write(`repo-ready: ${err.message}\nRun "repo-ready --help" for usage.\n`);
    return 2;
  }
  if (args.help) { io.stdout.write(HELP); return 0; }
  if (args.version) { io.stdout.write(`${pkg.version}\n`); return 0; }
  if (args['list-checks']) {
    for (const c of checks) io.stdout.write(`${c.id.padEnd(22)} ${c.severity.padEnd(8)} ${c.title}\n`);
    return 0;
  }

  const format = args.format || 'text';
  if (!['text', 'json', 'markdown', 'sarif'].includes(format)) {
    io.stderr.write(`repo-ready: unknown format "${format}"\n`);
    return 2;
  }
  let minScore;
  if (args['min-score'] !== undefined) {
    minScore = Number(args['min-score']);
    if (!Number.isFinite(minScore) || minScore < 0 || minScore > 100) {
      io.stderr.write('repo-ready: --min-score must be a number between 0 and 100\n');
      return 2;
    }
  }

  let report;
  try {
    report = audit(args._[0] || '.', {
      fix: !!args.fix,
      history: !!args.history,
      dryRun: !!args['dry-run'],
      license: args.license,
      holder: args.holder,
      contact: args.contact,
      only: list(args.only),
      skip: list(args.skip),
      minScore,
    });
  } catch (err) {
    io.stderr.write(`repo-ready: ${err.message}\n`);
    return 2;
  }

  const force = process.env.FORCE_COLOR;
  const forced = force !== undefined && force !== '' ? !/^(0|false)$/i.test(force) : null;
  const color = !args['no-color'] && !args.output && (forced ?? (!process.env.NO_COLOR && io.stdout.isTTY === true));
  let output;
  if (format === 'json') output = reporters.json(report);
  else if (format === 'markdown') output = reporters.markdown(report);
  else if (format === 'sarif') output = reporters.sarif(report, { version: pkg.version });
  else output = reporters.text(report, { color, verbose: !!args.verbose });
  if (args['dry-run'] && report.fixed.length && format === 'text') {
    output = output.replace('Created', 'Would create');
  }

  if (args.output) {
    fs.writeFileSync(args.output, output);
    if (format !== 'text') io.stdout.write(reporters.text(report, { color: false }));
  } else {
    io.stdout.write(output);
  }
  if (args.badge) {
    io.stdout.write(`\nBadge: ![repo-ready](${reporters.badge(report)})\n`);
  }

  const threshold = report.minScore;
  if (threshold != null && report.score < threshold) return 1;
  if (args.strict && report.results.some((r) => r.status === 'fail' && r.severity === 'error')) return 1;
  return 0;
}
