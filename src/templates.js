function nodeCommands(ctx) {
  const pkg = ctx.readJson('package.json') || {};
  const scripts = pkg.scripts || {};
  let pm = 'npm';
  if (ctx.find('pnpm-lock.yaml')) pm = 'pnpm';
  else if (ctx.find('yarn.lock')) pm = 'yarn';
  else if (ctx.find('bun.lockb', 'bun.lock')) pm = 'bun';
  const run = (s) => (pm === 'npm' ? `npm run ${s}` : `${pm} ${s}`);
  return {
    install: pm === 'npm' ? (ctx.find('package-lock.json') ? 'npm ci' : 'npm install') : `${pm} install`,
    test: scripts.test && !/no test specified/.test(scripts.test) ? (pm === 'npm' ? 'npm test' : `${pm} test`) : null,
    lint: scripts.lint ? run('lint') : null,
    build: scripts.build ? run('build') : null,
    pm,
  };
}

export function projectCommands(ctx) {
  const eco = ctx.project.ecosystems[0];
  switch (eco) {
    case 'node': return nodeCommands(ctx);
    case 'python': return {
      install: ctx.find('pyproject.toml') ? 'pip install -e ".[dev]"' : 'pip install -r requirements.txt',
      test: 'pytest', lint: ctx.find('ruff.toml', '.ruff.toml') || /\[tool\.ruff/.test(ctx.read('pyproject.toml') || '') ? 'ruff check .' : null, build: null,
    };
    case 'go': return { install: 'go mod download', test: 'go test ./...', lint: 'go vet ./...', build: 'go build ./...' };
    case 'rust': return { install: 'cargo fetch', test: 'cargo test', lint: 'cargo clippy -- -D warnings', build: 'cargo build' };
    case 'java': return ctx.find('pom.xml')
      ? { install: 'mvn -B dependency:resolve', test: 'mvn -B test', lint: null, build: 'mvn -B package' }
      : { install: './gradlew dependencies', test: './gradlew test', lint: null, build: './gradlew build' };
    case 'ruby': return { install: 'bundle install', test: 'bundle exec rake test', lint: null, build: null };
    case 'php': return { install: 'composer install', test: 'composer test', lint: null, build: null };
    case 'dotnet': return { install: 'dotnet restore', test: 'dotnet test', lint: null, build: 'dotnet build' };
    default: return { install: null, test: null, lint: null, build: null };
  }
}

function repoUrl(ctx) {
  return ctx.project.remote?.host === 'github' ? ctx.project.remote.url : null;
}

function commandBlock(cmds) {
  const lines = [cmds.install, cmds.build, cmds.lint, cmds.test].filter(Boolean);
  return lines.length ? `\`\`\`sh\n${lines.join('\n')}\n\`\`\`` : '_Describe how to install dependencies and run the tests here._';
}

export function readme(ctx, { license }) {
  const name = ctx.project.name;
  const cmds = projectCommands(ctx);
  const installLine = {
    node: `npm install ${name}`, python: `pip install ${name}`, rust: `cargo add ${name}`,
    go: ctx.read('go.mod')?.match(/^module\s+(\S+)/m) ? `go get ${ctx.read('go.mod').match(/^module\s+(\S+)/m)[1]}` : null,
  }[ctx.project.ecosystems[0]];
  return `# ${name}

> One sentence that explains what ${name} does and who it is for.

## Features

- What problem does it solve?
- What makes it different?

## Installation

\`\`\`sh
${installLine || '# how to install'}
\`\`\`

## Usage

\`\`\`sh
# the smallest useful example
\`\`\`

## Contributing

Contributions are welcome! Please read [CONTRIBUTING.md](CONTRIBUTING.md) before opening a pull request.

${commandBlock(cmds)}

## License

${license ? `[${license}](LICENSE)` : 'See [LICENSE](LICENSE).'}
`;
}

export function contributing(ctx) {
  const cmds = projectCommands(ctx);
  const url = repoUrl(ctx);
  return `# Contributing to ${ctx.project.name}

Thanks for taking the time to contribute! Every bug report, idea and pull request helps.

## Reporting bugs and requesting features

- Search ${url ? `[existing issues](${url}/issues)` : 'existing issues'} first — someone may have reported it already.
- For bugs, include what you did, what you expected, what happened instead, and your environment (OS, versions).
- **Security issues:** please do not open a public issue. Follow [SECURITY.md](SECURITY.md) instead.

## Development setup

${commandBlock(cmds)}

## Pull requests

1. Fork the repository and create a branch from the default branch.
2. Make your change. Add or update tests when you change behavior.
3. Make sure the test suite passes${cmds.lint ? ' and the linter is happy' : ''}.
4. Update documentation (README, CHANGELOG) if needed.
5. Open a pull request describing **what** changed and **why**.

Small, focused pull requests are reviewed faster than large ones. If you plan a big change, open an issue first so we can agree on the approach.

## Code of conduct

By participating you agree to follow our [Code of Conduct](CODE_OF_CONDUCT.md).
`;
}

export function codeOfConduct(ctx, { contact }) {
  const how = contact
    ? `contacting the maintainers at ${contact}`
    : (repoUrl(ctx) ? `contacting the maintainers privately (see the maintainers' GitHub profiles at ${repoUrl(ctx)})` : 'contacting the maintainers privately');
  return `# Code of Conduct

This project adopts the [Contributor Covenant, version 2.1](https://www.contributor-covenant.org/version/2/1/code_of_conduct/).

## In short

We want ${ctx.project.name} to be a welcoming, harassment-free community for everyone, regardless of age, body size, visible or invisible disability, ethnicity, sex characteristics, gender identity and expression, level of experience, education, socio-economic status, nationality, personal appearance, race, caste, color, religion, or sexual identity and orientation.

**Please do:** be kind and patient, give and gracefully accept constructive feedback, focus on what is best for the community, and take responsibility for your mistakes.

**Please don't:** use sexualized language or imagery, troll, insult, harass (publicly or privately), publish others' private information without permission, or act in any way that would be inappropriate in a professional setting.

## Reporting

Report unacceptable behavior by ${how}. All reports will be reviewed and investigated promptly and fairly, and the privacy of the reporter will be respected.

Maintainers may remove, edit or reject comments, commits, code, issues and other contributions that violate this Code of Conduct, and may temporarily or permanently ban contributors for behaviors they deem harmful.

The full text, including enforcement guidelines, is available at <https://www.contributor-covenant.org/version/2/1/code_of_conduct/>.
`;
}

export function security(ctx, { contact }) {
  const url = repoUrl(ctx);
  const channels = [];
  if (url) channels.push(`Use GitHub's private vulnerability reporting: [${url}/security/advisories/new](${url}/security/advisories/new).`);
  if (contact) channels.push(`Email ${contact}.`);
  if (!channels.length) channels.push('Contact the maintainers privately.');
  return `# Security Policy

## Supported versions

Security fixes are applied to the latest release. Please make sure you can reproduce the issue on the latest version before reporting.

## Reporting a vulnerability

**Please do not report security vulnerabilities through public issues, discussions or pull requests.**

${channels.map((c) => `- ${c}`).join('\n')}

Please include:

- A description of the vulnerability and its impact
- Steps to reproduce, or a proof of concept
- Affected versions
- Any suggested fix, if you have one

You should receive an acknowledgement within a few days. We will keep you informed of our progress, and credit you in the release notes unless you prefer to remain anonymous.
`;
}

export function bugReport() {
  return `name: Bug report
description: Something isn't working as expected
labels: [bug]
body:
  - type: markdown
    attributes:
      value: Thanks for taking the time to report a bug! Please search existing issues first.
  - type: textarea
    id: what-happened
    attributes:
      label: What happened?
      description: What did you do, what did you expect, and what happened instead?
    validations:
      required: true
  - type: textarea
    id: reproduce
    attributes:
      label: Steps to reproduce
      placeholder: |
        1. ...
        2. ...
    validations:
      required: true
  - type: input
    id: version
    attributes:
      label: Version
    validations:
      required: true
  - type: input
    id: environment
    attributes:
      label: Environment
      placeholder: OS, runtime version, etc.
  - type: textarea
    id: logs
    attributes:
      label: Relevant logs or output
      render: shell
`;
}

export function featureRequest() {
  return `name: Feature request
description: Suggest an idea or improvement
labels: [enhancement]
body:
  - type: textarea
    id: problem
    attributes:
      label: What problem would this solve?
      description: Describe the use case. "I'm always frustrated when..."
    validations:
      required: true
  - type: textarea
    id: solution
    attributes:
      label: Proposed solution
  - type: textarea
    id: alternatives
    attributes:
      label: Alternatives considered
`;
}

export function issueConfig(ctx) {
  const url = repoUrl(ctx);
  return `blank_issues_enabled: true
${url ? `contact_links:
  - name: Report a security vulnerability
    url: ${url}/security/advisories/new
    about: Please report security issues privately.
` : ''}`;
}

export function prTemplate() {
  return `## What does this change?

<!-- A short description of the change and why it's needed. Link related issues, e.g. "Fixes #123". -->

## How was it tested?

<!-- Commands you ran, screenshots, etc. -->

## Checklist

- [ ] Tests added or updated
- [ ] Documentation updated (README, CHANGELOG) if needed
`;
}

export function changelog() {
  return `# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Initial release
`;
}

const GITIGNORE = {
  common: ['# OS', '.DS_Store', 'Thumbs.db', '', '# Editors', '.idea/', '.vscode/*', '!.vscode/extensions.json', '*.swp', '', '# Environment', '.env', '.env.*', '!.env.example', ''],
  node: ['# Node', 'node_modules/', 'dist/', 'build/', 'coverage/', '*.log', '.npm/', ''],
  python: ['# Python', '__pycache__/', '*.py[cod]', '.venv/', 'venv/', 'build/', 'dist/', '*.egg-info/', '.pytest_cache/', '.mypy_cache/', '.ruff_cache/', '.coverage', 'htmlcov/', ''],
  go: ['# Go', '/bin/', '*.test', '*.out', 'coverage.txt', ''],
  rust: ['# Rust', '/target/', ''],
  java: ['# Java', 'target/', 'build/', '.gradle/', '*.class', ''],
  ruby: ['# Ruby', '/.bundle/', '/vendor/bundle', '/pkg/', '/tmp/', ''],
  php: ['# PHP', '/vendor/', ''],
  dotnet: ['# .NET', 'bin/', 'obj/', '*.user', ''],
};

export function gitignore(ctx) {
  const parts = [GITIGNORE.common, ...ctx.project.ecosystems.map((e) => GITIGNORE[e] || [])];
  return parts.flat().join('\n');
}

const CI_STEPS = {
  node: (ctx) => {
    const c = nodeCommands(ctx);
    const setupPm = c.pm === 'pnpm' ? '      - uses: pnpm/action-setup@v6\n' : c.pm === 'bun' ? '      - uses: oven-sh/setup-bun@v2\n' : '';
    return `    strategy:
      matrix:
        node-version: [22, 24]
    steps:
      - uses: actions/checkout@v7
${setupPm}      - uses: actions/setup-node@v7
        with:
          node-version: \${{ matrix.node-version }}
${c.pm !== 'bun' && ctx.find('package-lock.json', 'yarn.lock', 'pnpm-lock.yaml', 'npm-shrinkwrap.json') ? `          cache: ${c.pm}\n` : ''}      - run: ${c.install}
${[c.lint, c.build, c.test].filter(Boolean).map((s) => `      - run: ${s}`).join('\n') || '      - run: echo "Add a test script to package.json"'}
`;
  },
  python: (ctx) => `    strategy:
      matrix:
        python-version: ['3.11', '3.12', '3.13', '3.14']
    steps:
      - uses: actions/checkout@v7
      - uses: actions/setup-python@v7
        with:
          python-version: \${{ matrix.python-version }}
      - run: python -m pip install --upgrade pip
      - run: ${projectCommands(ctx).install}
      - run: pip install pytest
      - run: pytest
`,
  go: () => `    steps:
      - uses: actions/checkout@v7
      - uses: actions/setup-go@v7
        with:
          go-version: stable
      - run: go vet ./...
      - run: go test -race ./...
`,
  rust: () => `    steps:
      - uses: actions/checkout@v7
      - uses: dtolnay/rust-toolchain@stable
        with:
          components: clippy, rustfmt
      - run: cargo fmt --check
      - run: cargo clippy -- -D warnings
      - run: cargo test
`,
};

export function ciWorkflow(ctx) {
  const eco = ctx.project.ecosystems.find((e) => CI_STEPS[e]);
  if (!eco) return null;
  return `name: CI

on:
  push:
    branches: [main, master]
  pull_request:

permissions:
  contents: read

jobs:
  test:
    runs-on: ubuntu-latest
${CI_STEPS[eco](ctx)}`;
}

const DEPENDABOT_ECOSYSTEM = {
  node: 'npm', python: 'pip', go: 'gomod', rust: 'cargo', java: null, ruby: 'bundler', php: 'composer', dotnet: 'nuget',
};

export function dependabot(ctx) {
  const ecos = ctx.project.ecosystems.map((e) => (e === 'java' ? (ctx.find('pom.xml') ? 'maven' : 'gradle') : DEPENDABOT_ECOSYSTEM[e])).filter(Boolean);
  const entries = [...new Set(ecos), 'github-actions'].map((e) => `  - package-ecosystem: ${e}
    directory: /
    schedule:
      interval: weekly
`);
  return `version: 2
updates:
${entries.join('')}`;
}

export function agentsMd(ctx) {
  const cmds = projectCommands(ctx);
  const lines = [
    cmds.install && `- Install dependencies: \`${cmds.install}\``,
    cmds.build && `- Build: \`${cmds.build}\``,
    cmds.lint && `- Lint: \`${cmds.lint}\``,
    cmds.test && `- Test: \`${cmds.test}\``,
  ].filter(Boolean);
  return `# AGENTS.md

Guidance for AI coding agents (Codex, Cursor, Copilot, Claude Code, ...) working on ${ctx.project.name}.

## Commands

${lines.length ? lines.join('\n') : '- Describe how to install, build and test the project here.'}

## Conventions

- Keep changes focused; match the style of the surrounding code.
- Add or update tests for any behavior change and make sure the full test suite passes.
- Update README.md and CHANGELOG.md when user-facing behavior changes.
- Never commit secrets, credentials or \`.env\` files.
`;
}
