/** Flips a square to show its answer and daubs it. Seeing every answer calls bingo. */
export function mountBingo(section: HTMLElement) {
  const squares = [...section.querySelectorAll<HTMLElement>('.bingo-square')];
  const status = section.querySelector('[data-bingo-status]');

  squares.forEach((square) => square.querySelector('.bingo-back')?.setAttribute('aria-hidden', 'true'));

  section.addEventListener('click', (event) => {
    const button = event.target instanceof Element ? event.target.closest('.bingo-flip') : null;
    const square = button?.closest<HTMLElement>('.bingo-square');
    if (!button || !square) return;
    const flipped = square.classList.toggle('is-flipped');
    button.setAttribute('aria-expanded', String(flipped));
    square.querySelector('.bingo-back')?.setAttribute('aria-hidden', String(!flipped));
    if (flipped) square.classList.add('is-seen');

    if (!section.classList.contains('is-bingo') && squares.every((item) => item.classList.contains('is-seen'))) {
      section.classList.add('is-bingo');
      if (status) status.textContent = 'Bingo! You have seen every answer.';
    }
  });
}
