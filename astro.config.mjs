import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';

/** Runs the form handler under `astro dev`, which does not serve the /api folder. Demo mode unless env is set. */
const devFormEndpoint = {
  name: 'dev-form-endpoint',
  configureServer(server) {
    server.middlewares.use('/api/walkthrough', async (req, res) => {
      const { handleWalkthrough } = await server.ssrLoadModule('/src/lib/walkthrough.ts');
      const chunks = [];
      for await (const chunk of req) chunks.push(chunk);
      const out = await handleWalkthrough(
        new Request(new URL('/api/walkthrough', 'http://localhost'), {
          method: req.method,
          headers: req.headers,
          body: req.method === 'POST' ? Buffer.concat(chunks) : undefined,
        }),
        process.env,
      );
      res.writeHead(out.status, Object.fromEntries(out.headers));
      res.end(Buffer.from(await out.arrayBuffer()));
    });
  },
};

// Static output. The form endpoint is a plain Vercel Function in /api
// (see docs/DEPLOY.md), so no Astro adapter is needed.
export default defineConfig({
  output: 'static',
  site: 'https://example.com',
  build: { inlineStylesheets: 'always' },
  vite: { plugins: [tailwindcss(), devFormEndpoint] },
});
