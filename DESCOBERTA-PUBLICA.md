# Descoberta pública • home pré-renderizada

A origem comercial atual é este repositório, publicado pelo workflow GitHub Pages em `.github/workflows/pages.yml`. O CNAME e a cópia existente para `_site` permanecem. Não há mudança de DNS, configuração Pages/Jekyll, bundle React, CSS, scripts de medição ou outras rotas.

O `index.html` agora declara somente Organization/WebSite com a identidade existente, URL canônica, `logo.png` e `og-default.png`. Os dois assets responderam 200 image/png e coincidiram por SHA-256 com a fonte. Não se acrescentam endereço, preços, avaliações, contatos ou promessas.

## Renderização da root no CI

A fonte editorial React não está neste repositório: o site atual usa `assets/index-mgnOKzvU.js`, `createRoot` e navegação por hash. O documento original contém `#root` vazio. Um catálogo vazio não atende a descoberta da home, portanto o workflow pré-renderiza somente `/` com o próprio bundle publicado.

Depois da cópia existente para `_site`, o CI instala Playwright **1.62.0** isoladamente em `.prerender-deps`, com scripts de instalação npm desativados, e instala o Chromium correspondente. `scripts/prerender-root.mjs --modo gerar` serve somente o artefato público em loopback, espera o h1 e a identidade reais da home e captura apenas `#root.innerHTML`. Não navega por contatos, não preenche campos e recusa root com formulário ou senha. Todo tráfego externo e todo método diferente de GET/HEAD são bloqueados.

O markup capturado é inserido apenas em `_site/index.html`. Head, scripts, markup externo à root e assets são preservados. Não há reimplementação de conteúdo, edição do bundle minificado, troca por framework ou bypass do validador de páginas públicas do Core.

## Publicador e verificação

O workflow usa o Core revisado `d5067bbbe3522f459367af3b58b4298324801f82`:

```sh
node .publicacao-descoberta/bin/publicar-descoberta.mjs --diretorio _site --origem https://seteeseteengenharia.com.br
```

Depois da geração, `scripts/prerender-root.mjs --modo verificar` confere:

- ARD com exatamente a URL pública da root, sem inventar outras rotas HTML.
- Head/scripts originais e checksums de todos os assets anteriores preservados; somente marcações de descoberta são removidas para essa comparação pelo próprio Core.
- Mesmo texto, h1 e screenshot da home com JavaScript ligado e desligado, comparados ao renderer original. As fontes externas permanecem bloqueadas nos três cenários para a comparação ser equivalente; os links originais não são alterados.
- Navegação real para `#/sobre` e volta para `#/`, sem enviar ações a serviços externos.

O `createRoot` existente substitui o snapshot quando o JavaScript inicializa. O CI precisa comprovar equivalência visual e de conteúdo antes de enviar o artefato; qualquer divergência falha antes do upload/deploy. Evidências ficam em `.prerender-check`, fora de `_site`. Não foram executados build, browser de build ou testes de projeto localmente nesta implementação; a execução destes checks é do CI.

O rasterizador de fontes do ensaio usa antialiasing em tons de cinza para evitar variação LCD entre pintura CSR e HTML parseado. A comparação de screenshots permanece estrita, sem tolerância ou máscara. DOM, imagens e diagnóstico de layout ficam no artefato CI separado `prerender-evidence`. O upload público inclui arquivos ocultos para preservar `.well-known`; o checkout do publicador e as evidências não entram em `_site`.

As rotas por hash continuam responsabilidade do bundle atual. O sitemap existente não é reescrito nem convertido em páginas HTML fictícias. O módulo WebMCP central lê somente conteúdo e links públicos; não envia formulários nem executa transações. Browsers sem API preservam a navegação e o visual.

A condição que impede deploy de pull requests permanece. Para rollback, restaure o workflow e o `index.html` anteriores e publique o artefato anterior pelo Pages, sem alterar DNS ou Jekyll. Após a publicação aprovada, confira o HTML, MIME JSON/JavaScript, recursos anunciados e navegação no domínio real.

