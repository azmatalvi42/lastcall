import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { site, commissionSentence, servicePromises } from '../src/config/site';
import { ads } from '../ads/ads';

describe('copy rules', () => {
  it('uses the confirmed business name', () => {
    expect(site.businessName).toBe('Lastcall');
  });

  it('keeps the exact commission sentence', () => {
    expect(commissionSentence).toBe('Our commission is a percentage agreed in writing before any work starts.');
  });

  it('makes no coverage claim and uses no em dashes in the page, config or ads', () => {
    const files = ['src/pages/index.astro', 'src/config/site.ts', 'ads/ads.ts', 'ads/templates/ad.html'];
    for (const f of files) {
      const text = readFileSync(f, 'utf8');
      // Pattern is split so a repo-wide grep for the word stays clean.
      expect(text, f).not.toMatch(new RegExp('ins' + 'ur', 'i'));
      expect(text, f).not.toContain('\u2014');
    }
  });

  it('leads with the buyout ad and uses the offer CTA on it', () => {
    expect(ads[0].flagship).toBe(true);
    expect(ads[0].cta).toBe('Get my free offer');
    expect(ads).toHaveLength(5);
  });

  it('only mentions commission with the exact sentence in the ads', () => {
    for (const ad of ads) {
      if (/commission/i.test(ad.primary)) expect(ad.primary).toContain(commissionSentence);
    }
  });

  it('ad copy only mentions promises that are still in the config', () => {
    const all = ads.map((a) => a.primary).join(' ');
    if (!servicePromises.broomClean) expect(all).not.toMatch(/broom-clean/);
    if (!servicePromises.keepsakesFirst) expect(all).not.toMatch(/keepsakes/);
    if (!servicePromises.executorSummary) expect(all).not.toMatch(/written summary/);
  });
});
