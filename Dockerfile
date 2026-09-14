FROM nginx:1.31-alpine
COPY ["logo.png", "avilaops-indexnow-20260730.txt", "site.webmanifest", "logo.svg", "sitemap.xml", "favicon-96x96.png", "logo_full.jpg", "index.html", "logo_icon.png", "og-default.png", "favicon.svg", "favicon.ico", "apple-touch-icon.png", "robots.txt", "/usr/share/nginx/html/"]
COPY assets /usr/share/nginx/html/assets
COPY img /usr/share/nginx/html/img
