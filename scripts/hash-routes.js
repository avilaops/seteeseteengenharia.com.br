(() => {
  const routes = new Set(['', 'sobre', 'servicos', 'portfolio', 'blog', 'contato']);
  const current = location.pathname.replace(/^\/|\/$/g, '');
  if (!routes.has(current)) return;
  function target() {
    if (!location.hash.startsWith('#/')) return;
    const [route, section = ''] = location.hash.slice(2).split('#');
    const clean = route.replace(/\/$/, '');
    if (!routes.has(clean)) return;
    return { route: clean, path: clean ? '/' + clean + '/' : '/', section };
  }
  const initial = target();
  if (initial && initial.route !== current) {
    location.replace(initial.path + location.search + (initial.section ? '#' + initial.section : ''));
    return;
  }
  if (!initial) {
    const section = location.hash.slice(1);
    history.replaceState(null, '', location.pathname + location.search + '#/' + current + (section ? '#' + section : ''));
  }
  window.addEventListener('hashchange', () => {
    const next = target();
    if (next && next.route !== current) location.assign(next.path + location.search + (next.section ? '#' + next.section : ''));
  });
})();
