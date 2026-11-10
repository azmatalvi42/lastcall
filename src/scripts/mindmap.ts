import { lastcallHub, saleStyles, sellerHub, type MapItem, type SaleStyleMap } from '../config/mindmap';

type Tone = 'style' | 'seller' | 'lastcall' | 'goal';
type MapNode = { id: string; el: HTMLElement; button: HTMLButtonElement; x: number; y: number; moved: boolean };
type Edge = { from: string; to: string; tone: Tone; tier: number; base: SVGPathElement; flow: SVGPathElement };

const SVG_NS = 'http://www.w3.org/2000/svg';
const WIDE_FROM_PX = 820;
const DRAG_THRESHOLD_PX = 4;
const TIER_DELAY_S = [0, 0.3, 0.72];

const GOAL_ID = 'goal';
const SELLER_ID = 'hub-seller';
const LASTCALL_ID = 'hub-lastcall';

type Layout = { wide: boolean; at: (id: string) => [number, number] };

/**
 * Wide screens flow left to right across a full-screen stage: sale styles, the two hubs (you on top,
 * Lastcall below), their details in a zig-zag pair of columns, then the goal. Narrow screens flow top to
 * bottom with the details in two columns. Positions are shares of the stage.
 */
function makeLayout(wide: boolean, style: SaleStyleMap): Layout {
  const spots = new Map<string, [number, number]>();
  const sellers = style.seller.map((_, i) => `seller-${i}`);
  const lastcalls = style.lastcall.map((_, i) => `lastcall-${i}`);

  if (wide) {
    saleStyles.forEach((s, i) => spots.set(`style-${s.id}`, [0.07, 0.5 + (i - 2) * 0.19]));
    const place = (ids: string[], centre: number) => {
      ids.forEach((id, i) => spots.set(id, [i % 2 === 0 ? 0.46 : 0.65, centre + (i - (ids.length - 1) / 2) * 0.11]));
    };
    spots.set(SELLER_ID, [0.27, 0.26]);
    spots.set(LASTCALL_ID, [0.27, 0.74]);
    place(sellers, 0.26);
    place(lastcalls, 0.74);
    spots.set(GOAL_ID, [0.87, 0.5]);
  } else {
    const row = [[0.18, 0.05], [0.5, 0.05], [0.82, 0.05], [0.34, 0.135], [0.66, 0.135]];
    saleStyles.forEach((s, i) => spots.set(`style-${s.id}`, row[i] as [number, number]));
    spots.set(SELLER_ID, [0.27, 0.265]);
    spots.set(LASTCALL_ID, [0.73, 0.265]);
    spots.set(GOAL_ID, [0.5, 0.885]);
    const rows = Math.max(sellers.length, lastcalls.length);
    const place = (ids: string[], x: number) => {
      const start = 0.385 + ((rows - ids.length) * 0.118) / 2;
      ids.forEach((id, i) => spots.set(id, [x + (i % 2 === 0 ? -0.03 : 0.03), start + i * 0.118]));
    };
    place(sellers, 0.27);
    place(lastcalls, 0.73);
  }
  return { wide, at: (id) => spots.get(id) ?? [0.5, 0.5] };
}

export function mountMindMap(root: HTMLElement) {
  const stage = root.querySelector<HTMLElement>('[data-mm-stage]');
  const edgeLayer = root.querySelector<SVGSVGElement>('[data-mm-edges]');
  const nodeLayer = root.querySelector<HTMLElement>('[data-mm-nodes]');
  const detail = root.querySelector<HTMLElement>('[data-mm-detail]');
  const reset = root.querySelector<HTMLButtonElement>('[data-mm-reset]');
  if (!stage || !edgeLayer || !nodeLayer || !detail || !reset) return;

  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const nodes = new Map<string, MapNode>();
  let edges: Edge[] = [];
  let style = saleStyles[0];
  let layout = makeLayout(stage.clientWidth >= WIDE_FROM_PX, style);
  let picked = '';
  let traced: string | null = null;

  const placeNode = (node: MapNode) => {
    node.el.style.left = `${node.x * 100}%`;
    node.el.style.top = `${node.y * 100}%`;
  };

  const drawEdge = (edge: Edge) => {
    const from = nodes.get(edge.from);
    const to = nodes.get(edge.to);
    if (!from || !to) return;
    const w = stage.clientWidth;
    const h = stage.clientHeight;
    const ax = from.x * w;
    const ay = from.y * h;
    const bx = to.x * w;
    const by = to.y * h;
    const mx = (bx - ax) / 2;
    const my = (by - ay) / 2;
    const d = layout.wide
      ? `M${ax} ${ay}C${ax + mx} ${ay} ${bx - mx} ${by} ${bx} ${by}`
      : `M${ax} ${ay}C${ax} ${ay + my} ${bx} ${by - my} ${bx} ${by}`;
    edge.base.setAttribute('d', d);
    edge.flow.setAttribute('d', d);
  };

  const drawEdges = () => {
    edgeLayer.setAttribute('viewBox', `0 0 ${stage.clientWidth} ${stage.clientHeight}`);
    edges.forEach(drawEdge);
  };

  const showDetail = (tag: string, tone: Tone, item: { label: string; detail: string }) => {
    detail.dataset.tone = tone;
    detail.replaceChildren();
    const tagEl = document.createElement('p');
    tagEl.className = 'mm-detail-tag';
    tagEl.textContent = tag;
    const title = document.createElement('p');
    title.className = 'mm-detail-title';
    title.textContent = item.label;
    const body = document.createElement('p');
    body.className = 'mm-detail-body';
    body.textContent = item.detail;
    const cta = document.createElement('a');
    cta.className = 'mm-detail-cta';
    cta.href = '#walkthrough';
    cta.textContent = style.cta;
    detail.append(tagEl, title, body, cta);
  };

  const pick = (id: string) => {
    nodes.get(picked)?.el.classList.remove('is-picked');
    nodes.get(id)?.el.classList.add('is-picked');
    picked = id;
  };

  /** Lights a node's whole route, from the sale style through to the goal. */
  const trace = (requested: string | null) => {
    traced = requested;
    /* A style that is not selected has no route yet, so there is nothing to single out. */
    const id = edges.some((edge) => edge.from === requested || edge.to === requested) ? requested : null;
    stage.classList.toggle('is-tracing', id !== null);
    const lit = new Set<string>(id ? [id] : []);
    const walk = (start: string, forward: boolean) => {
      edges.forEach((edge) => {
        const here = forward ? edge.from : edge.to;
        const next = forward ? edge.to : edge.from;
        if (here === start && !lit.has(`${edge.from}>${edge.to}`)) {
          lit.add(`${edge.from}>${edge.to}`);
          lit.add(next);
          walk(next, forward);
        }
      });
    };
    if (id) {
      walk(id, true);
      walk(id, false);
    }
    nodes.forEach((node, nodeId) => node.el.classList.toggle('is-lit', lit.has(nodeId)));
    edges.forEach((edge) => {
      const on = lit.has(`${edge.from}>${edge.to}`);
      edge.base.classList.toggle('is-lit', on);
      edge.flow.classList.toggle('is-lit', on);
    });
  };

  const makeNode = (id: string, tone: Tone, kind: string, label: string, onPick: () => void, eyebrow?: string) => {
    const el = document.createElement('div');
    el.className = `mm-node mm-${kind}`;
    el.dataset.tone = tone;
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'mm-oct';
    if (eyebrow) {
      const small = document.createElement('small');
      small.textContent = eyebrow;
      button.append(small);
    }
    const text = document.createElement('span');
    text.textContent = label;
    button.append(text);
    el.append(button);
    nodeLayer.append(el);

    const [x, y] = layout.at(id);
    const node: MapNode = { id, el, button, x, y, moved: false };
    nodes.set(id, node);
    placeNode(node);

    let dragged = false;
    button.addEventListener('click', () => {
      if (dragged) {
        dragged = false;
        return;
      }
      onPick();
    });
    el.addEventListener('pointerenter', () => trace(id));
    el.addEventListener('pointerleave', () => trace(null));
    button.addEventListener('focus', () => trace(id));
    button.addEventListener('blur', () => trace(null));

    /* Dragging is for mouse and pen. On touch, a press has to stay free to scroll the page. */
    button.addEventListener('pointerdown', (down) => {
      if (down.pointerType === 'touch' || down.button !== 0) return;
      const startX = down.clientX;
      const startY = down.clientY;
      const baseX = node.x;
      const baseY = node.y;
      let moving = false;
      dragged = false;
      const onMove = (move: PointerEvent) => {
        const dx = move.clientX - startX;
        const dy = move.clientY - startY;
        if (!moving && Math.hypot(dx, dy) < DRAG_THRESHOLD_PX) return;
        if (!moving) {
          moving = true;
          dragged = true;
          button.setPointerCapture(move.pointerId);
          el.classList.add('is-dragging');
          stage.classList.add('is-settled');
        }
        const w = stage.clientWidth;
        const h = stage.clientHeight;
        const marginX = el.offsetWidth / 2 / w;
        const marginY = el.offsetHeight / 2 / h;
        node.x = Math.min(1 - marginX, Math.max(marginX, baseX + dx / w));
        node.y = Math.min(1 - marginY, Math.max(marginY, baseY + dy / h));
        node.moved = true;
        placeNode(node);
        edges.forEach((edge) => {
          if (edge.from === id || edge.to === id) drawEdge(edge);
        });
        reset.hidden = false;
      };
      const onUp = () => {
        el.classList.remove('is-dragging');
        button.removeEventListener('pointermove', onMove);
        button.removeEventListener('pointerup', onUp);
        button.removeEventListener('pointercancel', onUp);
      };
      button.addEventListener('pointermove', onMove);
      button.addEventListener('pointerup', onUp);
      button.addEventListener('pointercancel', onUp);
    });
    return node;
  };

  const addEdge = (from: string, to: string, tone: Tone, tier: number) => {
    const make = (className: string) => {
      const path = document.createElementNS(SVG_NS, 'path');
      path.setAttribute('class', className);
      path.setAttribute('pathLength', '100');
      path.dataset.tone = tone;
      path.style.setProperty('--delay', `${TIER_DELAY_S[tier]}s`);
      edgeLayer.append(path);
      return path;
    };
    edges.push({ from, to, tone, tier, base: make('mm-edge'), flow: make('mm-flow') });
  };

  /** Replays the build: lines reach out from the sale style, then all meet at the goal. */
  const play = () => {
    if (reduce) return;
    stage.classList.remove('is-running', 'is-settled');
    void stage.offsetWidth;
    stage.classList.add('is-running');
  };

  const leafId = (tone: 'seller' | 'lastcall', i: number) => `${tone}-${i}`;

  const buildRoutes = () => {
    edges.forEach((edge) => {
      edge.base.remove();
      edge.flow.remove();
    });
    edges = [];
    nodes.forEach((node, id) => {
      if (id.startsWith('seller-') || id.startsWith('lastcall-')) {
        node.el.remove();
        nodes.delete(id);
      }
    });

    const leaf = (tone: 'seller' | 'lastcall', hub: string, tag: string) => (item: MapItem, i: number) => {
      const id = leafId(tone, i);
      const node = makeNode(id, tone, 'leaf', item.label, () => {
        pick(id);
        showDetail(tag, tone, item);
      });
      node.el.style.setProperty('--order', String(i));
      addEdge(hub, id, tone, 1);
      addEdge(id, GOAL_ID, tone, 2);
    };

    addEdge(`style-${style.id}`, SELLER_ID, 'seller', 0);
    addEdge(`style-${style.id}`, LASTCALL_ID, 'lastcall', 0);
    style.seller.forEach(leaf('seller', SELLER_ID, 'You bring'));
    style.lastcall.forEach(leaf('lastcall', LASTCALL_ID, 'Lastcall brings'));
    drawEdges();
  };

  const updateGoal = () => {
    const goal = nodes.get(GOAL_ID);
    const text = goal?.button.querySelector('span');
    if (text) text.textContent = style.goal.label;
  };

  const selectStyle = (next: SaleStyleMap) => {
    style = next;
    layout = makeLayout(layout.wide, style);
    saleStyles.forEach((s) => {
      const node = nodes.get(`style-${s.id}`);
      const on = s.id === next.id;
      node?.el.classList.toggle('is-on', on);
      node?.button.setAttribute('aria-pressed', String(on));
    });
    updateGoal();
    buildRoutes();
    trace(traced);
    pick(`style-${next.id}`);
    showDetail('Style of sale', 'style', { label: next.label, detail: next.summary });
    play();
  };

  saleStyles.forEach((s) => {
    makeNode(`style-${s.id}`, 'style', 'style', s.label, () => selectStyle(s));
  });
  makeNode(SELLER_ID, 'seller', 'hub', sellerHub.label, () => {
    pick(SELLER_ID);
    showDetail('You bring', 'seller', sellerHub);
  });
  makeNode(LASTCALL_ID, 'lastcall', 'hub', lastcallHub.label, () => {
    pick(LASTCALL_ID);
    showDetail('Lastcall brings', 'lastcall', lastcallHub);
  });
  makeNode(GOAL_ID, 'goal', 'goal', style.goal.label, () => {
    pick(GOAL_ID);
    showDetail('Our shared goal', 'goal', style.goal);
  }, 'Our shared goal');

  const applyLayout = (keepMoved: boolean) => {
    nodes.forEach((node, id) => {
      if (keepMoved && node.moved) return;
      [node.x, node.y] = layout.at(id);
      node.moved = false;
      placeNode(node);
    });
    drawEdges();
  };

  reset.addEventListener('click', () => {
    reset.hidden = true;
    applyLayout(false);
  });

  const fit = () => {
    const wide = stage.clientWidth >= WIDE_FROM_PX;
    if (wide !== layout.wide) {
      layout = makeLayout(wide, style);
      stage.dataset.layout = wide ? 'wide' : 'narrow';
      root.dataset.layout = stage.dataset.layout;
      reset.hidden = true;
      applyLayout(false);
      return;
    }
    drawEdges();
  };

  stage.dataset.layout = layout.wide ? 'wide' : 'narrow';
  root.dataset.layout = stage.dataset.layout;
  new ResizeObserver(fit).observe(stage);

  selectStyle(style);
  stage.classList.remove('is-running');

  /* Waits to build until it is in view, so the opening animation is actually seen. */
  if (!reduce) {
    stage.classList.add('is-waiting');
    new IntersectionObserver((entries, observer) => {
      if (!entries.some((entry) => entry.isIntersecting)) return;
      observer.disconnect();
      stage.classList.remove('is-waiting');
      play();
    }, { threshold: 0.35 }).observe(stage);
  }
}
