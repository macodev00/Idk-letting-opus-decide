import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

export function makeRepo(files = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'repo-ready-'));
  for (const [rel, content] of Object.entries(files)) {
    const abs = path.join(dir, rel);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, typeof content === 'string' ? content : JSON.stringify(content, null, 2));
  }
  return dir;
}

export function result(report, id) {
  return report.results.find((r) => r.id === id);
}

export const GOOD_README = `# demo

A demo project that does one useful thing really well, used by tests to check that a complete README passes
every documentation check in repo-ready without any warnings being raised at all.

## Installation

\`\`\`sh
npm install demo
\`\`\`

## Usage

\`\`\`js
import demo from 'demo';
\`\`\`

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md).

## License

[MIT](LICENSE)
`;

export function captureIo() {
  const out = [];
  const err = [];
  return {
    io: { stdout: { write: (s) => out.push(s), isTTY: false }, stderr: { write: (s) => err.push(s) } },
    get stdout() { return out.join(''); },
    get stderr() { return err.join(''); },
  };
}
