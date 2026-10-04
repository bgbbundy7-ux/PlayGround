import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT || 3000);

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.webmanifest': 'application/manifest+json',
};

const server = http.createServer((req, res) => {
  const urlPath = decodeURIComponent(req.url.split('?')[0]);
  let rel = urlPath === '/' ? '/index.html' : urlPath;
  // Block path traversal and hidden files/dirs (.git, .opencode, ...)
  const safe = path.normalize(rel).replace(/^(\.\.[\/\\])+/, '');
  if (safe.split('/').some((seg) => seg.startsWith('.'))) {
    res.writeHead(404, { 'content-type': 'text/plain' });
    res.end('not found');
    return;
  }
  let file = path.join(__dirname, safe);
  fs.stat(file, (err, st) => {
    if (err || !st.isFile()) {
      // SPA fallback for unknown -> index
      if (!path.extname(safe)) {
        file = path.join(__dirname, 'index.html');
      } else {
        res.writeHead(404, { 'content-type': 'text/plain' });
        res.end('not found');
        return;
      }
    }
    const ext = path.extname(file).toLowerCase();
    fs.readFile(file, (e, data) => {
      if (e) {
        res.writeHead(404).end('not found');
        return;
      }
      res.writeHead(200, {
        'content-type': MIME[ext] || 'application/octet-stream',
        'cache-control': ext === '.html' ? 'no-cache' : 'public, max-age=3600',
      });
      res.end(data);
    });
  });
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`REACH PROTOCOL serving on http://127.0.0.1:${PORT}`);
});
