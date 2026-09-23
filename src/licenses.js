import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const TEMPLATE_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'templates', 'licenses');

export const SUPPORTED_LICENSES = [
  'MIT', 'Apache-2.0', 'ISC', 'BSD-2-Clause', 'BSD-3-Clause',
  'MPL-2.0', 'GPL-3.0', 'LGPL-3.0', 'AGPL-3.0', 'Unlicense',
];

// Order matters: more specific fingerprints must come before the ones they contain.
const FINGERPRINTS = [
  ['MPL-2.0', [/Mozilla Public License/i, /2\.0/]],
  ['AGPL-3.0', [/GNU AFFERO GENERAL PUBLIC LICENSE/i]],
  ['LGPL-3.0', [/GNU LESSER GENERAL PUBLIC LICENSE/i]],
  ['GPL-3.0', [/GNU GENERAL PUBLIC LICENSE/i, /Version 3/i]],
  ['GPL-2.0', [/GNU GENERAL PUBLIC LICENSE/i, /Version 2/i]],
  ['Apache-2.0', [/Apache License/i, /Version 2\.0/i]],
  ['BSD-3-Clause', [/Redistribution and use in source and binary forms/i, /Neither the name/i]],
  ['BSD-2-Clause', [/Redistribution and use in source and binary forms/i]],
  ['ISC', [/Permission to use, copy, modify, and\/or distribute this software for any/i]],
  ['MIT', [/Permission is hereby granted, free of charge/i]],
  ['Unlicense', [/This is free and unencumbered software released into the public domain/i]],
  ['BSL-1.0', [/Boost Software License/i]],
  ['EPL-2.0', [/Eclipse Public License/i, /2\.0/]],
  ['CC0-1.0', [/CC0 1\.0 Universal/i]],
];

const ZERO_BSD = /distribute this software for\s+any\s+purpose\s+with\s+or\s+without\s+fee\s+is\s+hereby\s+granted\.\s/i;

export function detectLicense(text) {
  if (!text) return null;
  const head = text.slice(0, 6000).replace(/\s+/g, ' ');
  if (ZERO_BSD.test(head)) return '0BSD';
  for (const [id, patterns] of FINGERPRINTS) {
    if (patterns.every((p) => p.test(head))) return id;
  }
  return null;
}

/** Normalize common license identifiers (e.g. "GPL-3.0-only", "Apache 2.0") to the ids used here. */
export function normalizeLicenseId(id) {
  if (!id || typeof id !== 'string') return null;
  const s = id.trim().replace(/\s+/g, '-').replace(/-(only|or-later)$/i, '').replace(/\+$/, '');
  const aliases = {
    'apache-2': 'Apache-2.0', 'apache2': 'Apache-2.0', 'apache-2.0': 'Apache-2.0', 'apache-license-2.0': 'Apache-2.0',
    'mit': 'MIT', 'mit-license': 'MIT', 'isc': 'ISC',
    'bsd-2-clause': 'BSD-2-Clause', 'bsd-3-clause': 'BSD-3-Clause', 'bsd': 'BSD-3-Clause',
    'mpl-2.0': 'MPL-2.0', 'gpl-3.0': 'GPL-3.0', 'gpl-3': 'GPL-3.0', 'gplv3': 'GPL-3.0', 'gpl-2.0': 'GPL-2.0', 'gplv2': 'GPL-2.0',
    'lgpl-3.0': 'LGPL-3.0', 'agpl-3.0': 'AGPL-3.0', 'unlicense': 'Unlicense', 'the-unlicense': 'Unlicense',
    '0bsd': '0BSD', 'cc0-1.0': 'CC0-1.0', 'bsl-1.0': 'BSL-1.0', 'epl-2.0': 'EPL-2.0',
  };
  return aliases[s.toLowerCase()] || s;
}

export function renderLicense(id, { year = new Date().getFullYear(), holder = 'The contributors' } = {}) {
  const canonical = SUPPORTED_LICENSES.find((l) => l.toLowerCase() === String(id).toLowerCase());
  if (!canonical) {
    throw new Error(`Unsupported license "${id}". Supported: ${SUPPORTED_LICENSES.join(', ')}`);
  }
  const text = fs.readFileSync(path.join(TEMPLATE_DIR, `${canonical}.txt`), 'utf8');
  return text.replace(/\[year\]/g, String(year)).replace(/\[fullname\]/g, holder);
}
