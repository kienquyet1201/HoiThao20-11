import http from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import auth from '../api/auth.js';
import content from '../api/content.js';
import editor from '../api/editor.js';
import setup from '../api/setup.js';

const port = Number(process.env.PORT || 8765);
process.env.SITE_ORIGIN ||= `http://127.0.0.1:${port}`;
const root = path.resolve(fileURLToPath(new URL('../dist/', import.meta.url)));
const mime = { '.html': 'text/html; charset=utf-8', '.js': 'application/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml' };
const routes = { '/api/auth': auth, '/api/content': content, '/api/editor': editor, '/api/setup': setup };

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, process.env.SITE_ORIGIN);
  const handler = url.pathname.startsWith('/api/auth/') ? auth : routes[url.pathname];
  if (handler) return handler(req, res);
  if (!['GET', 'HEAD'].includes(req.method)) { res.writeHead(405); return res.end(); }
  let pathname;
  try { pathname = decodeURIComponent(url.pathname); } catch { res.writeHead(400); return res.end(); }
  if (pathname === '/') pathname = '/index.html';
  if (pathname === '/admin' || pathname === '/admin/') pathname = '/admin.html';
  const file = path.resolve(root, `.${pathname}`);
  if (!file.startsWith(root + path.sep)) { res.writeHead(403); return res.end(); }
  try {
    const body = await readFile(file);
    res.writeHead(200, { 'Content-Type': mime[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
    res.end(req.method === 'HEAD' ? undefined : body);
  } catch { res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }); res.end('Không tìm thấy trang.'); }
});

server.listen(port, '127.0.0.1', () => console.log(`PTIT preview ready: http://127.0.0.1:${port}`));
