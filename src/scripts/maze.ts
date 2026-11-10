const COLS = 13;
const ROWS = 10;
const CELL = 10;
/** The bottom right corner is an open yard with the house in it. The way in is from the left, along the bottom row. */
const YARD_COL = 10;
const YARD_ROW = 7;
const LAST_CELL = { c: YARD_COL - 1, r: ROWS - 1 };
const DOOR = { x: 115, y: 97.4 };
const SEEDS = 60;
/** Where the pen stops for each question, then the door. */
const STOPS = [0, 0.25, 0.5, 0.75, 1];
const WALK_MS = 1500;

const SVG_NS = 'http://www.w3.org/2000/svg';
const inYard = (c: number, r: number) => c >= YARD_COL && r >= YARD_ROW;
const key = (a: number, b: number, c: number, d: number) => (a < c || (a === c && b < d) ? `${a},${b}|${c},${d}` : `${c},${d}|${a},${b}`);

function random(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Carves one maze and returns its open passages and the route through it. */
function carve(seed: number) {
  const rand = random(seed);
  const open = new Set<string>();
  const seen = new Set<string>(['0,0']);
  const stack = [{ c: 0, r: 0 }];
  const steps = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  while (stack.length) {
    const { c, r } = stack[stack.length - 1];
    const next = steps
      .map(([dc, dr]) => ({ c: c + dc, r: r + dr }))
      .filter((n) => n.c >= 0 && n.c < COLS && n.r >= 0 && n.r < ROWS && !inYard(n.c, n.r) && !seen.has(`${n.c},${n.r}`));
    if (!next.length) {
      stack.pop();
      continue;
    }
    const pick = next[Math.floor(rand() * next.length)];
    open.add(key(c, r, pick.c, pick.r));
    seen.add(`${pick.c},${pick.r}`);
    stack.push(pick);
  }

  const cameFrom = new Map<string, { c: number; r: number } | null>([['0,0', null]]);
  const queue = [{ c: 0, r: 0 }];
  while (queue.length) {
    const cell = queue.shift()!;
    steps.forEach(([dc, dr]) => {
      const n = { c: cell.c + dc, r: cell.r + dr };
      if (open.has(key(cell.c, cell.r, n.c, n.r)) && !cameFrom.has(`${n.c},${n.r}`)) {
        cameFrom.set(`${n.c},${n.r}`, cell);
        queue.push(n);
      }
    });
  }
  const route: { c: number; r: number }[] = [];
  let at: { c: number; r: number } | null | undefined = LAST_CELL;
  while (at) {
    route.unshift(at);
    at = cameFrom.get(`${at.c},${at.r}`);
  }
  return { open, route };
}

/** A hand-drawn line: slightly off at both ends and bowed in the middle. */
function drawnLine(x1: number, y1: number, x2: number, y2: number, rand: () => number, wobble: number) {
  const jig = () => (rand() - 0.5) * wobble;
  const midX = (x1 + x2) / 2 + jig() * 1.4;
  const midY = (y1 + y2) / 2 + jig() * 1.4;
  return `M${(x1 + jig()).toFixed(2)} ${(y1 + jig()).toFixed(2)}Q${midX.toFixed(2)} ${midY.toFixed(2)} ${(x2 + jig()).toFixed(2)} ${(y2 + jig()).toFixed(2)}`;
}

function wallsPath(open: Set<string>, seed: number, wobble: number) {
  const rand = random(seed);
  const walls: string[] = [];
  const wall = (x1: number, y1: number, x2: number, y2: number) => walls.push(drawnLine(x1, y1, x2, y2, rand, wobble));
  // The yard's way in and the start are the only gaps that are not passages.
  const passable = (c: number, r: number, c2: number, r2: number) =>
    open.has(key(c, r, c2, r2)) || (inYard(c, r) && inYard(c2, r2)) || (c === LAST_CELL.c && r === LAST_CELL.r && c2 === YARD_COL && r2 === r);
  for (let r = 0; r < ROWS; r += 1) {
    for (let c = 0; c < COLS; c += 1) {
      const x = c * CELL;
      const y = r * CELL;
      if (c < COLS - 1 && !passable(c, r, c + 1, r)) wall(x + CELL, y, x + CELL, y + CELL);
      if (r < ROWS - 1 && !passable(c, r, c, r + 1)) wall(x, y + CELL, x + CELL, y + CELL);
    }
  }
  for (let c = 1; c < COLS; c += 1) wall(c * CELL, 0, (c + 1) * CELL, 0);
  for (let c = 0; c < COLS; c += 1) wall(c * CELL, ROWS * CELL, (c + 1) * CELL, ROWS * CELL);
  for (let r = 0; r < ROWS; r += 1) {
    wall(0, r * CELL, 0, (r + 1) * CELL);
    wall(COLS * CELL, r * CELL, COLS * CELL, (r + 1) * CELL);
  }
  return walls.join('');
}

/** The route as one line, with its corners rounded the way a pen would take them. */
function routePath(route: { c: number; r: number }[]) {
  const points = [
    { x: CELL / 2, y: -2 },
    ...route.map(({ c, r }) => ({ x: c * CELL + CELL / 2, y: r * CELL + CELL / 2 })),
    { x: (YARD_COL - 0.5) * CELL + 6, y: DOOR.y },
    DOOR,
  ];
  const corner = 3;
  let d = `M${points[0].x} ${points[0].y}`;
  for (let i = 1; i < points.length - 1; i += 1) {
    const [prev, at, next] = [points[i - 1], points[i], points[i + 1]];
    const toward = (a: { x: number; y: number }, b: { x: number; y: number }) => {
      const length = Math.hypot(b.x - a.x, b.y - a.y) || 1;
      return { x: a.x + ((b.x - a.x) / length) * corner, y: a.y + ((b.y - a.y) / length) * corner };
    };
    const inPoint = toward(at, prev);
    const outPoint = toward(at, next);
    d += `L${inPoint.x.toFixed(2)} ${inPoint.y.toFixed(2)}Q${at.x} ${at.y} ${outPoint.x.toFixed(2)} ${outPoint.y.toFixed(2)}`;
  }
  return `${d}L${DOOR.x} ${DOOR.y}`;
}

const HOUSE = `
  <g class="maze-house">
    <path d="M105.2 82.3 105 96.2 125.1 96 124.8 82.1"/>
    <path d="M103 82.4 115.1 73.2 127.2 82.2 103 82.4"/>
    <path d="M120.4 78 120.5 74.2 123.2 74.3 123.1 80"/>
    <path d="M107.5 85.5h3.6v3.5h-3.6zM119 85.4h3.6v3.6h-3.6z"/>
    <rect class="maze-glow" x="112.4" y="87.4" width="5.2" height="8.7"/>
    <rect class="maze-door" x="112.4" y="87.4" width="5.2" height="8.7"/>
  </g>`;
const PENCIL = `
  <g class="maze-pencil">
    <path class="maze-pencil-body" d="M0 0 1.3 -3.3 8.3 -10.3 11.2 -7.4 4.2 -.4Z"/>
    <path class="maze-pencil-tip" d="M0 0 1.3 -3.3 3.3 -1.3Z"/>
    <path class="maze-pencil-end" d="M8.3 -10.3 9.8 -11.8 12.7 -8.9 11.2 -7.4Z"/>
  </g>`;

export type Maze = { goTo: (stage: number, instant?: boolean) => void };

/** Draws the maze and moves the pen along its route. Each stage is a question, and the last is the door. */
export function mountMaze(root: HTMLElement): Maze {
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // The same drawing for everyone: of a fixed set of mazes, the one with the longest way through.
  let best = carve(1);
  for (let seed = 2; seed <= SEEDS; seed += 1) {
    const maze = carve(seed);
    if (maze.route.length > best.route.length) best = maze;
  }

  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('viewBox', '-10 -14 150 120');
  svg.innerHTML = `
    <path class="maze-walls" d="${wallsPath(best.open, 11, 0.8)}"/>
    <path class="maze-walls maze-walls-ghost" d="${wallsPath(best.open, 29, 1.5)}"/>
    <text class="maze-start" x="${CELL / 2 - 2.5}" y="-1.5" text-anchor="end">Start</text>
    ${HOUSE}
    <path class="maze-trail" d="${routePath(best.route)}"/>
    <g class="maze-stops"></g>
    ${PENCIL}`;
  root.prepend(svg);

  const trail = svg.querySelector<SVGPathElement>('.maze-trail')!;
  const pencil = svg.querySelector<SVGGElement>('.maze-pencil')!;
  const stopsLayer = svg.querySelector<SVGGElement>('.maze-stops')!;
  const total = trail.getTotalLength();
  trail.style.strokeDasharray = `${total} ${total}`;

  const stops = STOPS.slice(1, -1).map((share) => {
    const at = total * share;
    const point = trail.getPointAtLength(at);
    const dot = document.createElementNS(SVG_NS, 'circle');
    dot.setAttribute('cx', String(point.x));
    dot.setAttribute('cy', String(point.y));
    dot.setAttribute('r', '1.5');
    stopsLayer.append(dot);
    return { at, dot };
  });

  let length = 0;
  const render = () => {
    trail.style.strokeDashoffset = String(total - length);
    const point = trail.getPointAtLength(length);
    pencil.setAttribute('transform', `translate(${point.x.toFixed(2)} ${point.y.toFixed(2)})`);
    stops.forEach(({ at, dot }) => dot.classList.toggle('is-passed', length >= at - 0.5));
  };

  let frame = 0;
  const goTo = (stage: number, instant = false) => {
    cancelAnimationFrame(frame);
    const target = total * STOPS[stage];
    if (reduce || instant) {
      length = target;
      render();
      return;
    }
    const from = length;
    const started = performance.now();
    const step = (now: number) => {
      const t = Math.min(1, (now - started) / WALK_MS);
      const eased = t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2;
      length = from + (target - from) * eased;
      render();
      if (t < 1) frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
  };

  render();
  return { goTo };
}
