/** The belt stops just before the end of the section, with every card in its final place. */
const TRAVEL_ENDS = 0.97;
/** The feeder curves into the top of the loop from above the screen. */
const FEED_RADIUS = 60;
const FEED_CLEARANCE = 24;
const EDGE = 20;
const SENTENCE_GAP = 6;
const OFF_SCREEN = 28;
const WORD_START_OPACITY = 0.14;
const WORDS_TO = 0.82;

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const smooth = (a: number, b: number, x: number) => {
  const t = clamp01((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};

type Track = { a: number; b: number; r: number; length: number; phase: number };

const makeTrack = (a: number, b: number, r: number, phase: (bottomCentre: number, length: number) => number): Track => {
  const length = 4 * (a - r) + 4 * (b - r) + 2 * Math.PI * r;
  const bottomCentre = b - r + (Math.PI * r) / 2 + (a - r);
  return { a, b, r, length, phase: phase(bottomCentre, length) };
};

/** Distance along a rounded rectangle, clockwise from the middle of its right side. Equal distance means equal speed. */
function pointOnTrack({ a, b, r, length }: Track, distance: number) {
  const down = b - r;
  const across = a - r;
  const arc = (Math.PI * r) / 2;
  let d = ((distance % length) + length) % length;
  if (d < down) return { x: a, y: d };
  d -= down;
  if (d < arc) return { x: across + r * Math.cos(d / r), y: down + r * Math.sin(d / r) };
  d -= arc;
  if (d < 2 * across) return { x: across - d, y: b };
  d -= 2 * across;
  if (d < arc) return { x: -across - r * Math.sin(d / r), y: down + r * Math.cos(d / r) };
  d -= arc;
  if (d < 2 * down) return { x: -a, y: down - d };
  d -= 2 * down;
  if (d < arc) return { x: -across - r * Math.cos(d / r), y: -down - r * Math.sin(d / r) };
  d -= arc;
  if (d < 2 * across) return { x: -across + d, y: -b };
  d -= 2 * across;
  if (d < arc) return { x: across + r * Math.sin(d / r), y: -down - r * Math.cos(d / r) };
  d -= arc;
  return { x: a, y: -down + d };
}

/** Scroll-driven: the cards drop in from above the screen and ride a belt around the sentence as its words turn black. Click a card to flip it. */
export function mountAgents(section: HTMLElement) {
  const stage = section.querySelector<HTMLElement>('.agents-stage');
  const line = section.querySelector<HTMLElement>('.agents-line');
  const belt = section.querySelector<SVGRectElement>('.agents-belt rect');
  const feeder = section.querySelector<SVGPathElement>('.agents-belt path');
  if (!stage || !line) return;

  const words = [...section.querySelectorAll<HTMLElement>('.agents-word')];
  const bars = [...section.querySelectorAll<HTMLElement>('.agent-bar i')];
  const items = [...section.querySelectorAll<HTMLElement>('.agent-item')];

  section.addEventListener('click', (event) => {
    const button = event.target instanceof Element ? event.target.closest<HTMLButtonElement>('.agent-flip') : null;
    const item = button?.closest('.agent-item');
    if (!button || !item) return;
    const flipped = item.classList.toggle('is-flipped');
    button.setAttribute('aria-pressed', String(flipped));
    item.querySelector('.agent-back')?.setAttribute('aria-hidden', String(!flipped));
  });

  let track = makeTrack(1, 1, 0, () => 0);
  let halfW = 0;
  let halfH = 0;
  let stageW = 0;
  let stageH = 0;
  /** Where the feeder meets the loop, how far above it the first card waits, and the total distance run. */
  let joinAt = 0;
  let feedLength = 0;
  let totalTravel = 0;

  /** Distance back up the feeder from where it joins the top of the loop. */
  const pointOnFeeder = (distance: number) => {
    const arc = (Math.PI * FEED_RADIUS) / 2;
    const top = -track.b - FEED_RADIUS;
    if (distance >= arc) return { x: -FEED_RADIUS, y: top - (distance - arc) };
    const angle = Math.PI / 2 - distance / FEED_RADIUS;
    return { x: -FEED_RADIUS * Math.cos(angle), y: top + FEED_RADIUS * Math.sin(angle) };
  };

  const measure = () => {
    const box = stage.getBoundingClientRect();
    stageW = box.width;
    stageH = box.height;
    halfW = items[0].offsetWidth / 2;
    halfH = items[0].offsetHeight / 2;

    const range = document.createRange();
    range.selectNodeContents(line);
    const text = range.getBoundingClientRect();
    const sidesFit = stageW / 2 - halfW * 2 - EDGE >= text.width / 2 + SENTENCE_GAP;
    const rowsFit = stageH / 2 - halfH * 2 - EDGE >= text.height / 2 + SENTENCE_GAP;

    // Runs that would cross the sentence go off screen instead, where the belt turns round unseen.
    const insideA = stageW / 2 - halfW - EDGE;
    const insideB = stageH / 2 - halfH - EDGE;
    if (sidesFit && rowsFit) {
      track = makeTrack(insideA, insideB, Math.min(insideA, insideB) * 0.4, () => 0);
    } else if (sidesFit) {
      track = makeTrack(insideA, stageH / 2 + halfH + OFF_SCREEN, 40, () => 0);
    } else {
      // Spaced so a card coming down the feeder clears the one that just joined, using the hidden part of the belt.
      const shortest = 4 * (stageW / 2 + halfW + OFF_SCREEN) + 4 * insideB;
      const spaced = items.length * (halfW * 2 + halfH * 2 + FEED_CLEARANCE);
      const a = stageW / 2 + halfW + OFF_SCREEN + Math.max(0, spaced - shortest) / 4;
      // Ends with one card centred in each row.
      track = makeTrack(a, insideB, 40, (bottomCentre, length) => bottomCentre + length / 3);
    }

    const { a, b, r, length, phase } = track;
    joinAt = length - (b - r + (Math.PI * r) / 2 + (a - r));
    // The first card starts just out of sight, so the first scroll brings it in.
    const justAbove = stageH / 2 + halfH + 4;
    feedLength = Math.max(0, justAbove - b - FEED_RADIUS) + (Math.PI * FEED_RADIUS) / 2;
    // Runs on until the last card is on the loop and every card has reached its final place.
    const lastJoins = (length * (items.length - 1)) / items.length;
    let run = (((phase - joinAt) % length) + length) % length;
    while (run < lastJoins - 0.5) run += length;
    totalTravel = feedLength + run;

    if (feeder) {
      const joinX = stageW / 2;
      const joinY = stageH / 2 - b;
      feeder.setAttribute('d', `M ${joinX - FEED_RADIUS} ${Math.min(-8, joinY - FEED_RADIUS)} V ${joinY - FEED_RADIUS} A ${FEED_RADIUS} ${FEED_RADIUS} 0 0 0 ${joinX} ${joinY}`);
    }
    if (belt) {
      belt.setAttribute('x', String(stageW / 2 - track.a));
      belt.setAttribute('y', String(stageH / 2 - track.b));
      belt.setAttribute('width', String(track.a * 2));
      belt.setAttribute('height', String(track.b * 2));
      belt.setAttribute('rx', String(track.r));
    }
  };

  const render = (p: number) => {
    const travel = clamp01(p / TRAVEL_ENDS) * totalTravel;
    if (belt) belt.style.strokeDashoffset = String(-travel);
    if (feeder) feeder.style.strokeDashoffset = String(-travel);

    items.forEach((el, index) => {
      const onLoop = travel - feedLength - (index * track.length) / items.length;
      const { x, y } = onLoop >= 0 ? pointOnTrack(track, joinAt + onLoop) : pointOnFeeder(-onLoop);
      // A slight lean towards the sentence keeps it reading as 3D without changing the spacing.
      const rotateY = (-x / track.a) * 7;
      const rotateX = (Math.max(-track.b, y) / track.b) * 5;
      el.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0) rotateY(${rotateY.toFixed(2)}deg) rotateX(${rotateX.toFixed(2)}deg) translate(-50%, -50%)`;
      // Off-screen cards must not take clicks or keyboard focus.
      const offScreen = Math.abs(x) - halfW > stageW / 2 || Math.abs(y) - halfH > stageH / 2;
      el.style.visibility = offScreen ? 'hidden' : 'visible';
    });
    const filled = smooth(0, 0.6, p).toFixed(3);
    bars.forEach((bar) => {
      bar.style.transform = `scaleX(${filled})`;
    });

    const span = WORDS_TO / words.length;
    words.forEach((word, i) => {
      const lit = smooth(i * span, (i + 1.5) * span, p);
      word.style.opacity = (WORD_START_OPACITY + (1 - WORD_START_OPACITY) * lit).toFixed(3);
    });
  };

  /** Reduced motion leaves no room to scroll, which shows the finished layout. */
  const target = () => {
    const room = section.scrollHeight - section.clientHeight;
    return room > 0 ? clamp01(section.scrollTop / room) : 1;
  };

  let current = target();
  let running = false;
  const step = () => {
    const goal = target();
    // A return from the next section lands at the end, so catch up at once.
    current = Math.abs(goal - current) > 0.3 ? goal : current + (goal - current) * 0.14;
    if (Math.abs(goal - current) < 0.0004) current = goal;
    render(current);
    if (current === goal) {
      running = false;
      return;
    }
    requestAnimationFrame(step);
  };
  const wake = () => {
    if (running) return;
    running = true;
    requestAnimationFrame(step);
  };

  section.addEventListener('scroll', wake, { passive: true });
  // Cards count too: late styles or fonts change their size without changing the stage.
  const resized = new ResizeObserver(() => {
    measure();
    current = target();
    render(current);
  });
  resized.observe(stage);
  resized.observe(line);
  items.forEach((el) => resized.observe(el));
  measure();
  render(current);
}
