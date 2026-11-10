import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import fs from 'node:fs';
import http from 'node:http';
import net from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { setTimeout as delay } from 'node:timers/promises';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const routes = [
  {
    urlPath: '/ebook/',
    file: 'ebook/index.html',
    heading: 'No ebook on this site.',
  },
  {
    urlPath: '/shop/',
    file: 'shop/index.html',
    heading: 'No shop on this site.',
  },
];

const promisePhrases = [
  'buy',
  'purchase',
  'checkout',
  'basket',
  'cart',
  'download',
  '£',
  'ebook included',
  'included in patreon',
  'included with patreon',
  'patreon includes',
  'free ebook',
  'shop now',
  'order now',
];

function read(rel) {
  return fs.readFileSync(path.join(root, rel), 'utf8');
}

function mainHtml(html) {
  const start = html.indexOf('<main>');
  const end = html.indexOf('</main>');
  assert.ok(start !== -1 && end > start, 'page needs a main element');
  return html.slice(start, end);
}

function freePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address();
      server.close(() => resolve(port));
    });
  });
}

function startStatic() {
  const server = http.createServer((req, res) => {
    const url = new URL(req.url, 'http://127.0.0.1');
    let rel = decodeURIComponent(url.pathname);
    if (rel.endsWith('/')) rel += 'index.html';
    const file = path.resolve(root, '.' + rel);
    if (!file.startsWith(root + path.sep) && file !== root) {
      res.writeHead(403);
      res.end('forbidden');
      return;
    }
    fs.readFile(file, (err, data) => {
      if (err) {
        res.writeHead(404);
        res.end('missing');
        return;
      }
      const types = {
        '.html': 'text/html; charset=utf-8',
        '.css': 'text/css; charset=utf-8',
        '.js': 'text/javascript; charset=utf-8',
        '.png': 'image/png',
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.webp': 'image/webp',
        '.svg': 'image/svg+xml',
        '.xml': 'application/xml',
        '.txt': 'text/plain; charset=utf-8',
      };
      res.writeHead(200, {
        'content-type': types[path.extname(file).toLowerCase()] || 'application/octet-stream',
      });
      res.end(data);
    });
  });
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve(server));
  });
}

test('retired /ebook/ and /shop/ resolve to honest Support directions', async () => {
  const support = read('support/index.html');
  assert.match(support, /Bankside/);
  assert.match(support, /£3 \/ month/);
  assert.match(support, /Keep The Session/);
  assert.match(support, /£5 \/ month/);
  assert.match(support, /https:\/\/www\.patreon\.com\/c\/TTCG_Communities/);

  const sitemap = read('sitemap.xml');
  assert.doesNotMatch(sitemap, /ebook/i);
  assert.doesNotMatch(sitemap, /shop/i);

  const homeNav = read('index.html').match(/<nav class="desk"[\s\S]*?<\/nav>/)[0];
  assert.doesNotMatch(homeNav, /href="\/ebook\//);
  assert.doesNotMatch(homeNav, /href="\/shop\//);
  for (const href of ['/journal/', '/community/', '/drop/', '/recovery/', '/support/', '/about/', '/join/']) {
    assert.match(homeNav, new RegExp(`href="${href}"`));
  }

  const server = await startStatic();
  const { port } = server.address();
  try {
    for (const route of routes) {
      assert.equal(fs.existsSync(path.join(root, route.file)), true, route.file);
      const res = await fetch(`http://127.0.0.1:${port}${route.urlPath}`);
      assert.equal(res.status, 200, route.urlPath);
      const html = await res.text();
      assert.match(html, /<meta name="robots" content="noindex"\s*\/?>/);
      assert.match(html, new RegExp(`<h1>${route.heading.replace('.', '\\.')}</h1>`));
      assert.match(html, /<a class="btn" href="\/support\/">Go to Support<\/a>/);
      const main = mainHtml(html);
      const plain = main.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').toLowerCase();
      for (const phrase of promisePhrases) {
        assert.equal(plain.includes(phrase), false, `${route.urlPath} main contains "${phrase}"`);
      }
      assert.doesNotMatch(main, /patreon/i);
      assert.match(main, /nothing is sold from this address/i);
      const nav = html.match(/<nav class="desk"[\s\S]*?<\/nav>/)[0];
      assert.equal(nav, homeNav);
      const supportRes = await fetch(new URL(html.match(/<a class="btn" href="(\/support\/)"/)[1], `http://127.0.0.1:${port}`));
      assert.equal(supportRes.status, 200);
      const supportBody = await supportRes.text();
      assert.match(supportBody, /£3 \/ month/);
      assert.match(supportBody, /£5 \/ month/);
      assert.match(supportBody, /Join Bankside on Patreon/);
      assert.match(supportBody, /Keep The Session on Patreon/);
    }
  } finally {
    server.close();
    await once(server, 'close');
  }
});

test('retired pages do not overflow at 360px', async () => {
  const chrome = ['/usr/bin/google-chrome', '/usr/local/bin/google-chrome', '/usr/bin/google-chrome-stable']
    .find((candidate) => fs.existsSync(candidate));
  assert.ok(chrome, 'google-chrome is required for the viewport check');
  const server = await startStatic();
  const { port } = server.address();
  const debugPort = await freePort();
  const profile = fs.mkdtempSync('/tmp/ttcg-chrome-');
  const chromeProc = spawn(chrome, [
    '--headless=new',
    '--disable-gpu',
    '--no-sandbox',
    '--disable-dev-shm-usage',
    `--remote-debugging-port=${debugPort}`,
    '--window-size=360,800',
    `--user-data-dir=${profile}`,
    'about:blank',
  ], { stdio: 'ignore' });
  try {
    let version;
    for (let i = 0; i < 50; i++) {
      try {
        const res = await fetch(`http://127.0.0.1:${debugPort}/json/version`);
        if (res.ok) {
          version = await res.json();
          break;
        }
      } catch {
        await delay(100);
      }
    }
    assert.ok(version?.webSocketDebuggerUrl, 'chrome devtools did not start');
    const browser = new WebSocket(version.webSocketDebuggerUrl);
    await once(browser, 'open');
    let nextId = 0;
    function send(socket, method, params = {}) {
      const id = ++nextId;
      return new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error(`timeout ${method}`)), 10000);
        function onMessage(event) {
          const message = JSON.parse(event.data);
          if (message.id !== id) return;
          clearTimeout(timer);
          socket.removeEventListener('message', onMessage);
          if (message.error) reject(new Error(JSON.stringify(message.error)));
          else resolve(message.result);
        }
        socket.addEventListener('message', onMessage);
        socket.send(JSON.stringify({ id, method, params }));
      });
    }
    const outDir = process.env.TTCG_SCREENSHOT_DIR || '/tmp/ttcg-retired-screenshots';
    fs.mkdirSync(outDir, { recursive: true });
    for (const route of routes) {
      const created = await send(browser, 'Target.createTarget', { url: 'about:blank' });
      let pageSocketUrl;
      for (let i = 0; i < 30; i++) {
        const listRes = await fetch(`http://127.0.0.1:${debugPort}/json/list`);
        const list = await listRes.json();
        const page = list.find((entry) => entry.id === created.targetId);
        if (page?.webSocketDebuggerUrl) {
          pageSocketUrl = page.webSocketDebuggerUrl;
          break;
        }
        await delay(100);
      }
      assert.ok(pageSocketUrl, `no page socket for ${route.urlPath}`);
      const page = new WebSocket(pageSocketUrl);
      await once(page, 'open');
      await send(page, 'Page.enable');
      await send(page, 'Runtime.enable');
      await send(page, 'Emulation.setDeviceMetricsOverride', {
        width: 360,
        height: 800,
        deviceScaleFactor: 1,
        mobile: true,
      });
      const loaded = new Promise((resolve) => {
        function onMessage(event) {
          const message = JSON.parse(event.data);
          if (message.method === 'Page.loadEventFired') {
            page.removeEventListener('message', onMessage);
            resolve();
          }
        }
        page.addEventListener('message', onMessage);
      });
      await send(page, 'Page.navigate', { url: `http://127.0.0.1:${port}${route.urlPath}` });
      await Promise.race([loaded, delay(5000)]);
      await send(page, 'Runtime.evaluate', {
        expression: 'document.fonts ? document.fonts.ready : Promise.resolve()',
        awaitPromise: true,
      });
      const layout = await send(page, 'Runtime.evaluate', {
        expression: `(() => {
          const doc = document.documentElement;
          const offenders = [];
          for (const el of document.body.querySelectorAll('*')) {
            const rect = el.getBoundingClientRect();
            if (rect.width < 1 && rect.height < 1) continue;
            if (rect.right > doc.clientWidth + 1 || rect.left < -1) {
              offenders.push({
                tag: el.tagName,
                className: String(el.className).slice(0, 80),
                left: Math.round(rect.left),
                right: Math.round(rect.right),
              });
            }
          }
          return {
            clientWidth: doc.clientWidth,
            scrollWidth: doc.scrollWidth,
            overflow: doc.scrollWidth > doc.clientWidth + 1,
            offenders: offenders.slice(0, 8),
            heading: document.querySelector('h1')?.textContent || '',
            supportHref: document.querySelector('main a.btn')?.getAttribute('href') || '',
          };
        })()`,
        returnByValue: true,
      });
      const value = layout.result.value;
      assert.equal(value.clientWidth, 360, route.urlPath);
      assert.equal(value.overflow, false, `${route.urlPath} scrollWidth ${value.scrollWidth} offenders ${JSON.stringify(value.offenders)}`);
      assert.equal(value.offenders.length, 0, JSON.stringify(value.offenders));
      assert.equal(value.supportHref, '/support/');
      assert.equal(value.heading, route.heading);
      const shot = await send(page, 'Page.captureScreenshot', {
        format: 'png',
        captureBeyondViewport: true,
      });
      const name = route.urlPath.replace(/\//g, '') + '-360.png';
      fs.writeFileSync(path.join(outDir, name), Buffer.from(shot.data, 'base64'));
      page.close();
      await send(browser, 'Target.closeTarget', { targetId: created.targetId });
    }
    browser.close();
  } finally {
    chromeProc.kill('SIGKILL');
    server.close();
    fs.rmSync(profile, { recursive: true, force: true });
  }
});
