import { test } from 'node:test';
import assert from 'node:assert/strict';
import { scanText } from '../src/secrets.js';
import { audit } from '../src/index.js';
import { makeRepo, result } from './helpers.js';

// Fake tokens are assembled at runtime so this file doesn't trip secret scanners itself.
const fake = {
  github: 'ghp_' + 'Ab1'.repeat(12),
  aws: 'AKIA' + 'QWERTYUIOPASDFGH',
  stripe: 'sk_' + 'live_' + 'a1B2c3D4e5F6g7H8i9J0k1L2',
  google: 'AIza' + 'Sy'.padEnd(35, 'Q'),
  slack: 'xox' + 'b-1234567890-abcdefghij',
  key: '-----BEGIN ' + 'RSA PRIVATE KEY-----\\n' + 'MIIEow'.repeat(8),
  pem: '-----BEGIN ' + 'EC PRIVATE KEY-----\n' + 'MHcCAQ'.repeat(10) + '\n-----END EC PRIVATE KEY-----',
  db: 'postgres://admin:' + 'hunter2hunter2' + '@db.internal:5432/app',
};

test('detects common secret formats', () => {
  const cases = [
    [fake.github, 'github-token'],
    [fake.aws, 'aws-access-key'],
    [fake.stripe, 'stripe-key'],
    [fake.google, 'google-api-key'],
    [fake.slack, 'slack-token'],
    [fake.key, 'private-key'],
    [fake.db, 'database-url'],
  ];
  for (const [value, rule] of cases) {
    const findings = scanText(`const x = "${value}";`, 'a.js');
    assert.equal(findings.length, 1, `${rule} not found`);
    assert.equal(findings[0].ruleId, rule);
    assert.equal(findings[0].line, 1);
  }
});

test('redacts the preview', () => {
  const [finding] = scanText(fake.github);
  assert.ok(!finding.preview.includes(fake.github));
  assert.ok(finding.preview.startsWith('ghp_'));
});

test('ignores placeholders and marked lines', () => {
  assert.deepEqual(scanText('AWS_KEY=AKIAIOSFODNN7EXAMPLE'), []);
  assert.deepEqual(scanText('postgres://user:password@localhost/db'), []);
  assert.deepEqual(scanText('postgres://user:${DB_PASSWORD}@localhost/db'), []);
  assert.deepEqual(scanText(`token = "${fake.github}" // repo-ready-ignore`), []);
});

test('reports line numbers', () => {
  const findings = scanText(`one\ntwo\n${fake.aws}\n`, 'config.txt');
  assert.equal(findings[0].line, 3);
});

test('audit fails on leaked secrets and respects ignorePaths', () => {
  const dir = makeRepo({ 'src/config.js': `export const token = "${fake.github}";\n`, 'deploy/key.pem': `${fake.pem}\n` });
  let report = audit(dir, { only: ['secrets'] });
  const r = result(report, 'secrets');
  assert.equal(r.status, 'fail');
  assert.equal(r.details.length, 2);
  assert.match(r.details.join('\n'), /src\/config\.js:1 GitHub token/);

  report = audit(dir, { only: ['secrets'], config: { secrets: { ignorePaths: ['^deploy/', '^src/'] } } });
  assert.equal(result(report, 'secrets').status, 'pass');
});

test('test and fixture directories are skipped unless includeTests is set', () => {
  const dir = makeRepo({ 'tests/certs/server.key': `${fake.pem}\n`, 'crypto/tls_test.go': 'k := `' + fake.pem + '`', 'src/__fixtures__/cfg.js': fake.github });
  assert.equal(result(audit(dir, { only: ['secrets'] }), 'secrets').status, 'pass');
  const r = result(audit(dir, { only: ['secrets'], config: { secrets: { includeTests: true } } }), 'secrets');
  assert.equal(r.status, 'fail');
  assert.equal(r.details.length, 3);
});

test('private key headers without key material are ignored', () => {
  const header = '-----BEGIN ' + 'PRIVATE KEY-----';
  assert.deepEqual(scanText(`/// Starts with ${header}`), []);
  assert.deepEqual(scanText(`const key = "${header}\\n...\\n-----END PRIVATE KEY-----";`), []);
  assert.deepEqual(scanText(`const re = /${header}[\\s\\S]+?-----END/;`), []);
  assert.equal(scanText(fake.pem).length, 1);
  assert.equal(scanText(`const k = \`${fake.pem}\`;`).length, 1);
});

test('database URLs with local hosts or default credentials are not secrets', () => {
  const ok = [
    'postgres://postgres:postgres@localhost:5432',
    'amqp://guest:guest@localhost:5672',
    'postgresql://foo:bar@localhost:9000/foo_test',
    'mysql://app:s3cr3tValue@db:3306/app',
    'redis://default:Zx81kqPq@127.0.0.1:6379',
    'mongodb://admin:root@mongo.example.com/db',
  ];
  for (const url of ok) assert.deepEqual(scanText(url), [], url);
  assert.equal(scanText('mysql://app:' + 'Zx81kqPqLw' + '@prod-db.company.io:3306/app').length, 1);
});

test('skips lockfiles and binaries', () => {
  const dir = makeRepo({ 'package-lock.json': `{"x":"${fake.github}"}`, 'logo.png': fake.github });
  assert.equal(result(audit(dir, { only: ['secrets'] }), 'secrets').status, 'pass');
});
