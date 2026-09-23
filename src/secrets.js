// A PEM header only counts when real base64 key material follows it, either on the next lines
// or after an escaped "\n" on the same line. Headers in docs, regexes and error messages are ignored.
function hasKeyMaterial(lines, i, offset) {
  const BASE64 = /^[A-Za-z0-9+/]{40,}={0,2}$/;
  const rest = lines[i].slice(offset);
  const escaped = rest.match(/^(?:\\r)?\\n([A-Za-z0-9+/]{40,})/);
  if (escaped) return true;
  for (let j = i + 1; j < Math.min(lines.length, i + 6); j++) {
    const line = lines[j].trim().replace(/^["'`]|["'`,;+\s\\n]*$/g, '');
    if (!line || /^(Proc-Type|DEK-Info|Comment|Version):/i.test(line)) continue;
    return BASE64.test(line);
  }
  return false;
}

const DEFAULT_PASSWORDS = /^(postgres|root|guest|admin|mysql|mariadb|redis|rabbitmq|sa|mongo|mongodb|user|pass|bar|foo|secret|password|toor|1234\d*|123456\d*|qwerty)$/i;
const LOCAL_HOST = /^(localhost|127\.\d+\.\d+\.\d+|0\.0\.0\.0|\[::1\]|host\.docker\.internal|[^.]+\.local|[^.]+\.localhost)$/i;

const RULES = [
  {
    id: 'private-key',
    name: 'Private key',
    re: /-----BEGIN (?:RSA |EC |DSA |OPENSSH |PGP |ENCRYPTED )?PRIVATE KEY(?: BLOCK)?-----/,
    validate: (m, lines, i) => hasKeyMaterial(lines, i, m.index + m[0].length),
  },
  { id: 'aws-access-key', name: 'AWS access key ID', re: /\b(?:AKIA|ASIA|ABIA|ACCA)[0-9A-Z]{16}\b/ },
  { id: 'github-token', name: 'GitHub token', re: /\bgh[pousr]_[A-Za-z0-9]{36,255}\b/ },
  { id: 'github-pat', name: 'GitHub fine-grained token', re: /\bgithub_pat_[A-Za-z0-9_]{80,}\b/ },
  { id: 'gitlab-token', name: 'GitLab token', re: /\bglpat-[A-Za-z0-9_-]{20,}\b/ },
  { id: 'openai-key', name: 'OpenAI API key', re: /\bsk-(?:proj-|svcacct-|admin-)?[A-Za-z0-9_-]{20,}T3BlbkFJ[A-Za-z0-9_-]{20,}\b|\bsk-proj-[A-Za-z0-9_-]{40,}\b/ },
  { id: 'anthropic-key', name: 'Anthropic API key', re: /\bsk-ant-(?:api|admin)\d{2}-[A-Za-z0-9_-]{80,}\b/ },
  { id: 'google-api-key', name: 'Google API key', re: /\bAIza[0-9A-Za-z_-]{35}\b/ },
  { id: 'slack-token', name: 'Slack token', re: /\bxox[baprs]-[0-9A-Za-z-]{10,}\b/ },
  { id: 'slack-webhook', name: 'Slack webhook', re: /https:\/\/hooks\.slack\.com\/services\/T[A-Z0-9]+\/B[A-Z0-9]+\/[A-Za-z0-9]{20,}/ },
  { id: 'discord-webhook', name: 'Discord webhook', re: /https:\/\/(?:ptb\.|canary\.)?discord(?:app)?\.com\/api\/webhooks\/\d+\/[A-Za-z0-9_-]{50,}/ },
  { id: 'stripe-key', name: 'Stripe live key', re: /\b(?:sk|rk)_live_[0-9a-zA-Z]{24,}\b/ },
  { id: 'sendgrid-key', name: 'SendGrid API key', re: /\bSG\.[A-Za-z0-9_-]{22}\.[A-Za-z0-9_-]{43}\b/ },
  { id: 'npm-token', name: 'npm token', re: /\bnpm_[A-Za-z0-9]{36}\b/ },
  { id: 'pypi-token', name: 'PyPI token', re: /\bpypi-AgEIcHlwaS5vcmc[A-Za-z0-9_-]{50,}\b/ },
  { id: 'huggingface-token', name: 'Hugging Face token', re: /\bhf_[A-Za-z0-9]{34,}\b/ },
  { id: 'telegram-bot-token', name: 'Telegram bot token', re: /\b\d{8,10}:AA[A-Za-z0-9_-]{33}\b/ },
  {
    id: 'database-url',
    name: 'Database URL with password',
    re: /\b(?:postgres(?:ql)?|mysql|mariadb|mongodb(?:\+srv)?|redis|rediss|amqps?|mssql):\/\/([^\s:/@'"`]+):([^\s@/'"`]{3,})@([^\s/:'"`?]+)/,
    validate: ([, user, password, host]) => user !== password
      && !DEFAULT_PASSWORDS.test(password)
      && !/^(\$|\{|<|%|\*+$|x+$)|password|passwd|secret|changeme|example|placeholder|your|pass$|pwd$|test|dummy|redacted/i.test(password)
      && !LOCAL_HOST.test(host) && host.includes('.'),
  },
];

const BINARY_EXT = /\.(png|jpe?g|gif|webp|ico|icns|bmp|tiff?|psd|pdf|zip|gz|tgz|bz2|xz|7z|rar|jar|war|class|so|dylib|dll|exe|bin|o|a|wasm|woff2?|ttf|otf|eot|mp[34]|mov|avi|webm|ogg|wav|flac|sqlite|db|pyc|lockb)$/i;
const SKIP_FILE = /(^|\/)(package-lock\.json|yarn\.lock|pnpm-lock\.yaml|Cargo\.lock|poetry\.lock|Gemfile\.lock|composer\.lock|go\.sum|uv\.lock)$|\.min\.(js|css)$|\.map$/i;
const PLACEHOLDER = /example|sample|dummy|fake|placeholder|xxxx|your[_-]?(api[_-]?)?key|<[^>]+>|\$\{|redacted|0{16}/i;
const IGNORE_MARK = /repo-ready-ignore|gitleaks:allow|pragma: allowlist secret|nosec/i;
const MAX_BYTES = 1024 * 1024;

function redact(value) {
  return value.length <= 8 ? '****' : `${value.slice(0, 6)}…${'*'.repeat(4)}`;
}

export function scanText(text, file = '') {
  const findings = [];
  const lines = text.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.length > 2000 || IGNORE_MARK.test(line)) continue;
    for (const rule of RULES) {
      const m = line.match(rule.re);
      if (!m) continue;
      if (rule.validate && !rule.validate(m, lines, i)) continue;
      if (rule.id !== 'private-key' && PLACEHOLDER.test(m[0])) continue;
      findings.push({ file, line: i + 1, rule: rule.name, ruleId: rule.id, preview: rule.id === 'private-key' ? '' : redact(m[0]) });
    }
  }
  return findings;
}

export const TEST_PATH = /(^|\/)(tests?|__tests__|__fixtures__|spec|specs|fixtures?|testdata|test-data|__mocks__)\/|_test\.[a-z]+$|[._-](test|spec)\.[a-z]+$|(^|\/)test_[^/]+\.py$/i;

export function scanSecrets(ctx) {
  const ignore = (ctx.config.secrets?.ignorePaths || []).map((p) => new RegExp(p));
  const includeTests = ctx.config.secrets?.includeTests === true;
  const findings = [];
  let scanned = 0;
  for (const file of ctx.files) {
    if (BINARY_EXT.test(file) || SKIP_FILE.test(file) || ignore.some((re) => re.test(file))) continue;
    if (!includeTests && TEST_PATH.test(file)) continue;
    if (ctx.size(file) > MAX_BYTES) continue;
    const text = ctx.read(file);
    if (text == null || text.includes('\u0000')) continue;
    scanned++;
    findings.push(...scanText(text, file));
  }
  ctx.state.secretsScanned = scanned;
  return findings;
}

export const SECRET_RULES = RULES.map(({ id, name }) => ({ id, name }));
