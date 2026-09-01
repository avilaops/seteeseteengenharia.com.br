# Sete & Sete Engenharia: Website

Website oficial da **Sete & Sete Engenharia** (Eng. Letícia Rossini / Silveira Cruz), Projetos arquitetônicos, agropecuários, crédito rural, avaliação de imóveis e perícia técnica em Votuporanga-SP e região.

## 🚀 Repositório e Deploy

- **Repositório GitHub**: [avilaops/seteeseteengenharia](https://github.com/avilaops/seteeseteengenharia)
- **Domínio Oficial**: [seteeseteengenharia.com.br](https://seteeseteengenharia.com.br)
- **Hospedagem / Pages**: GitHub Pages com CI/CD automático via GitHub Actions.

## 🛠️ Tecnologias Utilizadas

- **HTML5 & CSS3 / TailwindCSS**
- **JavaScript (ES Modules)**
- **Google Analytics (GTAG)**
- **Sentry Error Tracking**
- **GitHub Actions (Pages Deploy Pipeline)**

## 📦 Estrutura de Arquivos

```
.
├── .github/
│   └── workflows/
│       └── deploy.yml       # Pipeline de CI/CD para GitHub Pages
├── assets/                  # Bundles de JavaScript e CSS
├── CNAME                    # Configuração de domínio personalizado
├── favicon.svg              # Ícone vetorial do site
├── favicon-96x96.png        # Favicon em alta resolução
├── favicon.ico              # Favicon padrão legado
├── apple-touch-icon.png     # Ícone para dispositivos Apple / iOS
├── index.html               # Documento principal da aplicação
├── robots.txt               # Regras de indexação para motores de busca
├── site.webmanifest         # Manifesto PWA / Web App
├── sitemap.xml              # Sitemap XML para motores de busca (Google, Bing)
└── README.md                # Documentação do projeto
```

## ⚙️ Configuração do GitHub Pages

1. Acesse **Settings > Pages** no repositório GitHub `avilaops/seteeseteengenharia`.
2. Em **Build and deployment > Source**, selecione **GitHub Actions**.
3. O workflow `.github/workflows/deploy.yml` será disparado automaticamente a cada push na branch `main`.

---
© Ávila Ops / Sete & Sete Engenharia. Todos os direitos reservados.
