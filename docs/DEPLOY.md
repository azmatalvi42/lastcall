# Deploy notes (not done yet: needs Azmat's go-ahead)

Nothing has been pushed or deployed. When approved:

1. Create the GitHub repo and open a PR from `feat/initial-site`. Do not push to `main` directly.
2. Import the repo in Vercel. `vercel.json` sets the framework (Astro), the output folder (`dist`) and the function config for `api/walkthrough.ts`.
3. Add the environment variables in Vercel (Production and Preview): `RESEND_API_KEY`, `LEAD_TO_EMAIL`, `LEAD_FROM_EMAIL`. Leave `DEMO_MODE` unset (or `false`) in production. Previews can keep `DEMO_MODE=true`.
4. In Resend, verify the sending domain (SPF and DKIM DNS records) before going live.
5. Replace every placeholder in `src/config/site.ts` (phone, email, hours, site URL) and set its `...IsPlaceholder` flag to `false`. Confirm or cut each entry in the `servicePromises` block. Then re-run `npm run ads`.

## Spam protection (accepted)

- With JavaScript: honeypot field plus a time-to-submit check, plus the rate limit below.
- Without JavaScript: honeypot plus the rate limit only. The time check needs JS to stamp the start time, so plain posts skip it. This trade-off is accepted.

## Rate limit (Vercel Firewall custom rule)

Not created yet. Create it at deploy time only, and only after Azmat's go-ahead. Dashboard: Project > Firewall > Configure > New Rule.

- Name: `walkthrough-rate-limit`
- If: Request Path equals `/api/walkthrough` AND Method equals `POST`
- Then: Rate Limit, fixed window, 5 requests per 600 seconds, keyed by IP
- Action when exceeded: Deny (429)

Reference JSON for the rule:

```json
{
  "name": "walkthrough-rate-limit",
  "conditionGroup": [{ "conditions": [
    { "type": "path", "op": "eq", "value": "/api/walkthrough" },
    { "type": "method", "op": "eq", "value": "POST" }
  ]}],
  "action": { "mitigate": { "action": "rate_limit",
    "rateLimit": { "algo": "fixed_window", "window": 600, "limit": 5, "keys": ["ip"], "action": "deny" } } }
}
```

## 4MB request cap

The whole request body (fields plus photos) is capped at 4MB (`uploadLimits.maxRequestBytes` in `src/config/site.ts`).

Why: Vercel Functions reject request bodies over 4.5MB with a bare platform error before our code runs. Capping at 4MB, with headroom under 4.5MB, means our own friendly message is what people see.

How it is enforced:

- In the browser: photos are still resized to 1600px and re-encoded as JPEG. Before sending, the script checks the photo total (plus room for the text fields) against 4MB and shows the message inline. The client photo cap is 4MB to match. If the server or platform ever answers 413, the same message is shown inline.
- On the server (`src/lib/walkthrough.ts`): the `Content-Length` header is checked up front, and the body is also counted while it is read, stopping as soon as it passes 4MB. This covers a missing or false `Content-Length`.
- Over the cap, a fetch (JSON) request gets `413` with `{ ok: false, tooLarge: true, errors: { photos: "Please send fewer or smaller photos, or email them to us later." } }`. A plain no-JS post is redirected (303) to `/#too-large`, a styled state on the page with the same message and a "Back to the form" link.

Note: a no-JS post over 4.5MB never reaches the function, so on Vercel that visitor sees the platform's own error instead of our page. Between 4MB and 4.5MB they see our page.

## No storage

Nothing is stored. No database, no file storage (no Vercel Blob or similar), no logs of personal details. The body is held in memory only for the request, then photos go out as email attachments through Resend and are discarded. Demo mode logs only the region, timeline and photo count.

## Security headers

Set in `vercel.json`: `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`, `X-Frame-Options`. Long cache on `/_astro/*` hashed assets.
