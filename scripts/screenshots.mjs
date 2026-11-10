// Full-page screenshots of the local preview (run `npm run serve` first).
import { chromium } from 'playwright';
const base = process.env.BASE_URL ?? 'http://localhost:4321';
const out = 'screenshots';
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH ?? '/usr/bin/google-chrome' });
const sizes = [['mobile', 390, 844, 3], ['tablet', 820, 1180, 2], ['desktop', 1440, 900, 1]];
for (const [name, width, height, dpr] of sizes) {
  const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: dpr === 3 ? 2 : dpr });
  await page.goto(base, { waitUntil: 'networkidle' });
  // force lazy images to load before the full-page capture
  await page.evaluate(async () => {
    for (let y = 0; y < document.body.scrollHeight; y += 400) { window.scrollTo(0, y); await new Promise((r) => setTimeout(r, 60)); }
    await Promise.all([...document.images].map((i) => i.decode().catch(() => {})));
    window.scrollTo(0, 0);
  });
  await page.waitForTimeout(400);
  // Full-page capture: pin the fixed mobile call bar to the end of the page
  // so it does not float mid-page in the stitched image.
  const tag = await page.addStyleTag({ content: 'body{position:relative}[data-callbar]{position:absolute!important}header.sticky{position:relative!important}' });
  await page.screenshot({ path: `${out}/${name}-${width}.png`, fullPage: true });
  await tag.evaluate((n) => n.remove());
  await page.screenshot({ path: `${out}/${name}-${width}-fold.png` });
  await page.close();
}
// Validation errors, then the thank-you state in demo mode.
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
await page.goto(base + '/#walkthrough', { waitUntil: 'networkidle' });
await page.fill('#f-name', 'Sample Person');
await page.fill('#f-phone', '555');
await page.waitForTimeout(1800); // passes the time-to-submit check
await page.click('form[data-walkthrough] button[type=submit]');
await page.waitForSelector('#e-email:not([hidden])');
await page.screenshot({ path: `${out}/form-errors-mobile.png` });
await page.fill('#f-email', 'sample@example.com');
await page.fill('#f-phone', '(905) 555-0199');
await page.click('form[data-walkthrough] button[type=submit]');
await page.waitForSelector('#thanks[data-show]');
await page.waitForTimeout(300);
await page.screenshot({ path: `${out}/thank-you-demo-mobile.png` });
await browser.close();
console.log('done');
