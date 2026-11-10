import { describe, it, expect, vi } from 'vitest';
import {
  walkthroughSchema,
  processSubmission,
  handleWalkthrough,
  isDemoMode,
  buildEmail,
  MIN_FILL_MS,
} from '../src/lib/walkthrough';
import { uploadLimits, tooLargeMessage } from '../src/config/site';

const NOW = 1_800_000_000_000;
const liveEnv = { RESEND_API_KEY: 're_test', LEAD_TO_EMAIL: 'owner@example.com', LEAD_FROM_EMAIL: 'site@example.com' };

function form(overrides: Record<string, string> = {}, files: File[] = []) {
  const fd = new FormData();
  const base = { email: 'jane@example.com', name: 'Jane Doe', phone: '(905) 555-0123', location: 'Oakville', timeline: 'asap', website: '', started: String(NOW - 20_000) };
  for (const [k, v] of Object.entries({ ...base, ...overrides })) fd.set(k, v);
  for (const f of files) fd.append('photos', f);
  return fd;
}
const img = (name: string, size: number, type = 'image/jpeg') => new File([new Uint8Array(size)], name, { type });
const deps = (send = vi.fn().mockResolvedValue(undefined)) => ({ now: () => NOW, send, log: () => {} });

describe('schema', () => {
  const lead = (over: Record<string, string> = {}) => ({ email: 'al@example.com', name: '', phone: '', location: '', timeline: '', ...over });

  it('needs nothing but a valid email', () => {
    expect(walkthroughSchema.safeParse(lead()).success).toBe(true);
    for (const email of ['', 'nope', 'a@', '@b.ca']) {
      expect(walkthroughSchema.safeParse(lead({ email })).success).toBe(false);
    }
  });
  it('accepts any location as free text', () => {
    for (const location of ['Ottawa', 'Thunder Bay', '12 King St, Hamilton']) {
      expect(walkthroughSchema.parse(lead({ location })).location).toBe(location);
    }
  });
  it('normalises phone numbers and allows a leading 1', () => {
    expect(walkthroughSchema.parse(lead({ phone: '+1 (416) 555-0100' })).phone).toBe('4165550100');
  });
  it('rejects a short phone and an unknown timeline, when they are given', () => {
    expect(walkthroughSchema.safeParse(lead({ phone: '555-0100' })).success).toBe(false);
    expect(walkthroughSchema.safeParse(lead({ timeline: 'tomorrow' })).success).toBe(false);
  });
  it('keeps line breaks out of names and locations, which go in the subject line', () => {
    const r = walkthroughSchema.parse(lead({ name: 'Al\nBcc: x', location: ' Oak\r\nville ' }));
    expect(r.name).toBe('Al Bcc: x');
    expect(r.location).toBe('Oak ville');
  });
});

describe('first step', () => {
  it('saves a lead from the email alone, with or without the other fields present', async () => {
    const emailOnly = new FormData();
    emailOnly.set('email', 'jane@example.com');
    emailOnly.set('website', '');
    emailOnly.set('started', String(NOW - 20_000));
    const send = vi.fn().mockResolvedValue(undefined);
    const out = await processSubmission(emailOnly, liveEnv, deps(send));
    expect(out).toMatchObject({ status: 'ok', sent: true });
    expect(send.mock.calls[0][0].subject).toBe('New lead: jane@example.com');
    expect(send.mock.calls[0][0].text).toContain('Email: jane@example.com');
    expect(send.mock.calls[0][0].text).not.toContain('Name:');
  });
});

describe('demo mode', () => {
  it('is on when DEMO_MODE=true or anything for Resend is missing', () => {
    expect(isDemoMode({})).toBe(true);
    expect(isDemoMode({ ...liveEnv, DEMO_MODE: 'true' })).toBe(true);
    expect(isDemoMode({ RESEND_API_KEY: 'x' })).toBe(true);
    expect(isDemoMode(liveEnv)).toBe(false);
  });
  it('validates and succeeds but never sends', async () => {
    const send = vi.fn();
    const out = await processSubmission(form(), {}, deps(send));
    expect(out).toEqual({ status: 'ok', demo: true, sent: false });
    expect(send).not.toHaveBeenCalled();
  });
  it('still reports validation errors', async () => {
    const out = await processSubmission(form({ phone: '12' }), {}, deps());
    expect(out.status).toBe('invalid');
  });
});

describe('spam checks', () => {
  it('drops honeypot submissions silently', async () => {
    const send = vi.fn();
    const out = await processSubmission(form({ website: 'http://spam' }), liveEnv, deps(send));
    expect(out).toMatchObject({ status: 'ok', sent: false });
    expect(send).not.toHaveBeenCalled();
  });
  it('drops submissions that are too fast', async () => {
    const send = vi.fn();
    const out = await processSubmission(form({ started: String(NOW - (MIN_FILL_MS - 1)) }), liveEnv, deps(send));
    expect(out).toMatchObject({ status: 'ok', sent: false });
    expect(send).not.toHaveBeenCalled();
  });
  it('allows a no-JavaScript post with no timestamp', async () => {
    const send = vi.fn().mockResolvedValue(undefined);
    const out = await processSubmission(form({ started: '' }), liveEnv, deps(send));
    expect(out).toMatchObject({ status: 'ok', sent: true });
  });
});

describe('photos', () => {
  it('allows up to 5 photos and attaches them', async () => {
    const send = vi.fn().mockResolvedValue(undefined);
    const files = [1, 2, 3, 4, 5].map((i) => img(`p${i}.jpg`, 1000));
    const out = await processSubmission(form({}, files), liveEnv, deps(send));
    expect(out).toMatchObject({ status: 'ok', sent: true });
    expect(send.mock.calls[0][0].attachments).toHaveLength(5);
  });
  it('rejects more than 5 photos', async () => {
    const files = [1, 2, 3, 4, 5, 6].map((i) => img(`p${i}.jpg`, 10));
    expect((await processSubmission(form({}, files), liveEnv, deps())).status).toBe('invalid');
  });
  it('rejects photos over the 4MB total', async () => {
    const files = [img('a.jpg', 3 * 1024 * 1024), img('b.jpg', 2 * 1024 * 1024)];
    expect((await processSubmission(form({}, files), liveEnv, deps())).status).toBe('invalid');
  });
  it('rejects non-image files', async () => {
    const out = await processSubmission(form({}, [img('x.pdf', 10, 'application/pdf')]), liveEnv, deps());
    expect(out.status).toBe('invalid');
  });
});

describe('email', () => {
  it('builds a readable email with a formatted phone', () => {
    const msg = buildEmail({ email: 'jane@example.com', name: 'Jane', phone: '9055550123', location: 'Hamilton', timeline: '1-3-months' }, [], liveEnv);
    expect(msg.to).toBe('owner@example.com');
    expect(msg.subject).toBe('Lead details: Jane, Hamilton');
    expect(msg.text).toContain('jane@example.com');
    expect(msg.text).toContain('(905) 555-0123');
    expect(msg.text).toContain('In 1 to 3 months');
  });
  it('returns an error outcome when Resend fails', async () => {
    const send = vi.fn().mockRejectedValue(new Error('boom'));
    const out = await processSubmission(form(), liveEnv, deps(send));
    expect(out.status).toBe('error');
  });
});

describe('HTTP handler', () => {
  const req = (fd: FormData, accept = 'application/json') =>
    new Request('http://localhost/api/walkthrough', { method: 'POST', body: fd, headers: { accept } });

  it('returns JSON for fetch requests', async () => {
    const res = await handleWalkthrough(req(form()), {}, deps());
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, demo: true });
  });
  it('returns 422 JSON with field errors', async () => {
    const res = await handleWalkthrough(req(form({ email: 'nope' })), {}, deps());
    expect(res.status).toBe(422);
    expect((await res.json()).errors.email).toBeTruthy();
  });
  it('redirects plain HTML posts to the thank-you anchor', async () => {
    const res = await handleWalkthrough(req(form(), 'text/html'), {}, deps());
    expect(res.status).toBe(303);
    expect(res.headers.get('location')).toBe('/#thanks');
  });
  it('redirects invalid plain HTML posts to the error anchor', async () => {
    const res = await handleWalkthrough(req(form({ email: '' }), 'text/html'), {}, deps());
    expect(res.headers.get('location')).toBe('/#form-error');
  });
  it('rejects GET', async () => {
    const res = await handleWalkthrough(new Request('http://localhost/api/walkthrough'), {}, deps());
    expect(res.status).toBe(405);
  });

  describe('4MB request cap', () => {
    const CAP = uploadLimits.maxRequestBytes;
    const bigReq = async (photoBytes: number, accept: string, opts: { stream?: boolean; lie?: number } = {}) => {
      const encoded = new Request('http://x', { method: 'POST', body: form({}, photoBytes ? [img('big.jpg', photoBytes)] : []) });
      const ct = encoded.headers.get('content-type')!;
      const bytes = new Uint8Array(await encoded.arrayBuffer());
      const headers: Record<string, string> = { accept, 'content-type': ct };
      if (!opts.stream) headers['content-length'] = String(opts.lie ?? bytes.byteLength);
      const body = opts.stream
        ? new ReadableStream({ start(c) { for (let i = 0; i < bytes.length; i += 65536) c.enqueue(bytes.slice(i, i + 65536)); c.close(); } })
        : bytes;
      return { req: new Request('http://localhost/api/walkthrough', { method: 'POST', body, headers, duplex: 'half' } as RequestInit), size: bytes.byteLength };
    };

    it('the cap is 4MB and matches the client photo cap', () => {
      expect(CAP).toBe(4 * 1024 * 1024);
      expect(uploadLimits.maxTotalBytes).toBe(CAP);
    });
    it('over-cap no-JS post redirects to the friendly too-large state', async () => {
      const { req, size } = await bigReq(CAP + 10, 'text/html');
      expect(size).toBeGreaterThan(CAP);
      const res = await handleWalkthrough(req, {}, deps());
      expect(res.status).toBe(303);
      expect(res.headers.get('location')).toBe('/#too-large');
    });
    it('over-cap JSON post returns 413 with the friendly message', async () => {
      const { req } = await bigReq(CAP + 10, 'application/json');
      const res = await handleWalkthrough(req, {}, deps());
      expect(res.status).toBe(413);
      expect(await res.json()).toEqual({ ok: false, tooLarge: true, errors: { photos: tooLargeMessage } });
    });
    it('enforces the cap while reading when Content-Length is missing', async () => {
      const { req } = await bigReq(CAP + 10, 'application/json', { stream: true });
      expect(req.headers.get('content-length')).toBeNull();
      const res = await handleWalkthrough(req, {}, deps());
      expect(res.status).toBe(413);
    });
    it('enforces the cap while reading when Content-Length is false', async () => {
      const { req } = await bigReq(CAP + 10, 'application/json', { lie: 1000 });
      const res = await handleWalkthrough(req, {}, deps());
      expect(res.status).toBe(413);
    });
    it('a request just under the cap goes through', async () => {
      const { req, size } = await bigReq(CAP - 8 * 1024, 'application/json');
      expect(size).toBeLessThanOrEqual(CAP);
      expect(size).toBeGreaterThan(CAP - 16 * 1024);
      const res = await handleWalkthrough(req, {}, deps());
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({ ok: true, demo: true });
    });
  });
});
