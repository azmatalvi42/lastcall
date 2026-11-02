// Vercel Function (Node.js runtime). Vercel deploys files in the root /api
// folder as functions next to the static Astro output in /dist.
import { handleWalkthrough } from '../src/lib/walkthrough';

export const config = { runtime: 'nodejs', maxDuration: 15 };

export async function POST(request: Request): Promise<Response> {
  return handleWalkthrough(request, process.env);
}

export async function GET(request: Request): Promise<Response> {
  return handleWalkthrough(request, process.env);
}
