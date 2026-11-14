import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createServer } from 'node:http';
import { readFile, writeFile, mkdir, realpath, readdir } from 'node:fs/promises';
import { resolve, join, extname, sep } from 'node:path';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';

const { values } = parseArgs({ options: {
  diretorio: { type: 'string', default: '_site' },
  playwright: { type: 'string', default: '.prerender-deps/node_modules/playwright' },
  publicador: { type: 'string', default: '.publicacao-descoberta' },
  evidencias: { type: 'string', default: '.prerender-check' },
  modo: { type: 'string' },
} });
assert.ok(['gerar', 'verificar'].includes(values.modo), 'Escolha --modo gerar ou --modo verificar.');
const require = createRequire(import.meta.url);
const { chromium } = require(resolve(values.playwright));
const raiz = await realpath(resolve(values.diretorio));
const evidencias = resolve(values.evidencias);
const index = join(raiz, 'index.html');
const origemPublica = 'https://seteeseteengenharia.com.br/';
const hash = conteudo => createHash('sha256').update(conteudo).digest('hex');
const tipos = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.ico': 'image/x-icon', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.txt': 'text/plain', '.xml': 'application/xml' };

async function assetsDa(pasta, prefixo = '') {
  const itens = {};
  for (const item of await readdir(pasta, { withFileTypes: true })) {
    assert.ok(!item.isSymbolicLink(), 'O artefato não pode conter symlinks.');
    const relativo = prefixo + item.name;
    if (item.isDirectory()) Object.assign(itens, await assetsDa(join(pasta, item.name), relativo + '/'));
    else if (relativo !== 'index.html') itens[relativo] = hash(await readFile(join(pasta, item.name)));
  }
  return itens;
}

// Only the copied public artifact is served, on loopback and an ephemeral port.
const servidor = createServer(async (pedido, resposta) => {
  try {
    if (!['GET', 'HEAD'].includes(pedido.method)) { resposta.writeHead(405).end(); return; }
    const caminho = decodeURIComponent(new URL(pedido.url, 'http://localhost').pathname);
    const arquivo = await realpath(resolve(raiz, '.' + (caminho.endsWith('/') ? caminho + 'index.html' : caminho)));
    if (!arquivo.startsWith(raiz + sep)) { resposta.writeHead(404).end(); return; }
    const conteudo = await readFile(arquivo);
    resposta.writeHead(200, { 'Content-Type': (tipos[extname(arquivo)] || 'application/octet-stream') + '; charset=utf-8', 'Cache-Control': 'no-store' });
    resposta.end(pedido.method === 'HEAD' ? undefined : conteudo);
  } catch { resposta.writeHead(404).end(); }
});
await new Promise((concluir, rejeitar) => { servidor.once('error', rejeitar); servidor.listen(0, '127.0.0.1', concluir); });
const origemLocal = 'http://127.0.0.1:' + servidor.address().port;
let navegador;
let requestsExternosPermitidos = 0;
let requestsExternosBloqueados = 0;

async function abrir(javaScriptEnabled) {
  const contexto = await navegador.newContext({ javaScriptEnabled, viewport: { width: 1280, height: 900 }, locale: 'pt-BR', serviceWorkers: 'block' });
  await contexto.route('**/*', async rota => {
    const pedido = rota.request();
    if (new URL(pedido.url()).origin === origemLocal && ['GET', 'HEAD'].includes(pedido.method())) await rota.continue();
    else { requestsExternosBloqueados++; await rota.fulfill({ status: 204 }); }
  });
  const pagina = await contexto.newPage();
  pagina.setDefaultTimeout(15000);
  pagina.setDefaultNavigationTimeout(20000);
  const erros = [];
  pagina.on('pageerror', erro => erros.push(erro.message));
  await pagina.goto(origemLocal + '/', { waitUntil: 'networkidle' });
  await pagina.locator('#root main#conteudo h1').first().waitFor({ state: 'visible' });
  return { contexto, pagina, erros };
}

async function lerPublico(pagina) {
  return pagina.locator('#root').evaluate(raiz => {
    const normalizar = texto => texto.replace(/\s+/g, ' ').trim();
    if (raiz.querySelector('form, input[type="password"]')) throw new Error('Estado de formulário não pode ser pré-renderizado.');
    if (![...raiz.querySelectorAll('img')].some(imagem => imagem.alt.includes('Sete & Sete'))) throw new Error('A identidade pública da fonte não foi renderizada.');
    return { texto: normalizar(raiz.textContent), h1: normalizar(raiz.querySelector('main h1').textContent), titulo: document.title };
  });
}

try {
  navegador = await chromium.launch({ headless: true });
  await mkdir(evidencias, { recursive: true });
  if (values.modo === 'gerar') {
    const original = await readFile(index, 'utf8');
    const lugares = [...original.matchAll(/<div\s+id=["']root["']\s*>\s*<\/div>/g)];
    assert.equal(lugares.length, 1, 'A fonte precisa ter exatamente um root vazio conhecido.');
    const assets = await assetsDa(raiz);
    const { contexto, pagina, erros } = await abrir(true);
    const publico = await lerPublico(pagina);
    assert.ok(publico.texto.length > 1000, 'O conteúdo público real ainda não foi renderizado.');
    assert.deepEqual(erros, [], 'O bundle público não pode apresentar erro de execução.');
    const markup = await pagina.locator('#root').innerHTML();
    assert.ok(!/<script\b/i.test(markup), 'O snapshot da root não pode duplicar scripts.');
    await writeFile(join(evidencias, 'original-root.html'), markup);
    const captura = await pagina.screenshot({ fullPage: true, animations: 'disabled' });
    await writeFile(join(evidencias, 'antes.png'), captura);
    const lugar = lugares[0];
    const prefixo = original.slice(0, lugar.index);
    const sufixo = original.slice(lugar.index + lugar[0].length);
    const abertura = lugar[0].slice(0, lugar[0].indexOf('>') + 1);
    await writeFile(index, prefixo + abertura + markup + '</div>' + sufixo);
    await writeFile(join(evidencias, 'baseline.json'), JSON.stringify({ ...publico, assets, prefixo, sufixo, screenshot: hash(captura) }, null, 2));
    await contexto.close();
    console.log(JSON.stringify({ modo: values.modo, caracteres: publico.texto.length, rota: '/', assetsPreservados: Object.keys(assets).length, requestsExternosPermitidos, requestsExternosBloqueados }));
  } else {
    const baseline = JSON.parse(await readFile(join(evidencias, 'baseline.json'), 'utf8'));
    const atual = await readFile(index, 'utf8');
    const modulo = pathToFileURL(resolve(values.publicador, 'js/descoberta.mjs')).href;
    const { injetarDescoberta } = await import(modulo);
    const semDescoberta = injetarDescoberta(atual, { url: origemPublica, remover: true });
    assert.ok(semDescoberta.startsWith(baseline.prefixo) && semDescoberta.endsWith(baseline.sufixo), 'Head e scripts originais precisam permanecer intactos.');
    const assets = await assetsDa(raiz);
    for (const [caminho, sha] of Object.entries(baseline.assets)) assert.equal(assets[caminho], sha, 'Asset original alterado: ' + caminho);
    const catalogo = JSON.parse(await readFile(join(raiz, '.well-known/ard.json'), 'utf8'));
    assert.equal(catalogo.entries.length, 1, 'Somente a root possui HTML pré-renderizado neste build.');
    assert.equal(catalogo.entries[0].url, origemPublica);
    for (const ativo of [false, true]) {
      const { contexto, pagina, erros } = await abrir(ativo);
      if (ativo) await pagina.waitForFunction(titulo => document.title === titulo, baseline.titulo);
      const publico = await lerPublico(pagina);
      const nome = ativo ? 'javascript-ligado' : 'javascript-desligado';
      await writeFile(join(evidencias, nome + '-root.html'), await pagina.locator('#root').innerHTML());
      const diagnostico = await pagina.locator('#root').evaluate(raiz => ({
        atributosHtml: [...document.documentElement.attributes].map(a => [a.name, a.value]),
        atributosBody: [...document.body.attributes].map(a => [a.name, a.value]),
        viewport: [innerWidth, innerHeight, document.documentElement.scrollHeight],
        elementos: [...raiz.querySelectorAll('header, main, h1, h2, img, footer')].map(e => {
          const r = e.getBoundingClientRect(); const c = getComputedStyle(e);
          return { tag: e.tagName, texto: e.textContent.slice(0, 80), rect: [r.x, r.y, r.width, r.height], font: c.fontFamily, display: c.display, complete: e.complete, src: e.getAttribute('src') };
        }),
      }));
      await writeFile(join(evidencias, nome + '-layout.json'), JSON.stringify(diagnostico, null, 2));
      assert.equal(publico.texto, baseline.texto, 'O texto muda com JavaScript ' + ativo);
      assert.equal(publico.h1, baseline.h1);
      assert.deepEqual(erros, []);
      const captura = await pagina.screenshot({ fullPage: true, animations: 'disabled' });
      await writeFile(join(evidencias, ativo ? 'javascript-ligado.png' : 'javascript-desligado.png'), captura);
      assert.equal(hash(captura), baseline.screenshot, 'O visual da root mudou com JavaScript ' + ativo);
      if (ativo) {
        await pagina.evaluate(() => { location.hash = '#/sobre'; });
        await pagina.waitForFunction(h1 => document.querySelector('#conteudo h1')?.textContent.trim() && document.querySelector('#conteudo h1').textContent.trim() !== h1, baseline.h1);
        assert.equal(new URL(pagina.url()).hash, '#/sobre');
        await pagina.evaluate(() => { location.hash = '#/'; });
        await pagina.waitForFunction(h1 => document.querySelector('#conteudo h1')?.textContent.trim() === h1, baseline.h1);
        assert.deepEqual(erros, []);
      }
      await contexto.close();
    }
    console.log(JSON.stringify({ modo: values.modo, catalogo: 'root apenas', textoEVisual: 'iguais com JavaScript ligado e desligado', navegacaoHash: 'aprovada', assetsPreservados: Object.keys(baseline.assets).length, requestsExternosPermitidos, requestsExternosBloqueados }));
  }
} finally {
  await navegador?.close();
  await new Promise(concluir => servidor.close(concluir));
}
