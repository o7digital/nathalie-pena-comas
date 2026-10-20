const hero = document.querySelector<HTMLElement>('.signature-hero');
if (hero) {
 const slides = [...hero.querySelectorAll<HTMLElement>('[data-hero-slide]')];
 const controls = hero.querySelector<HTMLElement>('.hero-slider-controls');
 const buttons = [...hero.querySelectorAll<HTMLButtonElement>('[data-hero-select]')];
 const pause = hero.querySelector<HTMLButtonElement>('[data-hero-pause]');
 const motion = matchMedia('(prefers-reduced-motion: reduce)');
 let current = 0, paused = motion.matches;
 let timer: ReturnType<typeof setInterval> | undefined;
 const show = (index: number) => {
  current = index;
  slides.forEach((slide, i) => {
   slide.classList.toggle('is-active', i === current);
   slide.setAttribute('aria-hidden', String(i !== current));
   slide.inert = i !== current;
  });
  buttons.forEach((button, i) => button.setAttribute('aria-pressed', String(i === current)));
 };
 const schedule = () => {
  clearInterval(timer);
  if (!paused && !document.hidden && !hero.matches(':focus-within')) timer = setInterval(() => show((current + 1) % slides.length), 5000);
 };
 const setPaused = (value: boolean) => {
  paused = value;
  pause?.setAttribute('aria-pressed', String(paused));
  if (pause) {
   pause.textContent = paused ? '▶' : 'Ⅱ';
   pause.setAttribute('aria-label', (paused ? pause.dataset.resumeLabel : pause.dataset.pauseLabel) ?? '');
  }
  schedule();
 };
 buttons.forEach((button, i) => button.addEventListener('click', () => { show(i); schedule(); }));
 pause?.addEventListener('click', () => setPaused(!paused));
 hero.addEventListener('focusin', schedule);
 hero.addEventListener('focusout', () => requestAnimationFrame(schedule));
 document.addEventListener('visibilitychange', schedule);
 motion.addEventListener('change', () => setPaused(motion.matches));
 if (controls) controls.hidden = false;
 setPaused(paused);
}
