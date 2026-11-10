import { z } from 'zod';
import { timelines, uploadLimits, site, tooLargeMessage, servicePromises } from '../config/site';

/** Minimum time a real person needs to fill the form (ms). The first step is one autofilled field, so this is short. */
export const MIN_FILL_MS = 1500;
/** Anything older than this is a stale or replayed page (ms). */
export const MAX_FILL_MS = 1000 * 60 * 60 * 24;

const timelineValues = timelines.map((t) => t.value) as [string, ...string[]];

const oneLine = (v: string) => v.replace(/\s+/g, ' ').trim();

/** Only the email is required, so that a lead is saved at the first step. The rest arrives if they choose to add it. */
export const walkthroughSchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, 'Please enter your email.')
    .max(200, 'Please use a shorter email.')
    .email('Please enter a valid email address.'),
  name: z.string().transform(oneLine).pipe(z.string().max(100, 'Please use a shorter name.')),
  phone: z
    .string()
    .trim()
    .transform((v) => v.replace(/\D/g, ''))
    .transform((d) => (d.length === 11 && d.startsWith('1') ? d.slice(1) : d))
    .refine((d) => d === '' || d.length === 10, 'Please enter a 10 digit phone number.'),
  location: z.string().transform(oneLine).pipe(z.string().max(100, 'Please use a shorter location.')),
  timeline: z.enum(['', ...timelineValues], { message: 'Please choose a timeline.' }),
});

export type WalkthroughLead = z.infer<typeof walkthroughSchema>;

export interface Photo {
  filename: string;
  type: string;
  bytes: Uint8Array;
}

export interface Env {
  DEMO_MODE?: string;
  RESEND_API_KEY?: string;
  LEAD_TO_EMAIL?: string;
  LEAD_FROM_EMAIL?: string;
}

export interface Deps {
  now?: () => number;
  send?: (msg: OutgoingEmail, apiKey: string) => Promise<void>;
  log?: (...args: unknown[]) => void;
}

export interface OutgoingEmail {
  from: string;
  to: string;
  subject: string;
  text: string;
  attachments: { filename: string; content: Buffer }[];
}

export function isDemoMode(env: Env): boolean {
  if (env.DEMO_MODE === 'true') return true;
  return !env.RESEND_API_KEY || !env.LEAD_TO_EMAIL || !env.LEAD_FROM_EMAIL;
}

export function formatPhone(d: string): string {
  return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
}

export type PhotoCheck = { ok: true; photos: Photo[] } | { ok: false; error: string };

export async function readPhotos(entries: FormDataEntryValue[]): Promise<PhotoCheck> {
  const files = entries.filter(
    (e): e is File => typeof e !== 'string' && e.size > 0,
  );
  if (files.length > uploadLimits.maxFiles) {
    return { ok: false, error: `Please send ${uploadLimits.maxFiles} photos or fewer.` };
  }
  const total = files.reduce((n, f) => n + f.size, 0);
  if (total > uploadLimits.maxTotalBytes) {
    return { ok: false, error: tooLargeMessage };
  }
  const photos: Photo[] = [];
  for (const [i, f] of files.entries()) {
    if (!uploadLimits.acceptedTypes.includes(f.type)) {
      return { ok: false, error: 'Photos must be JPG, PNG, WEBP or HEIC images.' };
    }
    const safe = (f.name || `photo-${i + 1}`).replace(/[^\w.\-]+/g, '_').slice(0, 80);
    photos.push({ filename: safe, type: f.type, bytes: new Uint8Array(await f.arrayBuffer()) });
  }
  return { ok: true, photos };
}

export function buildEmail(lead: WalkthroughLead, photos: Photo[], env: Env): OutgoingEmail {
  const timeline = timelines.find((t) => t.value === lead.timeline)?.label;
  const hasDetails = Boolean(lead.name || lead.phone || lead.location || lead.timeline || photos.length);
  const followUp = lead.phone ? 'call them back' : 'email them back';
  const text = [
    hasDetails
      ? `More details from a lead on the ${site.businessName} website.`
      : `New lead from the ${site.businessName} website. They may send more details shortly.`,
    '',
    `Email: ${lead.email}`,
    lead.name ? `Name: ${lead.name}` : false,
    lead.phone ? `Phone: ${formatPhone(lead.phone)}` : false,
    lead.location ? `Location: ${lead.location}` : false,
    timeline ? `Timeline: ${timeline}` : false,
    photos.length > 0 ? `Photos attached: ${photos.length}` : false,
    '',
    servicePromises.replyOneBusinessDay
      ? `Please ${followUp} within one business day (the site promises this).`
      : `Please ${followUp} as soon as you can.`,
  ]
    .filter((line) => line !== false)
    .join('\n')
    .replace(/\n{3,}/g, '\n\n');
  const who = [lead.name || lead.email, lead.location].filter(Boolean).join(', ');
  return {
    from: env.LEAD_FROM_EMAIL!,
    to: env.LEAD_TO_EMAIL!,
    subject: hasDetails ? `Lead details: ${who}` : `New lead: ${lead.email}`,
    text,
    attachments: photos.map((p) => ({ filename: p.filename, content: Buffer.from(p.bytes) })),
  };
}

async function resendSend(msg: OutgoingEmail, apiKey: string) {
  const { Resend } = await import('resend');
  const resend = new Resend(apiKey);
  const { error } = await resend.emails.send(msg);
  if (error) throw new Error(`Resend error: ${error.message}`);
}

type Outcome =
  | { status: 'ok'; demo: boolean; sent: boolean }
  | { status: 'invalid'; errors: Record<string, string> }
  | { status: 'error'; message: string };

export async function processSubmission(form: FormData, env: Env, deps: Deps = {}): Promise<Outcome> {
  const now = deps.now ?? Date.now;
  const log = deps.log ?? console.log;

  // Spam checks. Bots get a normal-looking success so they learn nothing.
  const honeypot = String(form.get('website') ?? '');
  if (honeypot.trim() !== '') {
    log('[walkthrough] honeypot filled, dropped');
    return { status: 'ok', demo: isDemoMode(env), sent: false };
  }
  const started = Number(form.get('started') ?? '');
  if (Number.isFinite(started) && started > 0) {
    const elapsed = now() - started;
    if (elapsed < MIN_FILL_MS || elapsed > MAX_FILL_MS) {
      log(`[walkthrough] time check failed (${elapsed}ms), dropped`);
      return { status: 'ok', demo: isDemoMode(env), sent: false };
    }
  }

  const parsed = walkthroughSchema.safeParse({
    email: form.get('email') ?? '',
    name: form.get('name') ?? '',
    phone: form.get('phone') ?? '',
    location: form.get('location') ?? '',
    timeline: form.get('timeline') ?? '',
  });
  if (!parsed.success) {
    const errors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = String(issue.path[0] ?? 'form');
      errors[key] ??= issue.message;
    }
    return { status: 'invalid', errors };
  }

  const photoCheck = await readPhotos(form.getAll('photos'));
  if (!photoCheck.ok) return { status: 'invalid', errors: { photos: photoCheck.error } };

  if (isDemoMode(env)) {
    log('[walkthrough] DEMO MODE: valid request, nothing sent', {
      hasPhone: Boolean(parsed.data.phone),
      timeline: parsed.data.timeline,
      photos: photoCheck.photos.length,
    });
    return { status: 'ok', demo: true, sent: false };
  }

  try {
    await (deps.send ?? resendSend)(buildEmail(parsed.data, photoCheck.photos, env), env.RESEND_API_KEY!);
    return { status: 'ok', demo: false, sent: true };
  } catch (err) {
    log('[walkthrough] send failed', err);
    return { status: 'error', message: 'Sorry, something went wrong on our side. Please call us instead.' };
  }
}

function wantsJson(req: Request) {
  return (req.headers.get('accept') ?? '').includes('application/json');
}

/** Web-standard handler used by the Vercel Function and the local preview server. */
export async function handleWalkthrough(req: Request, env: Env, deps: Deps = {}): Promise<Response> {
  const json = wantsJson(req);
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405, headers: { allow: 'POST' } });
  }
  const cap = uploadLimits.maxRequestBytes;
  const tooLarge = () => respond(json, 413, { ok: false, tooLarge: true, errors: { photos: tooLargeMessage } }, '/#too-large');

  // 1. Cheap check up front: refuse a declared body over the cap without reading it.
  const declared = Number(req.headers.get('content-length') ?? '');
  if (Number.isFinite(declared) && declared > cap) return tooLarge();

  // 2. Enforce the cap while reading too, so a missing or false Content-Length cannot get past it.
  const body = await readBodyCapped(req, cap);
  if (body === 'too-large') return tooLarge();

  let form: FormData;
  try {
    form = await new Response(body, { headers: { 'content-type': req.headers.get('content-type') ?? '' } }).formData();
  } catch {
    return respond(json, 400, { ok: false, errors: { form: 'We could not read the form. Please try again.' } }, '/#form-error');
  }

  const out = await processSubmission(form, env, deps);
  if (out.status === 'ok') return respond(json, 200, { ok: true, demo: out.demo }, '/#thanks');
  if (out.status === 'invalid') return respond(json, 422, { ok: false, errors: out.errors }, '/#form-error');
  return respond(json, 502, { ok: false, errors: { form: out.message } }, '/#form-error');
}

/** Reads the request body into memory, stopping as soon as it passes `cap` bytes. Nothing is stored. */
export async function readBodyCapped(req: Request, cap: number): Promise<Uint8Array<ArrayBuffer> | 'too-large'> {
  if (!req.body) return new Uint8Array(new ArrayBuffer(0));
  const reader = req.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > cap) {
      await reader.cancel().catch(() => {});
      return 'too-large';
    }
    chunks.push(value);
  }
  const out = new Uint8Array(new ArrayBuffer(total));
  let off = 0;
  for (const c of chunks) {
    out.set(c, off);
    off += c.byteLength;
  }
  return out;
}

function respond(json: boolean, status: number, body: unknown, redirectTo: string): Response {
  if (json) {
    return new Response(JSON.stringify(body), {
      status,
      headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
    });
  }
  // Plain HTML form post (no JavaScript): send the visitor back to the page.
  return new Response(null, { status: 303, headers: { location: redirectTo, 'cache-control': 'no-store' } });
}
