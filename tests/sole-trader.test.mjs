import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function walkHtml(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === '.git') continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walkHtml(full, out);
    else if (entry.name.endsWith('.html')) out.push(full);
  }
  return out;
}

test('pages do not name a Ltd company or a company number', () => {
  const pages = walkHtml(root);
  assert.ok(pages.length >= 17);
  const banned = [
    /\bLtd\b/,
    /\bLimited\b/,
    /\bCRN\b/i,
    /Company\s+number/i,
    /Company\s+No\b/i,
  ];
  for (const file of pages) {
    const html = fs.readFileSync(file, 'utf8');
    for (const pattern of banned) {
      assert.equal(pattern.test(html), false, `${file} matches ${pattern}`);
    }
    assert.match(html, /© 2026 TTCG\. Christopher Whyte trading as TTCG, Cornwall\.<br><a href="mailto:chris@tothecarpgods.com">/);
  }
  const about = fs.readFileSync(path.join(root, 'about/index.html'), 'utf8');
  assert.match(about, /Founder of TTCG\./);
  assert.doesNotMatch(about, /Founder of To The Carp Gods Ltd/);
});
