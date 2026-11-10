import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function read(rel) {
  return fs.readFileSync(path.join(root, rel), 'utf8');
}

function walkHtml(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walkHtml(full, out);
    else if (entry.name.endsWith('.html')) out.push(full);
  }
  return out;
}

const articles = new Set([
  'https://tothecarpgods.com/journal/be-where-your-feet-are/',
  'https://tothecarpgods.com/journal/from-bottle-to-bank/',
  'https://tothecarpgods.com/journal/roots-before-branches/',
  'https://tothecarpgods.com/journal/survival-does-not-run-the-rest/',
]);

function fileForLoc(loc) {
  const pathName = new URL(loc).pathname;
  if (pathName === '/') return 'index.html';
  return `${pathName.slice(1)}index.html`;
}

test('retired /ebook/ and /shop/ stay noindex Support directions', () => {
  for (const route of ['ebook', 'shop']) {
    const html = read(`${route}/index.html`);
    assert.match(html, /<meta name="robots" content="noindex"\s*\/?>/);
    assert.match(html, /<a class="btn" href="\/support\/">Go to Support<\/a>/);
    assert.doesNotMatch(html.slice(html.indexOf('<main>'), html.indexOf('</main>')), /patreon|£|purchase|checkout|download/i);
    assert.equal(fs.existsSync(path.join(root, 'support', 'index.html')), true);
  }
  const sitemap = read('sitemap.xml');
  assert.doesNotMatch(sitemap, /\/ebook\//);
  assert.doesNotMatch(sitemap, /\/shop\//);
  assert.equal(fs.existsSync(path.join(root, 'privacy', 'index.html')), false);
  assert.equal(fs.existsSync(path.join(root, 'terms', 'index.html')), false);
});

test('stale medication-free clause is gone and the sober date stays', () => {
  const pages = [
    'index.html',
    'recovery/index.html',
    'about/index.html',
    'journal/from-bottle-to-bank/index.html',
  ];
  for (const rel of pages) {
    const html = read(rel);
    assert.equal(html.includes('medication-free'), false, rel);
    assert.equal(html.includes('Coming up on a year'), false, rel);
    assert.match(html, /Sober since 30 March 2022/);
  }
  for (const file of walkHtml(root)) {
    const html = fs.readFileSync(file, 'utf8');
    assert.equal(html.includes('medication-free'), false, file);
  }
});

test('sitemap pages have canonical, Open Graph, and Twitter cards', () => {
  const sitemap = read('sitemap.xml');
  const locs = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1]);
  assert.ok(locs.length >= 14);
  for (const loc of locs) {
    assert.equal(loc.endsWith('/') || loc.endsWith('.html'), true, loc);
    const html = read(fileForLoc(loc));
    const canonical = html.match(/<link rel="canonical" href="([^"]+)" \/>/);
    const ogUrl = html.match(/<meta property="og:url" content="([^"]+)" \/>/);
    const ogType = html.match(/<meta property="og:type" content="([^"]+)" \/>/);
    const card = html.match(/<meta name="twitter:card" content="([^"]+)" \/>/);
    const twTitle = html.match(/<meta name="twitter:title" content="([^"]*)" \/>/);
    const twDesc = html.match(/<meta name="twitter:description" content="([^"]*)" \/>/);
    const twImage = html.match(/<meta name="twitter:image" content="([^"]+)" \/>/);
    const ogTitle = html.match(/<meta property="og:title" content="([^"]*)" \/>/);
    const ogDesc = html.match(/<meta property="og:description" content="([^"]*)" \/>/);
    assert.ok(canonical, loc);
    assert.equal(canonical[1], loc);
    assert.equal(ogUrl[1], loc);
    assert.equal(ogType[1], articles.has(loc) ? 'article' : 'website');
    assert.equal(card[1], 'summary_large_image');
    assert.equal(twImage[1], 'https://tothecarpgods.com/og.jpg');
    assert.equal(twTitle[1], ogTitle[1]);
    assert.equal(twDesc[1], ogDesc[1]);
    assert.match(html, /<link rel="icon"/);
    assert.match(html, /<meta property="og:image" content="https:\/\/tothecarpgods\.com\/og\.jpg" \/>/);
  }
});

test('favicon files exist and are images from the mark', () => {
  const ico = fs.readFileSync(path.join(root, 'favicon.ico'));
  const touch = fs.readFileSync(path.join(root, 'apple-touch-icon.png'));
  const logo = fs.readFileSync(path.join(root, 'logo-192.png'));
  assert.equal(ico.readUInt16LE(0), 0);
  assert.equal(ico.readUInt16LE(2), 1);
  assert.equal(touch.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
  assert.equal(touch.equals(logo), true);
});
