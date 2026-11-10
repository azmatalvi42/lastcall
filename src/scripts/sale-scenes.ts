/**
 * Four hand-drawn scenes of the selling process, one shown at a time: listing, bidding, payment, pickup.
 * Stage 0 is the listing still being sketched. Stages 1 to 4 are the finished scenes.
 */
const SVG_NS = 'http://www.w3.org/2000/svg';
const LAST_STAGE = 4;
/** The least time each stage stays up, so that fast typing or autofill still shows every scene. */
const STAGE_MS = [0, 1300, 1700, 1400];

const CHAIR =
  '<path class="scene-fill-chair" d="M3 16a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-5a2 2 0 0 0-4 0v1.5a.5.5 0 0 1-.5.5h-9a.5.5 0 0 1-.5-.5V11a2 2 0 0 0-4 0z"/><path class="scene-fill-chair" d="M19 9V6a2 2 0 0 0-2-2H7a2 2 0 0 0-2 2v3"/><path d="M5 18v2"/><path d="M19 18v2"/><path class="scene-fill-tag" d="m14 3 4-2 3 3-2 4z"/>';
const GAVEL =
  '<path d="m14 13-8.381 8.38a1 1 0 0 1-3-3l8.384-8.381"/><path d="m16 16 6-6"/><path d="m21.5 10.5-8-8"/><path d="m8 8 6-6"/><path d="m8.5 7.5 8 8"/>';
const HAND_RECEIVING =
  '<path d="M11 15h2a2 2 0 1 0 0-4h-3c-.6 0-1.1.2-1.4.6L3 17"/><path d="m7 21 1.6-1.4c.3-.4.8-.6 1.4-.6h4c1.1 0 2.1-.4 2.8-1.2l4.6-4.4a2 2 0 0 0-2.75-2.91l-4.2 3.9"/><path d="m2 16 6 6"/>';
const HANDSHAKE =
  '<path d="m11 17 2 2a1 1 0 1 0 3-3"/><path d="m14 14 2.5 2.5a1 1 0 1 0 3-3l-3.88-3.88a3 3 0 0 0-4.24 0l-.88.88a1 1 0 1 1-3-3l2.81-2.81a5.79 5.79 0 0 1 7.06-.87l.47.28a2 2 0 0 0 1.42.25L21 4"/><path d="m21 3 1 11h-2"/><path d="M3 3 2 14l6.5 6.5a1 1 0 1 0 3-3"/><path d="M3 4h8"/>';

const sketch = (inner: string) => `<g filter="url(#scene-sketch)">${inner}</g>`;
/** A 24 unit icon, with its line weight kept the same at any size. */
const icon = (paths: string, x: number, y: number, scale: number, className = '') =>
  `<g class="scene-ink ${className}" style="stroke-width: ${(1.5 / scale).toFixed(2)}" transform="translate(${x} ${y}) scale(${scale})">${paths}</g>`;

/** A red check mark, in place of a stamp with words on it. */
const check = (x: number, y: number) =>
  `<g class="scene-check"><circle cx="${x}" cy="${y}" r="7.5"/><path d="M${x - 3.6} ${y + 0.2}l2.6 2.8 4.8-5.4"/></g>`;

const LISTING = `
  ${sketch(`
    <rect class="scene-line scene-paper" x="20" y="2" width="90" height="84" rx="2"/>
    <path class="scene-line" d="M20 11H110"/>
    <circle class="scene-line" cx="25" cy="6.5" r="1"/><circle class="scene-line" cx="29" cy="6.5" r="1"/><circle class="scene-line" cx="33" cy="6.5" r="1"/>
    <rect class="scene-line" x="26" y="17" width="38" height="44"/>
    <g class="scene-listing-done">
      <path class="scene-line scene-heading" d="M70 21H96"/>
      <path class="scene-line" d="M70 30H104M70 37H104M70 44H92"/>
      <path class="scene-line" d="M26 69H104M26 76H88"/>
    </g>
    <g class="scene-listing-draft">
      <path class="scene-line scene-dashed" d="M70 21H96M70 30H104M70 37H104M70 44H92"/>
      <path class="scene-line scene-dashed" d="M26 69H104M26 76H88"/>
    </g>
  `)}
  <g class="scene-listing-chair">${sketch(icon(CHAIR, 31, 25, 1.17))}</g>
  ${check(87, 54)}`;

const bidder = (x: number, order: number) => `
  <g class="scene-bidder" style="--order: ${order}">
    <g class="scene-paddle">
      <path class="scene-line" d="M${x + 9} 86V72"/>
      <circle class="scene-disc" cx="${x + 9}" cy="68" r="5.6"/>
    </g>
    <circle class="scene-line scene-paper" cx="${x}" cy="76" r="5"/>
    <path class="scene-line scene-paper" d="M${x - 10} 91Q${x - 10} 82 ${x} 82Q${x + 10} 82 ${x + 10} 91"/>
  </g>`;

const BIDDING = `
  ${sketch(`
    <path class="scene-line" d="M-4 58H134"/>
    <path class="scene-line scene-block" d="M47 58V43H83V58"/>
    <path class="scene-line" d="M108 54H131V58H108Z"/>
  `)}
  ${sketch(icon(CHAIR, 50, 12, 1.25))}
  <g class="scene-gavel">${sketch(icon(GAVEL, 108, 33, 1))}</g>
  ${bidder(20, 0)}${bidder(62, 1)}${bidder(104, 2)}`;

const coin = (x: number, y: number, order: number) =>
  `<g class="scene-coin" style="--order: ${order}">${sketch(`<circle class="scene-line scene-gold" cx="${x}" cy="${y}" r="5.4"/><path class="scene-line" d="M${x} ${y - 2.6}V${y + 2.6}"/>`)}</g>`;

const PAYMENT = `
  ${sketch(icon(HAND_RECEIVING, 26, 6, 3.3))}
  ${coin(84, 26, 0)}${coin(68, 13, 1)}${coin(92, 9, 2)}
  ${check(104, 62)}`;

const PICKUP = `
  <g class="scene-handshake">${sketch(icon(HANDSHAKE, 24, -4, 3.4))}</g>
  <text class="scene-caption" x="65" y="92" text-anchor="middle">Lastcall guarantees a smooth sale.</text>`;

export type SaleScenes = { goTo: (stage: number) => void; finish: () => void };

export function mountSaleScenes(root: HTMLElement): SaleScenes {
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('viewBox', '-10 -14 150 120');
  svg.classList.add('sale-scenes');
  svg.dataset.stage = '0';
  svg.innerHTML = `
    <defs>
      <filter id="scene-sketch" filterUnits="userSpaceOnUse" x="-10" y="-14" width="150" height="120">
        <feTurbulence type="fractalNoise" baseFrequency=".05" numOctaves="2" seed="7"/>
        <feDisplacementMap in="SourceGraphic" scale="1.1"/>
      </filter>
    </defs>
    ${[LISTING, BIDDING, PAYMENT, PICKUP].map((scene, i) => `<g class="sale-scene" data-scene="${i + 1}">${scene}</g>`).join('')}`;
  root.prepend(svg);

  let stage = 0;
  let target = 0;
  let enteredAt = 0;
  let finishing = false;
  let timer = 0;

  /** Steps towards the target one scene at a time. Going back is immediate. */
  const advance = () => {
    window.clearTimeout(timer);
    if (target === stage) return;
    const forward = target > stage;
    const remaining = forward && !reduce ? enteredAt + (STAGE_MS[stage] ?? 0) - performance.now() : 0;
    if (remaining > 0) {
      timer = window.setTimeout(advance, remaining);
      return;
    }
    stage = forward ? stage + 1 : target;
    enteredAt = performance.now();
    svg.dataset.stage = String(stage);
    advance();
  };

  return {
    goTo: (next) => {
      if (finishing) return;
      target = next;
      advance();
    },
    /** Plays whatever is left, so that every sale ends on the handshake. */
    finish: () => {
      finishing = true;
      target = LAST_STAGE;
      advance();
    },
  };
}
