import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile, writeFile, mkdir, realpath } from 'node:fs/promises';
import { resolve, join, sep, extname } from 'node:path';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';

const { values } = parseArgs({ options: {
  diretorio: { type: 'string', default: '_site' },
  playwright: { type: 'string', default: '.prerender-deps/node_modules/playwright' },
  publicador: { type: 'string', default: '.publicacao-descoberta' },
  navegador: { type: 'string' },
} });
const require = createRequire(import.meta.url);
const { chromium } = require(resolve(values.playwright));
const { parse } = await import(pathToFileURL(resolve(values.publicador, 'node_modules/parse5/dist/index.js')));
const root = await realpath(resolve(values.diretorio));
const routes = ['', 'sobre', 'servicos', 'portfolio', 'blog', 'contato'];
const walk = node => [node, ...(node.childNodes || []).flatMap(walk)];
const attr = (node, name) => node.attrs?.find(a => a.name === name)?.value;
const original = await readFile(join(root, 'index.html'), 'utf8');
const nodes = walk(parse(original, { sourceCodeLocationInfo: true }));
const mount = nodes.find(n => n.tagName === 'div' && attr(n, 'id') === 'root')?.sourceCodeLocation;
assert.ok(mount?.endTag, 'Root público pré-renderizado ausente.');
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.ico': 'image/x-icon' };
const server = createServer(async (req, res) => {
  try {
    if (!['GET', 'HEAD'].includes(req.method)) { res.writeHead(405).end(); return; }
    const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    const file = await realpath(resolve(root, '.' + pathname + (pathname.endsWith('/') ? 'index.html' : '')));
    if (!file.startsWith(root + sep)) { res.writeHead(404).end(); return; }
    res.writeHead(200, { 'Content-Type': types[extname(file)] || 'application/octet-stream' });
    res.end(req.method === 'HEAD' ? undefined : await readFile(file));
  } catch { res.writeHead(404).end(); }
});
await new Promise(done => server.listen(0, '127.0.0.1', done));
const origin = 'http://127.0.0.1:' + server.address().port;
const browser = await chromium.launch({ headless: true, ...(values.navegador ? { executablePath: values.navegador } : {}) });
const escape = text => text.replace(/[&<>"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));
const snapshots = [];
try {
  const context = await browser.newContext({ serviceWorkers: 'block' });
  await context.route('**/*', route => new URL(route.request().url()).origin === origin ? route.continue() : route.fulfill({ status: 204 }));
  // Capture each real application route before introducing the URL bridge.
  for (const slug of routes) {
    const page = await context.newPage();
    await page.goto(origin + '/#/' + slug, { waitUntil: 'networkidle' });
    await page.locator('#root main h1').first().waitFor({ state: 'visible' });
    const snapshot = await page.locator('#root').evaluate((element, knownRoutes) => {
      const clone = element.cloneNode(true);
      for (const image of clone.querySelectorAll('img[src]')) {
        const source = image.getAttribute('src');
        if (source && !/^(?:[a-z]+:|\/)/i.test(source)) image.setAttribute('src', '/' + source.replace(/^\.\//, ''));
      }
      for (const anchor of clone.querySelectorAll('a[href^="#/"]')) {
        const [slug, section] = anchor.getAttribute('href').slice(2).split('#');
        if (knownRoutes.includes(slug)) anchor.setAttribute('href', (slug ? '/' + slug + '/' : '/') + (section ? '#' + section : ''));
      }
      for (const parent of [clone, ...clone.querySelectorAll('*')]) {
        let previous;
        for (const child of [...parent.childNodes]) {
          if (previous?.nodeType === Node.TEXT_NODE && child.nodeType === Node.TEXT_NODE) parent.insertBefore(document.createComment(''), child);
          previous = child;
        }
      }
      const normalize = value => value.replace(/\s+/g, ' ').trim();
      return { markup: clone.innerHTML, h1: normalize(element.querySelector('main h1').textContent), description: normalize(element.querySelector('main p')?.textContent || ''), length: normalize(element.textContent).length };
    }, routes);
    assert.ok(snapshot.length > 300 && snapshot.h1, 'Rota sem conteúdo: ' + slug);
    assert.ok(!/<script\b/i.test(snapshot.markup), 'Scripts não podem ser duplicados no snapshot.');
    snapshots.push({ slug, ...snapshot });
    await page.close();
  }
  await context.close();
  await writeFile(join(root, 'hash-routes.js'), await readFile(new URL('./hash-routes.js', import.meta.url)));
  for (const { slug, markup, h1, description } of snapshots) {
    let html = original.slice(0, mount.startTag.endOffset) + markup + original.slice(mount.endTag.startOffset);
    html = html.replace(/<head>/i, '<head><base href="/">');
    html = html.replace(/<title>[^]*?<\/title>/i, '<title>' + escape(h1 + ' • Sete & Sete Engenharia') + '</title>');
    html = html.replace(/<meta\s+name=["']description["'][^>]*>/i, '<meta name="description" content="' + escape(description || h1) + '">');
    html = html.replace(/<script\b/i, '<script src="/hash-routes.js"></script>\n<script');
    const directory = slug ? join(root, slug) : root;
    await mkdir(directory, { recursive: true });
    await writeFile(join(directory, 'index.html'), html);
  }
  const evidence = [];
  for (const javaScriptEnabled of [false, true]) {
    const context = await browser.newContext({ javaScriptEnabled, serviceWorkers: 'block' });
    await context.route('**/*', route => new URL(route.request().url()).origin === origin ? route.continue() : route.fulfill({ status: 204 }));
    for (const snapshot of snapshots) {
      const page = await context.newPage();
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      const path = snapshot.slug ? '/' + snapshot.slug + '/' : '/';
      const response = await page.goto(origin + path, { waitUntil: 'networkidle' });
      assert.equal(response.status(), 200);
      assert.equal((await page.locator('main h1').first().textContent()).replace(/\s+/g, ' ').trim(), snapshot.h1);
      assert.deepEqual(errors, [], 'Erro de execução em ' + path);
      const imageFailures = await page.evaluate(async () => {
        const results = await Promise.all([...document.images].map(async image => {
          const url = image.currentSrc || image.src;
          const response = await fetch(url);
          return response.ok ? null : url;
        }));
        return results.filter(Boolean);
      });
      assert.deepEqual(imageFailures, [], 'Imagem relativa inválida em ' + path);
      evidence.push({ path, javaScriptEnabled, h1: snapshot.h1 });
      await page.close();
    }
    if (javaScriptEnabled) {
      const page = await context.newPage();
      await page.goto(origin + '/#/sobre', { waitUntil: 'networkidle' });
      await page.waitForURL(origin + '/sobre/#/sobre');
      assert.equal((await page.locator('main h1').textContent()).trim(), snapshots.find(s => s.slug === 'sobre').h1);
      await page.close();
    }
    await context.close();
  }
  await mkdir('.prerender-check', { recursive: true });
  await writeFile('.prerender-check/routes.json', JSON.stringify(evidence, null, 2) + '\n');
  console.log(JSON.stringify({ routes: snapshots.length, checks: evidence.length, oldHashNavigation: true }));
} finally {
  await browser.close();
  await new Promise(done => server.close(done));
}
