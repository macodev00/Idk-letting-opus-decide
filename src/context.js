import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const IGNORED_DIRS = new Set([
  '.git', 'node_modules', 'dist', 'build', 'out', 'coverage', 'vendor', 'target',
  '.venv', 'venv', '__pycache__', '.next', '.nuxt', '.cache', '.tox', '.idea', '.vscode',
]);

const MAX_WALK_FILES = 20000;

function listWithGit(root) {
  try {
    const out = execFileSync('git', ['ls-files', '-z', '--cached', '--others', '--exclude-standard'], {
      cwd: root,
      stdio: ['ignore', 'pipe', 'ignore'],
      maxBuffer: 256 * 1024 * 1024,
    });
    const files = out.toString('utf8').split('\0').filter(Boolean);
    return files.filter((f) => fs.existsSync(path.join(root, f)));
  } catch {
    return null;
  }
}

function listByWalking(root) {
  const files = [];
  const stack = [''];
  while (stack.length && files.length < MAX_WALK_FILES) {
    const rel = stack.pop();
    let entries;
    try {
      entries = fs.readdirSync(path.join(root, rel), { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of entries) {
      const childRel = rel ? `${rel}/${entry.name}` : entry.name;
      if (entry.isDirectory()) {
        if (!IGNORED_DIRS.has(entry.name)) stack.push(childRel);
      } else if (entry.isFile()) {
        files.push(childRel);
      }
    }
  }
  return files.sort();
}

function isGitRepo(root) {
  try {
    execFileSync('git', ['rev-parse', '--is-inside-work-tree'], { cwd: root, stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

export function createContext(root) {
  const absRoot = path.resolve(root);
  if (!fs.existsSync(absRoot) || !fs.statSync(absRoot).isDirectory()) {
    throw new Error(`Not a directory: ${absRoot}`);
  }
  const git = isGitRepo(absRoot);
  const files = (git && listWithGit(absRoot)) || listByWalking(absRoot);
  const lowerIndex = new Map();
  for (const f of files) lowerIndex.set(f.toLowerCase(), f);
  const cache = new Map();

  const ctx = {
    root: absRoot,
    git,
    files,

    /** Find the first file whose path (case-insensitive) matches any candidate. */
    find(...candidates) {
      for (const c of candidates) {
        const hit = lowerIndex.get(c.toLowerCase());
        if (hit) return hit;
      }
      return null;
    },

    /** Find files matching a regex against their relative path. */
    match(regex) {
      return files.filter((f) => regex.test(f));
    },

    read(rel) {
      if (cache.has(rel)) return cache.get(rel);
      let content = null;
      try {
        content = fs.readFileSync(path.join(absRoot, rel), 'utf8');
      } catch {
        content = null;
      }
      cache.set(rel, content);
      return content;
    },

    readJson(rel) {
      const text = ctx.read(rel);
      if (text == null) return null;
      try {
        return JSON.parse(text);
      } catch {
        return null;
      }
    },

    size(rel) {
      try {
        return fs.statSync(path.join(absRoot, rel)).size;
      } catch {
        return 0;
      }
    },

    exists(rel) {
      return fs.existsSync(path.join(absRoot, rel));
    },
  };

  ctx.project = detectProject(ctx);
  return ctx;
}

function detectProject(ctx) {
  const ecosystems = [];
  if (ctx.find('package.json')) ecosystems.push('node');
  if (ctx.find('pyproject.toml', 'setup.py', 'setup.cfg', 'requirements.txt')) ecosystems.push('python');
  if (ctx.find('go.mod')) ecosystems.push('go');
  if (ctx.find('Cargo.toml')) ecosystems.push('rust');
  if (ctx.find('pom.xml', 'build.gradle', 'build.gradle.kts')) ecosystems.push('java');
  if (ctx.find('Gemfile')) ecosystems.push('ruby');
  if (ctx.find('composer.json')) ecosystems.push('php');
  if (ctx.match(/\.(csproj|sln)$/i).length) ecosystems.push('dotnet');

  const pkg = ctx.readJson('package.json');
  let name = pkg?.name || null;
  if (!name) {
    const toml = ctx.read('pyproject.toml') || ctx.read('Cargo.toml');
    const m = toml && toml.match(/^\s*name\s*=\s*["']([^"']+)["']/m);
    if (m) name = m[1];
  }
  if (!name) {
    const gomod = ctx.read('go.mod');
    const m = gomod && gomod.match(/^module\s+(\S+)/m);
    if (m) name = m[1].split('/').pop();
  }
  if (!name) name = path.basename(ctx.root);

  return { ecosystems, name, remote: detectRemote(ctx) };
}

function detectRemote(ctx) {
  if (!ctx.git) return null;
  try {
    const url = execFileSync('git', ['remote', 'get-url', 'origin'], {
      cwd: ctx.root,
      stdio: ['ignore', 'pipe', 'ignore'],
    }).toString().trim();
    const m = url.match(/github\.com[:/]([^/]+)\/(.+?)(?:\.git)?$/);
    if (m) return { host: 'github', owner: m[1], repo: m[2], url: `https://github.com/${m[1]}/${m[2]}` };
    return { host: 'other', url: url.replace(/\/\/[^/@]*@/, '//') };
  } catch {
    return null;
  }
}
