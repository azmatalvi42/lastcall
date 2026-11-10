import * as THREE from 'three';
import { HIGHWAYS, LAND, OTHER_LAND, type Point } from './area-map-geo';

type City = { name: string; col: number; row: number; side: 't' | 'b' | 'l' | 'r' };

/**
 * Every city we cover, west to east, on the dot grid. Cells come from true locations, nudged a cell or two
 * where flowers would collide. Side is where the name sits, chosen so that no two names touch.
 */
const CITIES: City[] = [
  { name: 'London', col: -23, row: -11, side: 'r' },
  { name: 'Waterloo', col: -11, row: 2, side: 'l' },
  { name: 'Kitchener', col: -9, row: 1, side: 'b' },
  { name: 'Cambridge', col: -5, row: -1, side: 'b' },
  { name: 'Guelph', col: -4, row: 3, side: 't' },
  { name: 'Milton', col: 3, row: 3, side: 'l' },
  { name: 'Hamilton', col: 3, row: -4, side: 'l' },
  { name: 'Burlington', col: 5, row: -2, side: 'r' },
  { name: 'Brampton', col: 6, row: 8, side: 't' },
  { name: 'Oakville', col: 7, row: 1, side: 'r' },
  { name: 'Mississauga', col: 8, row: 5, side: 'l' },
  { name: 'Vaughan', col: 10, row: 11, side: 'l' },
  { name: 'Richmond Hill', col: 12, row: 13, side: 't' },
  { name: 'Toronto', col: 13, row: 6, side: 'r' },
  { name: 'Markham', col: 14, row: 12, side: 'b' },
  { name: 'Pickering', col: 18, row: 11, side: 'b' },
  { name: 'Ajax', col: 20, row: 12, side: 'b' },
  { name: 'Whitby', col: 22, row: 13, side: 't' },
  { name: 'Oshawa', col: 24, row: 13, side: 'b' },
];

/** Place names and highway numbers, in the same 0..1 frame as the geometry. */
const WATER_NAMES = [
  { lines: ['Lake', 'Ontario'], x: 0.815, y: 0.5 },
  { lines: ['Lake Erie'], x: 0.665, y: 0.065 },
  { lines: ['Georgian Bay'], x: 0.5, y: 1.3, far: true },
  { lines: ['Lake Huron'], x: -0.2, y: 1.05 },
];
const LAND_NAMES = [
  { lines: ['Southern', 'Ontario'], x: 0.2, y: 0.64 },
  { lines: ['New York'], x: 0.945, y: 0.2 },
  { lines: ['Pennsylvania'], x: 0.55, y: -0.35 },
];
const SHIELDS = [
  { ref: '401', x: 0.225, y: 0.253 },
  { ref: '401', x: 0.46, y: 0.527 },
  { ref: '403', x: 0.41, y: 0.355 },
  { ref: 'QEW', x: 0.72, y: 0.354 },
];

/** One flower size for every city, so that each reads as the same kind of mark. */
const FLOWER_SIZE = 0.07;
const PETAL_REACH = 0.45;
const HOVER_RADIUS = 0.055;
const URBAN_REACH = 0.1;
const FRAME_PX = 256;
const DOT_LITE = new THREE.Color(0xd5cebf);
const DOT_INK = new THREE.Color(0xa89f91);
const DOT_SMALL = 0.0058;
const DOT_LARGE = 0.0078;
const GRID = 0.036;
const WORLD_H = 1.5;
const WORLD_W = WORLD_H * 1.379;
/** Real width of the frame at its latitude, for the scale bar. */
const FRAME_KM = 242.6;

const cellToWorld = (col: number, row: number) => new THREE.Vector3(col * GRID, row * GRID, 0);

const svgPoints = (points: Point[]) =>
  points.map(([x, y]) => `${(x * 1379).toFixed(1)},${((1 - y) * 1000).toFixed(1)}`).join(' ');

const mapMark = (className: string, html: string) => {
  const el = document.createElement('span');
  el.className = className;
  el.setAttribute('aria-hidden', 'true');
  el.innerHTML = html;
  return el;
};

function inside(x: number, y: number, poly: [number, number][]) {
  let n = 0;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i];
    const [xj, yj] = poly[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi + 1e-9) + xi) n += 1;
  }
  return n % 2 === 1;
}

function drawPoppy(ctx: CanvasRenderingContext2D, size: number) {
  const cx = size / 2;
  const cy = size / 2;
  const r = size * 0.2;
  const reach = size * 0.22;
  const colors = ['#e07a18', '#c45a12', '#e8922a', '#b84e10'];
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(0.35);
  for (let i = 0; i < 4; i += 1) {
    const a = (i * Math.PI) / 2;
    ctx.beginPath();
    ctx.ellipse(Math.cos(a) * reach, Math.sin(a) * reach, r * 1.15, r * 0.92, a, 0, Math.PI * 2);
    ctx.fillStyle = colors[i];
    ctx.fill();
  }
  ctx.beginPath();
  ctx.arc(0, 0, size * 0.07, 0, Math.PI * 2);
  ctx.fillStyle = '#3a2208';
  ctx.fill();
  for (let i = 0; i < 8; i += 1) {
    const a = (i / 8) * Math.PI * 2 + 0.2;
    ctx.beginPath();
    ctx.arc(Math.cos(a) * size * 0.035, Math.sin(a) * size * 0.035, size * 0.012, 0, Math.PI * 2);
    ctx.fillStyle = '#5c3210';
    ctx.fill();
  }
  ctx.restore();
}

export function makePoppyTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = FRAME_PX;
  canvas.height = FRAME_PX;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('poppy texture');
  drawPoppy(ctx, FRAME_PX);
  const tex = new THREE.CanvasTexture(canvas);
  tex.minFilter = THREE.LinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.generateMipmaps = false;
  tex.premultiplyAlpha = true;
  tex.needsUpdate = true;
  return tex;
}

type Flower = {
  pos: THREE.Vector3;
  seed: number;
  bloom: number;
  target: number;
};

export function mountAreaPoppies(root: HTMLElement) {
  const canvas = root.querySelector('canvas');
  if (!(canvas instanceof HTMLCanvasElement)) return;

  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const cities = CITIES.map((city) => ({ ...city, pos: cellToWorld(city.col, city.row) }));

  const base = root.querySelector('[data-area-base]');
  if (base) {
    base.innerHTML = [
      `<polygon class="map-land" points="${svgPoints(LAND)}"/>`,
      ...OTHER_LAND.map((part) => `<polygon class="map-land" points="${svgPoints(part)}"/>`),
      ...HIGHWAYS.map((line) => `<polyline class="map-highway" points="${svgPoints(line)}"/>`),
    ].join('');
  }

  const dots: { pos: THREE.Vector3; urban: number }[] = [];
  /* Dots run past the frame, far enough to reach the edge of any screen shape. */
  const cols = Math.ceil((WORLD_W * 1.1) / GRID);
  const rows = Math.ceil((WORLD_H * 1.3) / GRID);
  for (let row = -rows; row <= rows; row += 1) {
    for (let col = -cols; col <= cols; col += 1) {
      const pos = cellToWorld(col, row);
      if (!inside(pos.x / WORLD_W + 0.5, pos.y / WORLD_H + 0.5, LAND)) continue;
      if (cities.some((c) => c.pos.distanceTo(pos) < FLOWER_SIZE * PETAL_REACH)) continue;
      const pull = cities.reduce((m, c) => Math.max(m, 1 - c.pos.distanceTo(pos) / URBAN_REACH), 0);
      dots.push({ pos, urban: pull * pull * (3 - 2 * pull) });
    }
  }

  const flowers: Flower[] = cities.map((city, i) => ({
    pos: city.pos,
    seed: i * 0.173,
    bloom: 0,
    target: 1,
  }));

  const renderer = new THREE.WebGLRenderer({
    canvas,
    alpha: true,
    antialias: true,
    powerPreference: 'high-performance',
    preserveDrawingBuffer: false,
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 30);
  camera.position.set(0, 0, 8);
  camera.lookAt(0, 0, 0);

  const started = performance.now();
  const pointer = new THREE.Vector2();
  const hit = new THREE.Vector3(40, 40, 0);
  const plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
  const raycaster = new THREE.Raycaster();
  const dummy = new THREE.Object3D();
  const dummyColor = new THREE.Color();

  const dotGeo = new THREE.CircleGeometry(1, 8);
  const dotMat = new THREE.MeshBasicMaterial({ toneMapped: false });
  const dotMesh = new THREE.InstancedMesh(dotGeo, dotMat, dots.length);
  dotMesh.frustumCulled = false;
  dots.forEach((d, i) => {
    dummy.position.copy(d.pos);
    dummy.scale.setScalar(DOT_SMALL + (DOT_LARGE - DOT_SMALL) * d.urban);
    dummy.updateMatrix();
    dotMesh.setMatrixAt(i, dummy.matrix);
    dummyColor.copy(DOT_LITE).lerp(DOT_INK, d.urban);
    dotMesh.setColorAt(i, dummyColor);
  });
  if (dotMesh.instanceColor) dotMesh.instanceColor.needsUpdate = true;
  scene.add(dotMesh);

  const poppyTex = makePoppyTexture();
  const poppyGeo = new THREE.PlaneGeometry(1, 1);
  const poppyMat = new THREE.MeshBasicMaterial({
    map: poppyTex,
    transparent: true,
    premultipliedAlpha: true,
    depthWrite: false,
    toneMapped: false,
    side: THREE.DoubleSide,
    alphaTest: 0.05,
  });
  const poppyMesh = new THREE.InstancedMesh(poppyGeo, poppyMat, flowers.length);
  poppyMesh.frustumCulled = false;
  poppyMesh.renderOrder = 1;
  flowers.forEach((f, i) => {
    dummy.position.copy(f.pos);
    dummy.rotation.set(0, 0, (f.seed - 0.5) * 0.7);
    dummy.scale.setScalar(0.001);
    dummy.updateMatrix();
    poppyMesh.setMatrixAt(i, dummy.matrix);
  });
  scene.add(poppyMesh);

  const labelLayer = root.querySelector('[data-city-labels]');
  const marks = [
    ...WATER_NAMES.map(({ lines, x, y, far }) => ({ x, y, el: mapMark(`map-name map-name-water${far ? ' map-name-far' : ''}`, lines.join('<br>')) })),
    ...LAND_NAMES.map(({ lines, x, y }) => ({ x, y, el: mapMark('map-name map-name-land', lines.join('<br>')) })),
    ...SHIELDS.map(({ ref, x, y }) => ({ x, y, el: mapMark('map-shield', ref) })),
  ];
  marks.forEach(({ el }) => labelLayer?.append(el));
  const scaleBar = root.closest('section')?.querySelector<HTMLElement>('[data-map-scale]');
  const labels = cities.map((city) => {
    const el = document.createElement('span');
    el.className = 'city-label';
    el.dataset.side = city.side;
    el.textContent = city.name;
    labelLayer?.append(el);
    return { el, city };
  });

  /** Keeps the whole frame on screen. Whatever room is left shows the land and water around it. */
  const fit = () => {
    const { width, height } = root.getBoundingClientRect();
    if (width < 2 || height < 2) return;
    renderer.setSize(width, height, false);
    const pxPerWorld = Math.min(width / WORLD_W, height / WORLD_H);
    const halfW = width / pxPerWorld / 2;
    const halfH = height / pxPerWorld / 2;
    camera.left = -halfW;
    camera.right = halfW;
    camera.top = halfH;
    camera.bottom = -halfH;
    camera.updateProjectionMatrix();
    base?.setAttribute(
      'viewBox',
      `${(0.5 - halfW / WORLD_W) * 1379} ${(0.5 - halfH / WORLD_H) * 1000} ${((halfW * 2) / WORLD_W) * 1379} ${((halfH * 2) / WORLD_H) * 1000}`,
    );
    if (scaleBar) scaleBar.style.width = `${(50 / FRAME_KM) * WORLD_W * pxPerWorld}px`;
    placeLabels(width, height, pxPerWorld);
  };

  const placeLabels = (width: number, height: number, pxPerWorld: number) => {
    marks.forEach(({ x, y, el }) => {
      el.style.left = `${width / 2 + (x - 0.5) * WORLD_W * pxPerWorld}px`;
      el.style.top = `${height / 2 - (y - 0.5) * WORLD_H * pxPerWorld}px`;
    });
    labels.forEach(({ el, city }) => {
      el.style.left = `${width / 2 + city.pos.x * pxPerWorld}px`;
      el.style.top = `${height / 2 - city.pos.y * pxPerWorld}px`;
      el.style.setProperty('--petal', `${FLOWER_SIZE * PETAL_REACH * pxPerWorld}px`);
    });
  };

  let active = -1;
  const setActive = (next: number) => {
    if (next === active) return;
    labels[active]?.el.classList.remove('is-active');
    labels[next]?.el.classList.add('is-active');
    canvas.style.cursor = next < 0 ? '' : 'pointer';
    active = next;
  };

  const setPointer = (event: PointerEvent) => {
    const rect = canvas.getBoundingClientRect();
    pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    pointer.y = -(((event.clientY - rect.top) / rect.height) * 2 - 1);
    raycaster.setFromCamera(pointer, camera);
    raycaster.ray.intersectPlane(plane, hit);
    let nearest = -1;
    let best = HOVER_RADIUS;
    cities.forEach((c, i) => {
      const d = c.pos.distanceTo(hit);
      if (d < best) {
        best = d;
        nearest = i;
      }
    });
    setActive(nearest);
  };

  const resize = new ResizeObserver(fit);
  resize.observe(root);
  canvas.addEventListener('pointermove', setPointer);
  canvas.addEventListener('pointerdown', setPointer);
  canvas.addEventListener('pointerleave', (event) => {
    if (event.pointerType !== 'touch') setActive(-1);
  });
  fit();
  root.parentElement?.scrollTo({ left: root.parentElement.scrollWidth });

  let frame = 0;
  let visible = true;
  const io = new IntersectionObserver((entries) => {
    visible = entries.some((e) => e.isIntersecting);
  }, { threshold: 0.05 });
  io.observe(root);

  const tick = () => {
    frame = requestAnimationFrame(tick);
    if (!visible) return;
    const t = (performance.now() - started) / 1000;

    flowers.forEach((f, i) => {
      if (!reduce) f.target = t > 0.25 + i * 0.06 ? 1 : 0;
      const goal = f.target * (i === active ? 1.3 : 1);
      f.bloom += (goal - f.bloom) * (reduce ? 1 : 0.085);
      const sway = reduce ? 0 : Math.sin(t * 1.15 + f.seed * 6.28) * 0.08;
      dummy.position.copy(f.pos);
      dummy.rotation.set(0, 0, (f.seed - 0.5) * 0.7 + sway);
      dummy.scale.setScalar(Math.max(f.bloom * FLOWER_SIZE, 0.001));
      dummy.updateMatrix();
      poppyMesh.setMatrixAt(i, dummy.matrix);
    });
    poppyMesh.instanceMatrix.needsUpdate = true;
    renderer.render(scene, camera);
  };

  tick();

  return () => {
    cancelAnimationFrame(frame);
    resize.disconnect();
    io.disconnect();
    renderer.dispose();
    poppyTex.dispose();
    dotGeo.dispose();
    dotMat.dispose();
    poppyGeo.dispose();
    poppyMat.dispose();
  };
}
