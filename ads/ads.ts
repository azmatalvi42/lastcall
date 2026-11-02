// The five ads: on-image text, Meta headline and primary text.
// Business name, phone, the commission sentence and every service promise come
// from src/config/site.ts. Cut a promise there and it drops out of the ads too.
// `npm run ads` renders the images AND rewrites ads/COPY.md from this file.
import { site, servicePromises as P, commissionSentence } from '../src/config/site';

export type Ad = {
  slug: string;
  audience: string;
  flagship?: boolean;
  image: string;
  pos: string;
  badge: string;
  eyebrow: string;
  onImage: string;
  cta: string;
  headline: string;
  primary: string;
};

const join = (...parts: (string | false | undefined)[]) => parts.filter(Boolean).join(' ');
const offer = 'Get my free offer';

export const ads: Ad[] = [
  {
    slug: 'ad1-buyout',
    audience: 'Full house buyout (flagship)',
    flagship: true,
    image: 'brick-bungalow.jpg',
    pos: 'center 55%',
    badge: 'Across the GTA',
    eyebrow: 'Full house buyouts',
    onImage: 'One written offer for everything in the house.',
    cta: offer,
    headline: 'One written offer for the whole house',
    primary: join(
      'Clearing out a home? We walk through it with you, then give you one written offer for the contents.',
      'Once you accept, we pack everything up and empty the house quickly.',
      'No sale days, and no strangers in the home.',
      P.broomClean && 'We leave it broom-clean.',
      'The walkthrough and the offer are free, with no obligation. Across the GTA.',
    ),
  },
  {
    slug: 'ad2-downsizing',
    audience: 'Downsizing seniors',
    image: 'living-room.jpg',
    pos: 'center 60%',
    badge: 'Across the GTA',
    eyebrow: 'Downsizing',
    onImage: 'Moving somewhere smaller? We take care of the rest.',
    cta: offer,
    headline: 'Downsizing? One offer for what you are not taking.',
    primary: join(
      'Moving to a smaller home is a big step.',
      'Keep what you love, and we will give you one written offer for the rest of the contents.',
      'Once you accept, we clear the house quickly.',
      P.donateUsable && 'Usable items we do not keep are donated.',
      'Free, no-pressure walkthrough across the GTA.',
    ),
  },
  {
    slug: 'ad3-family',
    audience: 'Adult children after a parent passes (gentle)',
    image: 'china-cabinet.jpg',
    pos: 'center 45%',
    badge: 'Across the GTA',
    eyebrow: 'For families',
    onImage: 'Settling a parent\u2019s home? We take it gently.',
    cta: offer,
    headline: 'Settling a parent\u2019s home? We can help.',
    primary: join(
      'Clearing out a parent\u2019s home is hard, and you do not have to do it alone.',
      P.keepsakesFirst && 'We set aside photos, letters and keepsakes for the family first.',
      'Then we give you one written offer for the contents, or run an estate sale if that suits the home better.',
      'Take all the time you need. The walkthrough is free, across the GTA.',
    ),
  },
  {
    slug: 'ad4-we-run-the-sale',
    audience: 'We run the sale for you',
    image: 'sale-table.jpg',
    pos: 'center 50%',
    badge: 'Across the GTA',
    eyebrow: 'Full estate sales',
    onImage: 'We run the sale. You don\u2019t lift a finger.',
    cta: 'Book a free walkthrough',
    headline: 'We run the estate sale. You don\u2019t lift a finger.',
    primary: join(
      'We research and price every item, stage the rooms, advertise the sale and run it for 2 to 3 days at the home.',
      'You keep the proceeds, less our commission.',
      commissionSentence,
      'When the sale ends, we clear what is left. Across the GTA.',
    ),
  },
  {
    slug: 'ad5-partners',
    audience: 'Realtors and executors',
    image: 'hallway-boxes.jpg',
    pos: 'center 50%',
    badge: 'Across the GTA',
    eyebrow: 'For realtors and executors',
    onImage: 'Houses cleared before listing or closing.',
    cta: offer,
    headline: 'Houses cleared before listing or closing',
    primary: join(
      'For realtors and executors across the GTA.',
      'We work to your listing or closing date with one written offer for the contents, or a full estate sale if it suits the home better.',
      P.broomClean && 'We leave the house broom-clean.',
      P.executorSummary && 'Executors get a written summary for the estate file.',
      'Call or ask for a free offer.',
    ),
  },
];

export const brand = { name: site.businessName, phone: site.phoneDisplay };
