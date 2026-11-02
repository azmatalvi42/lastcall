# Lastcall: one-page site

A calm, one-page site for Lastcall, a full house buyout and estate sale business serving Toronto, Peel, York, Durham and Halton.
The lead offer is the full house buyout. One goal: get a "Get my free offer" request, by form or by phone. Running the estate sale for a commission is the second option.

## What is in here

- `src/config/site.ts`: the ONE file with the business name, every placeholder (phone, email, hours, site URL), the region and timeline options, the exact commission sentence (`commissionSentence`) and the `servicePromises` block. The promises (keepsakes first, donations, broom-clean, executor summary, reply within one business day) are UNCONFIRMED: delete an entry and it disappears from the site, the lead email and the ad copy. Each placeholder has an `...IsPlaceholder` flag. While any flag is true, a slim "Preview" notice shows at the top of the page and a testimonial placeholder box is shown.
- `src/pages/index.astro`: the page. Sections in order: hero (buyout first), two options (buyout card first, then "We run the sale for you"), how it works, leftovers, why trust us, FAQ (native `<details>`), service area, form, footer. Sticky click-to-call bar on mobile; phone always in the header on desktop.
- `src/lib/walkthrough.ts`: form validation (zod), spam checks, photo checks, email building and the request handler. Pure and tested.
- `api/walkthrough.ts`: the single Vercel Function (`POST /api/walkthrough`).
- `src/scripts/form.ts`: the only client JS. Resizes photos to 1600px max in the browser, enforces 5 photos and a 4MB total (the server also caps the whole request at 4MB; see `docs/DEPLOY.md`), submits with fetch and shows inline errors. Without JS, the form still posts normally and the server redirects to `/#thanks`, `/#form-error` or `/#too-large`, which CSS shows with `:target`.
- `tests/walkthrough.test.ts`: vitest tests.
- `ads/`: 10 ad PNGs. The copy lives in `ads/ads.ts` (reads `src/config/site.ts`), the one HTML template is `ads/templates/ad.html`, and `ads/COPY.md` is generated. Ad 1 (buyout) is the flagship.
- `share/`: small JPG copies of the screenshots and ads for sending in chat.
- `screenshots/`, `lighthouse/`: review artifacts.

## Commands (Node 22.12 or newer)

```sh
npm install
npm run dev       # Astro dev server (no API)
npm run build     # static build to dist/
npm run serve     # serves dist/ AND the /api/walkthrough handler on :4321 (demo mode unless env is set)
npm test          # vitest
npm run shots     # full-page screenshots into screenshots/ (needs `npm run serve` running)
npm run ads       # re-render the 10 ad PNGs and rewrite ads/COPY.md from ads/ads.ts and src/config/site.ts
```

## Environment variables

See `.env.example`.

| Name | Purpose |
| --- | --- |
| `DEMO_MODE` | `true` = validate but send nothing. Also on automatically if any Resend variable below is missing. |
| `RESEND_API_KEY` | Resend API key. Set in Vercel project settings only. Never commit it. |
| `LEAD_TO_EMAIL` | Inbox that receives walkthrough requests. |
| `LEAD_FROM_EMAIL` | Verified Resend sender, for example `Walkthroughs <walkthrough@yourdomain.ca>`. |

No database and no analytics. Each request becomes one email with the photos attached.

## Spam protection

- Honeypot field (`website`) and a time-to-submit check (under 3 seconds or over 24 hours is treated as a bot). Bots get a fake success so they do not retry.
- The time check needs JS (it sets a hidden `started` field). Plain no-JS posts skip it and rely on the honeypot and the rate limit.
- Per-IP rate limit is a Vercel Firewall rule. See `docs/DEPLOY.md`. It is documented, not created.

## Copy rules

Plain language, warm and calm, no em dashes, no invented reviews or numbers. Check before shipping:

```sh
grep -rnP '\x{2014}' src ads README.md docs
```
