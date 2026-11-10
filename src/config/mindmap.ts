import { commissionSentence, servicePromises as P } from './site';

export type MapItem = { label: string; detail: string };
export type SaleStyleMap = {
  id: string;
  label: string;
  summary: string;
  cta: string;
  seller: MapItem[];
  lastcall: MapItem[];
  goal: MapItem;
};

const walkthrough: MapItem = {
  label: 'A walkthrough',
  detail: 'Show us the home once. It is free, and a family member or your realtor can do it if you live out of town.',
};
const keepsakes: MapItem = {
  label: 'What you keep',
  detail: `Take whatever you want before we start.${P.keepsakesFirst ? ' If we come across photos, letters or personal papers, we set them aside for you.' : ''}`,
};
const signOff: MapItem = {
  label: 'Your sign-off',
  detail: 'Every job starts with a signed agreement that sets out the dates, the terms and the plan for leftovers.',
};
const leftovers = `${P.donateUsable ? 'We donate usable items to local charities, recycle what we can' : 'We recycle what we can'} and dispose of the rest properly.`;
const listingsAndAds: MapItem = {
  label: 'Listings and ads',
  detail: 'Our AI agents list, describe and optimize your items, then find the buyers and make the ads.',
};

/** The same five styles, in the same order, as the services section. */
export const saleStyles: SaleStyleMap[] = [
  {
    id: 'estate-auction',
    label: 'Estate auction',
    summary: 'Rare finds, real value. Photographed lots, bidding online, and pickup arranged for you.',
    cta: 'Ask about an estate auction',
    seller: [walkthrough, keepsakes, signOff],
    lastcall: [
      { label: 'Photographed lots', detail: 'We photograph your pieces and set them up as lots for the auction.' },
      { label: 'Online bidding', detail: 'Your lots are sold by bid online.' },
      { label: 'Finding buyers', detail: 'Agents look for the people most likely to want each piece, from collectors and dealers to shoppers nearby, and let them know.' },
      { label: 'Pickup arranged', detail: 'We arrange pickup, so you are not left coordinating with buyers.' },
    ],
    goal: { label: 'Pieces sold by bid', detail: 'Your pieces go to the buyers who want them most, on the terms in your signed agreement.' },
  },
  {
    id: 'online-sale',
    label: 'Online sale',
    summary: 'Listed online, found by buyers. We photograph, describe and list your things at set prices, then find the buyers.',
    cta: 'Ask about an online sale',
    seller: [walkthrough, keepsakes, signOff],
    lastcall: [
      { label: 'Photos and descriptions', detail: 'We photograph and describe your things so that buyers can see what they are getting.' },
      { label: 'Set prices', detail: 'We price each item and list it at that price.' },
      listingsAndAds,
      { label: 'The plan for leftovers', detail: `The plan is written into your agreement. ${leftovers}` },
    ],
    goal: { label: 'Sold to buyers online', detail: 'Your things are sold online, without buyers browsing through your home, on the terms in your signed agreement.' },
  },
  {
    id: 'estate-sale',
    label: 'Estate sale',
    summary: 'See it in the home. We price, stage and run a sale in the house over a few days.',
    cta: 'Ask about an estate sale',
    seller: [
      walkthrough,
      keepsakes,
      { label: 'The home for 2 to 3 days', detail: 'The sale runs for 2 to 3 days at the home, with setup beforehand and clean-out after. You do not need to be there.' },
    ],
    lastcall: [
      { label: 'Research and pricing', detail: 'We research and price every item.' },
      { label: 'Staging the rooms', detail: 'We stage the rooms so that buyers can see everything at its best.' },
      { label: 'Advertising and running it', detail: 'We advertise the sale and run it at the home.' },
      { label: 'The clear-out', detail: `When the sale ends, we clear what is left. ${leftovers}` },
    ],
    goal: { label: 'Proceeds in hand', detail: `You keep the proceeds, less our commission. ${commissionSentence}` },
  },
  {
    id: 'garage-sale',
    label: 'Garage sale',
    summary: 'A Saturday, on the driveway. A neighbourhood sale we set up, run for the day and tidy after.',
    cta: 'Ask about a garage sale',
    seller: [
      walkthrough,
      keepsakes,
      { label: 'A driveway for the day', detail: 'Your garage or driveway, for one neighbourhood sale.' },
    ],
    lastcall: [
      { label: 'Setting it up', detail: 'We set up the sale on your driveway.' },
      listingsAndAds,
      { label: 'Running the day', detail: 'We run the sale for the day.' },
      { label: 'Tidying after', detail: 'When it is over, we tidy up.' },
    ],
    goal: { label: 'Driveway clear by day’s end', detail: 'A simple neighbourhood sale, run for you and tidied after.' },
  },
  {
    id: 'buyout',
    label: 'Buyout offer',
    summary: 'One offer, the house cleared. One written offer for everything, and once you accept, we empty the house.',
    cta: 'Get a buyout offer',
    seller: [
      walkthrough,
      keepsakes,
      { label: 'Your yes', detail: 'You get one written offer, with no obligation. If you accept, we agree a date.' },
    ],
    lastcall: [
      { label: 'One written offer', detail: 'One offer for the contents of the home, with no hidden fees.' },
      { label: 'Packing everything', detail: 'We pack everything up on the date we agree.' },
      { label: 'Emptying the house', detail: `We empty the house quickly${P.broomClean ? ' and leave it broom-clean' : ''}. A buyout is usually the quickest option.` },
      { label: 'The plan for leftovers', detail: `The plan is written into your agreement. ${leftovers}` },
    ],
    goal: { label: 'Paid, and the house empty', detail: 'We pay you one agreed amount for the contents, set out in writing, and the house is cleared.' },
  },
];

export const sellerHub: MapItem = {
  label: 'What you bring',
  detail: 'The home, and the decisions only you can make. You stay in charge of what goes and when.',
};
export const lastcallHub: MapItem = {
  label: 'What Lastcall brings',
  detail: 'The work in between, from the first look around to the last box.',
};
