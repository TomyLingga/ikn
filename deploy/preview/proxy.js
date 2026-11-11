// Preview proxy (Tailscale Funnel -> this proxy -> Next + Laravel), one origin so Sanctum login cookies work:
//   /api/*, /sanctum/*, /storage/*  -> Laravel on 127.0.0.1:PREVIEW_API_PORT (default 8000)
//   everything else                  -> Next.js on 127.0.0.1:PREVIEW_FE_PORT (default 3000)
// Funnel terminates HTTPS, so X-Forwarded-Proto is https. Every response gets X-Robots-Tag: noindex so the
// preview never competes with the real site in search results. Node built-ins only.
const http = require('http');

const PORT = Number(process.env.PREVIEW_PORT || 8080);
const FE = { host: '127.0.0.1', port: Number(process.env.PREVIEW_FE_PORT || 3000) };
const API = { host: '127.0.0.1', port: Number(process.env.PREVIEW_API_PORT || 8000) };
const API_PATH = /^\/(api|sanctum|storage)(\/|$|\?)/;

const server = http.createServer((req, res) => {
  const t = API_PATH.test(req.url) ? API : FE;
  const headers = {
    ...req.headers,
    'x-forwarded-host': req.headers['x-forwarded-host'] || req.headers.host || '',
    'x-forwarded-proto': 'https',
    'x-forwarded-for': [req.headers['x-forwarded-for'], req.socket.remoteAddress].filter(Boolean).join(', '),
  };
  const upstream = http.request({ host: t.host, port: t.port, method: req.method, path: req.url, headers }, (up) => {
    res.writeHead(up.statusCode, { ...up.headers, 'x-robots-tag': 'noindex, nofollow' });
    up.pipe(res);
  });
  upstream.on('error', (err) => {
    if (res.headersSent) return res.destroy();
    res.writeHead(502, { 'content-type': 'text/plain; charset=utf-8', 'x-robots-tag': 'noindex' });
    res.end(`Server ${t.port === API.port ? 'API' : 'web'} sedang dinyalakan ulang (${err.code || err.message}). Coba muat ulang sebentar lagi.`);
  });
  req.pipe(upstream);
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`preview proxy http://127.0.0.1:${PORT} -> FE :${FE.port}, API :${API.port}`);
});
