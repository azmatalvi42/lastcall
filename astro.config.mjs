import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';

// Static output. The form endpoint is a plain Vercel Function in /api
// (see docs/DEPLOY.md), so no Astro adapter is needed.
export default defineConfig({
  output: 'static',
  site: 'https://example.com',
  build: { inlineStylesheets: 'always' },
  vite: { plugins: [tailwindcss()] },
});
