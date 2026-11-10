/**
 * The footer's full-width logo as a little auction. Ringing the bell is the only way to bid: each ring raises
 * a letter like a paddle and puts the price up. Stop ringing and it goes "going once, going twice, sold".
 * It is all for fun: nothing is sold.
 */
const OPENING_BID = 5;
const INCREMENTS = [5, 5, 10, 10, 25];
const MAX_BUBBLES = 10;
const GOING_AFTER_MS = 1400;
const GOING_STEP_MS = 900;
const SOLD_MS = 2600;
const PADDLE_MS = 750;

export function mountBidFooter(root: HTMLElement) {
  const logo = root.querySelector<HTMLElement>('[data-bid-logo]');
  const inner = logo?.querySelector<HTMLElement>('.bid-logo-inner');
  const bell = root.querySelector<HTMLButtonElement>('[data-bid-bell]');
  const status = root.querySelector<HTMLElement>('[data-bid-status]');
  const layer = root.querySelector<HTMLElement>('[data-bid-layer]');
  const legal = root.querySelector<HTMLElement>('.bid-legal');
  if (!logo || !inner || !bell || !status || !layer || !legal) return;

  /** Sizes the logo to fill the space: measured at 100px, then scaled. Tall screens stack the words. */
  const fit = () => {
    const tall = window.matchMedia('(max-aspect-ratio: 4/5)').matches;
    const style = getComputedStyle(root);
    const roomH = root.clientHeight - parseFloat(style.paddingTop) - parseFloat(style.paddingBottom) - status.offsetHeight * (tall ? 1.3 : 1) - legal.offsetHeight - 12;
    inner.style.fontSize = '100px';
    const scale = Math.min(logo.clientWidth / inner.offsetWidth, roomH / inner.offsetHeight);
    if (scale > 0) inner.style.fontSize = `${100 * scale}px`;
  };
  fit();
  new ResizeObserver(fit).observe(root);
  inner.querySelectorAll('img').forEach((img) => {
    if (!img.complete) img.addEventListener('load', fit, { once: true });
  });

  const letters = [...inner.querySelectorAll<HTMLElement>('.bid-letter')];
  const hint = 'Ring the bell to bid';
  status.textContent = hint;

  let price = OPENING_BID;
  let hasBids = false;
  let sold = false;
  let timers: number[] = [];
  let lastPaddle = -1;
  const clearTimers = () => {
    timers.forEach(window.clearTimeout);
    timers = [];
  };

  const say = (text: string) => {
    status.textContent = text;
    status.classList.remove('is-popping');
    void status.offsetWidth;
    status.classList.add('is-popping');
  };

  /** A bidder somewhere in the room raises a paddle: one letter lifts, then settles. */
  const raisePaddle = () => {
    let pick = Math.floor(Math.random() * letters.length);
    if (pick === lastPaddle) pick = (pick + 1) % letters.length;
    lastPaddle = pick;
    const letter = letters[pick];
    letter.style.setProperty('--lift', '1');
    window.setTimeout(() => letter.style.setProperty('--lift', '0'), PADDLE_MS);
    return letter;
  };

  const bubble = (from: HTMLElement) => {
    if (layer.childElementCount >= MAX_BUBBLES) return;
    const area = root.getBoundingClientRect();
    const box = from.getBoundingClientRect();
    const node = document.createElement('span');
    node.className = 'bid-bubble';
    node.textContent = `$${price}`;
    node.style.left = `${box.left + box.width / 2 - area.left}px`;
    node.style.top = `${box.top - area.top}px`;
    node.addEventListener('animationend', () => node.remove());
    layer.append(node);
  };

  const placeBid = () => {
    if (hasBids) price += INCREMENTS[Math.floor(Math.random() * INCREMENTS.length)];
    say(hasBids ? `Current bid $${price}` : `Opening bid $${price}`);
    hasBids = true;
    bubble(raisePaddle());
  };

  const hammer = () => {
    clearTimers();
    timers.push(window.setTimeout(() => say(`Going once at $${price}`), GOING_AFTER_MS));
    timers.push(window.setTimeout(() => say(`Going twice at $${price}`), GOING_AFTER_MS + GOING_STEP_MS));
    timers.push(window.setTimeout(() => {
      sold = true;
      hasBids = false;
      letters.forEach((letter) => letter.style.setProperty('--lift', '0'));
      say(`Sold at $${price}`);
      root.classList.add('is-sold');
      timers.push(window.setTimeout(() => {
        sold = false;
        price = OPENING_BID;
        root.classList.remove('is-sold');
        say(hint);
      }, SOLD_MS));
    }, GOING_AFTER_MS + GOING_STEP_MS * 2));
  };

  const ring = () => {
    bell.classList.remove('is-ringing');
    void bell.offsetWidth;
    bell.classList.add('is-ringing');
  };
  bell.addEventListener('animationend', (event) => {
    if (event.target === bell) bell.classList.remove('is-ringing');
  });

  // Click covers mouse, touch and the keyboard (Enter or Space on the focused bell).
  bell.addEventListener('click', () => {
    ring();
    if (sold) return;
    placeBid();
    hammer();
  });
}
