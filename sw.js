/*
 * Service worker do Controle de Jalecos.
 * - A "casca" do app (tela, ícones) fica guardada no celular: abre na hora.
 * - Tela e config.js: tenta a internet primeiro, para as atualizações chegarem sozinhas;
 *   sem internet, usa a cópia guardada.
 * - Os dados (chamadas ao Apps Script) NUNCA passam por cache: sempre vêm da planilha.
 *
 * Ao publicar uma versão nova do app, aumente o número abaixo.
 */
const VERSAO = 'jalecos-v3.1';
const CASCA = [
  './', './index.html', './config.js', './manifest.webmanifest',
  './qrcode.js', './icon-192.png', './icon-512.png', './icon-maskable-512.png', './apple-touch-icon.png'
];

self.addEventListener('install', (e) => {
  // Guarda arquivo por arquivo: se um faltar no servidor, os outros continuam valendo.
  e.waitUntil(caches.open(VERSAO)
    .then((c) => Promise.all(CASCA.map((u) => c.add(u).catch(() => null))))
    .then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((nomes) => Promise.all(nomes.filter((n) => n !== VERSAO).map((n) => caches.delete(n))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;                       // chamadas à API são POST: seguem direto
  const url = new URL(req.url);

  // Fontes do Google: guarda depois da primeira vez
  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    e.respondWith(
      caches.open(VERSAO).then((c) => c.match(req).then((achou) => achou ||
        fetch(req).then((r) => { c.put(req, r.clone()); return r; })))
    );
    return;
  }
  if (url.origin !== self.location.origin) return;

  const ehTela = req.mode === 'navigate' || url.pathname.endsWith('.html') || url.pathname.endsWith('config.js');
  if (ehTela) {
    // rede primeiro
    e.respondWith(
      fetch(req).then((r) => {
        const copia = r.clone();
        caches.open(VERSAO).then((c) => c.put(req.mode === 'navigate' ? './index.html' : req, copia));
        return r;
      }).catch(() => caches.match(req).then((r) => r || caches.match('./index.html')))
    );
    return;
  }
  // cache primeiro (ícones, manifest)
  e.respondWith(caches.match(req).then((r) => r || fetch(req)));
});
