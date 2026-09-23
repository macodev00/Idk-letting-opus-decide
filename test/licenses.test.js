import { test } from 'node:test';
import assert from 'node:assert/strict';
import { detectLicense, normalizeLicenseId, renderLicense, SUPPORTED_LICENSES } from '../src/licenses.js';

test('every bundled license is detected as itself', () => {
  for (const id of SUPPORTED_LICENSES) {
    assert.equal(detectLicense(renderLicense(id)), id, id);
  }
});

test('renderLicense fills in year and holder', () => {
  const text = renderLicense('MIT', { year: 2030, holder: 'Jane Doe' });
  assert.match(text, /Copyright \(c\) 2030 Jane Doe/);
  assert.doesNotMatch(text, /\[year\]|\[fullname\]/);
});

test('renderLicense is case-insensitive and rejects unknown ids', () => {
  assert.match(renderLicense('apache-2.0'), /Apache License/);
  assert.throws(() => renderLicense('WTFPL'), /Unsupported license/);
});

test('detects 0BSD separately from ISC', () => {
  const zeroBsd = `Permission to use, copy, modify, and/or distribute this software for
any purpose with or without fee is hereby granted.

THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES`;
  assert.equal(detectLicense(zeroBsd), '0BSD');
  assert.equal(detectLicense(renderLicense('ISC')), 'ISC');
});

test('unknown text is not detected', () => {
  assert.equal(detectLicense('All rights reserved.'), null);
  assert.equal(detectLicense(''), null);
});

test('normalizeLicenseId handles common spellings', () => {
  assert.equal(normalizeLicenseId('GPL-3.0-only'), 'GPL-3.0');
  assert.equal(normalizeLicenseId('GPL-3.0-or-later'), 'GPL-3.0');
  assert.equal(normalizeLicenseId('Apache 2.0'), 'Apache-2.0');
  assert.equal(normalizeLicenseId('mit'), 'MIT');
  assert.equal(normalizeLicenseId(undefined), null);
});
