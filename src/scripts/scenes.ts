/** One full-screen scene per scroll gesture. Tall scenes scroll inside until the edge. */
export function mountScenes() {
  const scenes = [...document.querySelectorAll<HTMLElement>('main > section, body > footer')];
  if (scenes.length < 2) return;

  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const root = document.documentElement;
  root.classList.add('scene-nav');
  scenes.forEach((scene) => scene.classList.add('scene'));

  let index = 0;
  let busy = false;
  const duration = reduce ? 0 : 680;

  const show = (next: number, instant = false) => {
    if (next < 0 || next >= scenes.length || next === index) return;
    const from = scenes[index];
    const to = scenes[next];
    const forward = next > index;
    busy = true;
    to.classList.remove('is-leaving-up', 'is-leaving-down');
    to.style.transition = 'none';
    to.style.transform = forward ? 'translateY(100%)' : 'translateY(-100%)';
    to.style.visibility = 'visible';
    to.getBoundingClientRect();
    to.style.transition = instant || reduce ? 'none' : '';
    to.style.transform = '';
    to.classList.add('is-current');
    from.classList.remove('is-current');
    from.classList.add(forward ? 'is-leaving-up' : 'is-leaving-down');
    if (!forward) to.scrollTop = to.scrollHeight;
    else to.scrollTop = 0;
    window.setTimeout(() => {
      from.classList.remove('is-leaving-up', 'is-leaving-down');
      from.style.visibility = '';
      to.style.transition = '';
      index = next;
      busy = false;
      const id = to.id;
      const nextHash = id ? `#${id}` : '';
      if (location.hash !== nextHash) history.replaceState(null, '', nextHash || location.pathname + location.search);
    }, instant || reduce ? 0 : duration);
  };

  scenes[0].classList.add('is-current');
  scenes[0].style.visibility = 'visible';

  const sceneIndex = (hash: string) => {
    const id = hash.replace('#', '');
    if (!id) return 0;
    const el = document.getElementById(id);
    if (!el) return -1;
    return scenes.findIndex((scene) => scene === el || scene.contains(el));
  };

  if (location.hash) {
    const start = sceneIndex(location.hash);
    if (start > 0) show(start, true);
  }

  const atEnd = (el: HTMLElement) => el.scrollTop + el.clientHeight >= el.scrollHeight - 4;
  const atStart = (el: HTMLElement) => el.scrollTop <= 4;

  const onWheel = (event: WheelEvent) => {
    if (busy) {
      event.preventDefault();
      return;
    }
    const current = scenes[index];
    if (Math.abs(event.deltaY) < 8) return;
    if (event.deltaY > 0) {
      if (!atEnd(current)) return;
      if (index >= scenes.length - 1) return;
      event.preventDefault();
      show(index + 1);
    } else {
      if (!atStart(current)) return;
      if (index <= 0) return;
      event.preventDefault();
      show(index - 1);
    }
  };
  window.addEventListener('wheel', onWheel, { passive: false });

  let touchY = 0;
  window.addEventListener('touchstart', (event) => {
    touchY = event.touches[0]?.clientY ?? 0;
  }, { passive: true });
  window.addEventListener('touchend', (event) => {
    if (busy) return;
    const y = event.changedTouches[0]?.clientY ?? touchY;
    const delta = touchY - y;
    if (Math.abs(delta) < 48) return;
    const current = scenes[index];
    if (delta > 0 && atEnd(current)) show(index + 1);
    if (delta < 0 && atStart(current)) show(index - 1);
  }, { passive: true });

  window.addEventListener('keydown', (event) => {
    if (event.key !== 'ArrowDown' && event.key !== 'PageDown' && event.key !== 'ArrowUp' && event.key !== 'PageUp' && event.key !== ' ') return;
    const tag = (event.target as HTMLElement | null)?.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
    if (event.key === ' ' && (tag === 'BUTTON' || tag === 'SUMMARY')) return;
    const current = scenes[index];
    if (event.key === 'ArrowDown' || event.key === 'PageDown' || (event.key === ' ' && !event.shiftKey)) {
      event.preventDefault();
      if (atEnd(current)) show(index + 1);
      else current.scrollBy({ top: current.clientHeight * 0.5, behavior: reduce ? 'auto' : 'smooth' });
    } else {
      event.preventDefault();
      if (atStart(current)) show(index - 1);
      else current.scrollBy({ top: -current.clientHeight * 0.5, behavior: reduce ? 'auto' : 'smooth' });
    }
  });

  document.addEventListener('click', (event) => {
    const link = (event.target as Element | null)?.closest('a[href^="#"]');
    if (!(link instanceof HTMLAnchorElement)) return;
    const next = sceneIndex(link.getAttribute('href') || '');
    if (next < 0) return;
    event.preventDefault();
    show(next);
    const id = (link.getAttribute('href') || '').slice(1);
    const target = id ? document.getElementById(id) : null;
    if (target && !scenes.includes(target)) {
      window.setTimeout(() => target.scrollIntoView({ block: 'start' }), duration);
    }
  });
}
