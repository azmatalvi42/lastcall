// Local preview: serves the built site from /dist and runs the same
// handler the Vercel Function uses at POST /api/walkthrough.
// Usage: npm run build && npm run serve   (PORT defaults to 4321)
import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { Readable } from 'node:stream';
import { handleWalkthrough } from '../src/lib/walkthrough';

const root = join(process.cwd(), 'dist');
const port = Number(process.env.PORT ?? 4321);
const types: Record<string, string> = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.svg': 'image/svg+xml',
  '.webp': 'image/webp', '.avif': 'image/avif', '.jpg': 'image/jpeg', '.png': 'image/png', '.woff2': 'font/woff2', '.woff': 'font/woff',
};

http
  .createServer(async (req, res) => {
    const url = new URL(req.url ?? '/', `http://${req.headers.host}`);
    if (url.pathname === '/api/walkthrough') {
      const request = new Request(url, {
        method: req.method,
        headers: req.headers as Record<string, string>,
        body: req.method === 'POST' ? (Readable.toWeb(req) as ReadableStream) : undefined,
        // @ts-expect-error node fetch needs this for streamed bodies
        duplex: 'half',
      });
      const out = await handleWalkthrough(request, process.env);
      res.writeHead(out.status, Object.fromEntries(out.headers));
      res.end(Buffer.from(await out.arrayBuffer()));
      req.resume(); // drain any unread upload so the browser sees the response
      return;
    }
    let path = normalize(join(root, decodeURIComponent(url.pathname)));
    if (!path.startsWith(root)) return res.writeHead(403).end();
    try {
      if ((await stat(path)).isDirectory()) path = join(path, 'index.html');
      const body = await readFile(path);
      const cache = path.includes('/_astro/') ? 'public, max-age=31536000, immutable' : 'no-cache';
      res.writeHead(200, { 'content-type': types[extname(path)] ?? 'application/octet-stream', 'cache-control': cache });
      res.end(body);
    } catch {
      res.writeHead(404, { 'content-type': 'text/plain' }).end('Not found');
    }
  })
  .listen(port, () => console.log(`Preview on http://localhost:${port} (demo mode: ${!process.env.RESEND_API_KEY || process.env.DEMO_MODE === 'true'})`));
