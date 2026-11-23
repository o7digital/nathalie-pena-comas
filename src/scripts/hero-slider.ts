import { loadYouTubePlayer, type YouTubePlayer } from './youtube-player';
import { heroVideo } from '../data/hero-video';

const hero = document.querySelector<HTMLElement>('.signature-hero');
if (hero) {
 const slides = [...hero.querySelectorAll<HTMLElement>('[data-hero-slide]')];
 const controls = hero.querySelector<HTMLElement>('.hero-slider-controls');
 const buttons = [...hero.querySelectorAll<HTMLButtonElement>('[data-hero-select]')];
 const pause = hero.querySelector<HTMLButtonElement>('[data-hero-pause]');
 const replay = hero.querySelector<HTMLButtonElement>('[data-hero-replay]');
 const skip = hero.querySelector<HTMLButtonElement>('[data-hero-skip]');
 const sound = hero.querySelector<HTMLButtonElement>('[data-hero-sound]');
 const video = hero.querySelector<HTMLElement>('[data-hero-video]');
 const stage = hero.querySelector<HTMLElement>('[data-hero-player]');
 const motion = matchMedia('(prefers-reduced-motion: reduce)');
 const connection = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
 let current = 0, paused = motion.matches, intro = false, running = false, inView = true;
 let player: YouTubePlayer | undefined;
 let timer: ReturnType<typeof setInterval> | undefined;
 let watchdog: ReturnType<typeof setTimeout> | undefined;
 let remaining = 18000, generation = 0;
 let started: number | undefined;
 let muted = true, playerReady = false;
 const updateSound = () => {
  if (!sound) return;
  sound.hidden = !intro;
  sound.disabled = !playerReady;
  sound.setAttribute('aria-pressed', String(!muted));
  sound.textContent = (muted ? sound.dataset.enableLabel : sound.dataset.muteLabel) ?? '';
 };
 const blocked = () => document.hidden || !inView || !!document.querySelector('dialog[open]');
 const show = (index: number) => {
  current = index;
  slides.forEach((slide, i) => {
   const active = !intro && i === current;
   slide.classList.toggle('is-active', active);
   slide.setAttribute('aria-hidden', String(!active));
   slide.inert = !active;
  });
  video?.classList.toggle('is-active', intro);
  video?.setAttribute('aria-hidden', String(!intro));
  if (video) video.inert = !intro;
  hero.classList.toggle('is-video-intro', intro);
  if (intro) document.documentElement.dataset.heroIntro = 'true';
  else delete document.documentElement.dataset.heroIntro;
  replay?.setAttribute('aria-pressed', String(intro));
  buttons.forEach((button, i) => button.setAttribute('aria-pressed', String(!intro && i === current)));
  if (skip) skip.hidden = !intro;
  updateSound();
 };
 const schedule = () => {
  clearInterval(timer);
  timer = undefined;
  if (intro) {
   if (started !== undefined) remaining = Math.max(0, remaining - (performance.now() - started));
   started = undefined;
   if (paused || blocked()) {
    player?.pauseVideo();
   } else {
    player?.playVideo();
    if (running) {
     started = performance.now();
     timer = setTimeout(finishIntro, remaining);
    }
   }
  } else if (!paused && !blocked() && !hero.matches(':focus-within')) {
   timer = setInterval(() => show((current + 1) % slides.length), 5000);
  }
 };
 const finishIntro = () => {
  generation++;
  intro = running = false;
  clearTimeout(watchdog);
  clearInterval(timer);
  const oldPlayer = player;
  player = undefined;
  playerReady = false;
  oldPlayer?.pauseVideo();
  const oldFrame = stage?.querySelector('iframe');
  const focusPhotos = skip === document.activeElement || sound === document.activeElement;
  show(0);
  if (focusPhotos) buttons[0]?.focus({ preventScroll: true });
  // Fade to the portrait before removing the player to avoid a black flash.
  setTimeout(() => { oldPlayer?.destroy(); oldFrame?.remove(); }, motion.matches ? 0 : 850);
  schedule();
 };
 const startIntro = async () => {
  if (intro || !stage) return;
  intro = true;
  running = false;
  muted = true;
  playerReady = false;
  remaining = 18000;
  started = undefined;
  const attempt = ++generation;
  clearInterval(timer);
  // Reserve the full-screen film immediately, including while YouTube loads.
  show(0);
  watchdog = setTimeout(finishIntro, 8000);
  try {
   const api = await loadYouTubePlayer();
   if (!intro || generation !== attempt) return;
   const frame = document.createElement('iframe');
   frame.title = 'Nathalie Peña-Comas — ' + heroVideo.title;
   const url = new URL('https://www.youtube-nocookie.com/embed/' + heroVideo.id);
   url.search = new URLSearchParams({ autoplay:'1', mute:'1', playsinline:'1', start:String(heroVideo.startSeconds), controls:'0', disablekb:'1', enablejsapi:'1', rel:'0', origin:location.origin }).toString();
   frame.src = url.href;
   frame.allow = 'autoplay; encrypted-media; fullscreen';
   frame.referrerPolicy = 'strict-origin-when-cross-origin';
   frame.tabIndex = -1;
   stage.append(frame);
   player = new api.Player(frame, { events: {
    onReady: ({ target }) => {
     if (!intro || generation !== attempt) return;
     target.mute();
     playerReady = true;
     updateSound();
     if (!paused && !blocked()) target.playVideo();
     else target.pauseVideo();
    },
    onStateChange: ({ data }) => {
     if (!intro || generation !== attempt) return;
     if (data === 1) {
      clearTimeout(watchdog);
      running = true;
      show(0);
      schedule();
     } else if (data === 0) finishIntro();
     else if (data === 2 || data === 3) {
      clearTimeout(watchdog);
      running = false;
      if (started !== undefined) remaining = Math.max(0, remaining - (performance.now() - started));
      started = undefined;
      clearInterval(timer);
      if (data === 3 && !paused && !blocked()) watchdog = setTimeout(finishIntro, 8000);
     }
    },
    onError: () => { if (intro && generation === attempt) finishIntro(); },
    onAutoplayBlocked: () => { if (intro && generation === attempt) finishIntro(); },
   } });
  } catch { if (intro && generation === attempt) finishIntro(); }
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
 buttons.forEach((button, i) => button.addEventListener('click', () => { if (intro) finishIntro(); show(i); schedule(); }));
 pause?.addEventListener('click', () => setPaused(!paused));
 skip?.addEventListener('click', finishIntro);
 sound?.addEventListener('click', () => {
  if (!intro || !playerReady || !player) return;
  muted = !muted;
  if (muted) player.mute();
  else {
   player.unMute();
   if (!paused && !blocked()) player.playVideo();
  }
  updateSound();
 });
 replay?.addEventListener('click', () => { setPaused(false); void startIntro(); });
 hero.addEventListener('focusin', () => { if (!intro) schedule(); });
 hero.addEventListener('focusout', () => requestAnimationFrame(() => { if (!intro) schedule(); }));
 document.addEventListener('visibilitychange', schedule);
 new MutationObserver(schedule).observe(document.body, { subtree:true, attributes:true, attributeFilter:['open'] });
 if ('IntersectionObserver' in window) new IntersectionObserver(([entry]) => { inView = entry.isIntersecting; schedule(); }).observe(hero);
 motion.addEventListener('change', () => { if (motion.matches && intro) finishIntro(); setPaused(motion.matches); });
 if (controls) controls.hidden = false;
 setPaused(paused);
 if (!motion.matches && !connection?.saveData && (!location.hash || location.hash === '#home')) void startIntro();
 else show(0);
}
