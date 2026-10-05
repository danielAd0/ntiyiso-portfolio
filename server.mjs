import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { dirname, resolve, extname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), 'dist');
const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.svg': 'image/svg+xml', '.pdf': 'application/pdf' };
export const server = createServer(async (request, response) => {
  response.setHeader('X-Content-Type-Options', 'nosniff');
  response.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.setHeader('Content-Security-Policy', "default-src 'self'; img-src 'self' data:; style-src 'self'; script-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'self'");
  if (!['GET', 'HEAD'].includes(request.method)) {
    response.setHeader('Allow', 'GET, HEAD');
    response.writeHead(405);
    response.end('Method not allowed');
    return;
  }
  try {
    const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
    const file = resolve(root, `.${pathname === '/' ? '/index.html' : pathname}`);
    if (!file.startsWith(root + sep)) { response.writeHead(403); response.end('Forbidden'); return; }
    if (!(await stat(file)).isFile()) { response.writeHead(404); response.end('Not found'); return; }
    const body = await readFile(file);
    response.setHeader('Content-Type', types[extname(file)] || 'application/octet-stream');
    response.setHeader('Content-Length', body.length);
    response.writeHead(200);
    response.end(request.method === 'HEAD' ? undefined : body);
  } catch {
    response.writeHead(404);
    response.end('Not found');
  }
});

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const port = Number(process.env.PORT || 3000);
  server.listen(port, '127.0.0.1', () => console.log(`Ntiyiso's portfolio is available at http://localhost:${port}`));
}
