export {};
type Consent = { analytics: boolean; marketing: boolean; time: number };
type AnalyticsWindow = Window & { dataLayer?: unknown[]; gtag?: (...args: unknown[]) => void; fbq?: ((...args: unknown[]) => void) & { queue?: unknown[][]; loaded?: boolean; version?: string; push?: unknown; callMethod?: (...args: unknown[]) => void } };
const win = window as AnalyticsWindow;
const $ = <T extends HTMLElement>(selector: string) => document.querySelector<T>(selector);
const header = $('.nav');
const menu = $('#menu-btn');
const links = $('#navlinks');
function closeMenu() { links?.classList.remove('open'); menu?.setAttribute('aria-expanded', 'false'); if (menu) menu.textContent = '☰'; }
menu?.addEventListener('click', () => { const open = links?.classList.toggle('open'); menu.setAttribute('aria-expanded', String(open)); menu.textContent = open ? '✕' : '☰'; });
links?.querySelectorAll('a').forEach(a => a.addEventListener('click', closeMenu));
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeMenu(); });
const onScroll = () => header?.classList.toggle('scrolled', window.scrollY > 24);
onScroll(); window.addEventListener('scroll', onScroll, { passive: true });
const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
if (!motion.matches && 'IntersectionObserver' in window) {
 const observer = new IntersectionObserver(entries => entries.forEach(entry => { if (entry.isIntersecting) { entry.target.classList.add('visible'); observer.unobserve(entry.target); } }), { threshold: .08 });
 document.querySelectorAll('.section-top, .honor, .album, .release-feature, .story-copy, .video, .listen-inner, .contact h2, .ensemble-copy, .concert, .press-feature, .news-list, .newsletter').forEach(el => { el.classList.add('reveal'); observer.observe(el); });
 motion.addEventListener('change', () => { if (motion.matches) { document.querySelectorAll('.reveal').forEach(el => el.classList.add('visible')); observer.disconnect(); } });
}
const video = $<HTMLDialogElement>('#video-modal');
const container = $('#video-container');
let currentVideo = ''; let videoTrigger: HTMLElement | null = null;
const validVideos = new Set(['HbRmwVkSP8Q', 'otT5_7vJYv4', 'pG7lJPLcO-g', 'NrGZajhOGAc', 'U1QDrRtdnAI', 'Ept9wg2IlDo']);
document.querySelectorAll<HTMLElement>('[data-video]').forEach(button => button.addEventListener('click', () => {
 const id = button.dataset.video ?? ''; if (!validVideos.has(id) || !video) return;
 currentVideo = id; videoTrigger = button;
 const title = button.dataset.title ?? (id === 'HbRmwVkSP8Q' ? 'Sombras Nada Más' : 'Esclavo y Amo');
 const heading = $('#video-title'); if (heading) heading.textContent = title;
 const fallback = $<HTMLAnchorElement>('#video-fallback'); if (fallback) fallback.href = `https://www.youtube.com/watch?v=${id}`;
 $('.video-consent')?.removeAttribute('hidden');
 video.showModal(); document.body.style.overflow = 'hidden';
}));
$('#load-video')?.addEventListener('click', () => {
 if (!validVideos.has(currentVideo) || !container) return;
 const iframe = document.createElement('iframe'); iframe.title = $('#video-title')?.textContent ?? 'Nathalie Peña-Comas';
 iframe.src = `https://www.youtube-nocookie.com/embed/${currentVideo}?autoplay=1&rel=0`;
 iframe.allow = 'autoplay; encrypted-media; picture-in-picture; fullscreen'; iframe.allowFullscreen = true; iframe.referrerPolicy = 'strict-origin-when-cross-origin';
 container.replaceChildren(iframe); $('.video-consent')?.setAttribute('hidden', '');
} );
video?.addEventListener('close', () => { container?.replaceChildren(); document.body.style.overflow = ''; videoTrigger?.focus(); });
$('[data-close-video]')?.addEventListener('click', () => video?.close());
video?.addEventListener('click', e => { if (e.target === video) video.close(); });
const consentDialog = $<HTMLDialogElement>('#consent-modal');
const analyticsBox = $<HTMLInputElement>('#consent-analytics'); const marketingBox = $<HTMLInputElement>('#consent-marketing');
const consentKey = 'npc-consent-v1'; const maxAge = 180 * 86400000;
function readConsent(): Consent | null { try { const value = JSON.parse(localStorage.getItem(consentKey) ?? 'null'); return value && typeof value.analytics === 'boolean' && typeof value.marketing === 'boolean' && typeof value.time === 'number' && Date.now() - value.time < maxAge ? value : null; } catch { return null; } }
let consent = readConsent();
const ga = document.body.dataset.ga ?? ''; const pixel = document.body.dataset.pixel ?? '';
const configured = /^G-[A-Z0-9]+$/.test(ga) || /^\d+$/.test(pixel);
function addScript(src: string) { const script = document.createElement('script'); script.src = src; script.async = true; document.head.append(script); }
function activate() {
 if (consent?.analytics && /^G-[A-Z0-9]+$/.test(ga) && !win.gtag) {
  win.dataLayer = []; win.gtag = (...args) => win.dataLayer!.push(args);
  win.gtag('consent', 'default', { analytics_storage: 'granted', ad_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied' });
  win.gtag('js', new Date()); win.gtag('config', ga, { send_page_view: true }); addScript(`https://www.googletagmanager.com/gtag/js?id=${ga}`);
 }
 if (consent?.marketing && /^\d+$/.test(pixel) && !win.fbq) {
  const fbq: NonNullable<AnalyticsWindow['fbq']> = (...args) => { if (fbq.callMethod) fbq.callMethod(...args); else fbq.queue!.push(args); };
  fbq.queue = []; fbq.push = fbq; fbq.loaded = true; fbq.version = '2.0'; win.fbq = fbq;
  fbq('consent', 'grant'); fbq('init', pixel); fbq('track', 'PageView'); addScript('https://connect.facebook.net/en_US/fbevents.js');
 }
}
activate();
function showPreferences() { if (analyticsBox) analyticsBox.checked = consent?.analytics ?? false; if (marketingBox) marketingBox.checked = consent?.marketing ?? false; consentDialog?.showModal(); }
document.querySelectorAll('[data-preferences]').forEach(button => button.addEventListener('click', showPreferences));
$('[data-close-consent]')?.addEventListener('click', () => consentDialog?.close());
if (configured && !consent) showPreferences();
document.querySelectorAll<HTMLElement>('[data-consent]').forEach(button => button.addEventListener('click', () => {
 const mode = button.dataset.consent;
 const previous = consent;
 consent = { analytics: mode === 'accept' || (mode === 'save' && !!analyticsBox?.checked), marketing: mode === 'accept' || (mode === 'save' && !!marketingBox?.checked), time: Date.now() };
 try { localStorage.setItem(consentKey, JSON.stringify(consent)); } catch { /* Storage may be blocked; this session still respects the choice. */ }
 consentDialog?.close();
 if ((previous?.analytics && !consent.analytics) || (previous?.marketing && !consent.marketing)) {
  win.gtag?.('consent', 'update', { analytics_storage: 'denied' }); win.fbq?.('consent', 'revoke');
  // Remove provider scripts and cookies by reloading into the saved denied state.
  for (const cookie of document.cookie.split(';')) { const name = cookie.split('=')[0].trim(); if (/^(_ga|_gid|_gat|_fbp|_fbc)/.test(name)) { const domains = [location.hostname, '.' + location.hostname, '.' + location.hostname.split('.').slice(-2).join('.')]; document.cookie = `${name}=; Max-Age=0; path=/`; domains.forEach(domain => { document.cookie = `${name}=; Max-Age=0; path=/; domain=${domain}`; }); } }
  location.reload(); return;
 }
 activate();
}));
document.addEventListener('click', e => {
 const anchor = (e.target as HTMLElement).closest<HTMLAnchorElement>('a[href]'); if (!anchor) return;
 const url = new URL(anchor.href);
 const providers: Record<string, string> = { 'open.spotify.com': 'Spotify', 'www.youtube.com': 'YouTube', 'youtu.be': 'YouTube', 'music.apple.com': 'Apple Music' };
 const platform = providers[url.hostname]; if (!platform) return;
 const event = { platform, destination: url.href, language: document.body.dataset.lang, section: anchor.closest('section')?.id ?? 'footer' };
 if (consent?.analytics) win.gtag?.('event', 'music_platform_click', event);
 if (consent?.marketing) win.fbq?.('trackCustom', 'MusicPlatformClick', event);
});
// Keep keyboard navigation inside the active dialogue, including reverse Tab.
document.addEventListener('keydown', event => {
 if (event.key !== 'Tab') return;
 const dialog = document.querySelector<HTMLDialogElement>('dialog[open]'); if (!dialog) return;
 const focusable = [...dialog.querySelectorAll<HTMLElement>('button:not([disabled]), a[href], input:not([disabled]), iframe, [tabindex="0"]')].filter(el => el.getClientRects().length > 0);
 const first = focusable[0], last = focusable.at(-1); if (!first || !last) return;
 if (event.shiftKey && (document.activeElement === first || !dialog.contains(document.activeElement))) { event.preventDefault(); last.focus(); }
 else if (!event.shiftKey && (document.activeElement === last || !dialog.contains(document.activeElement))) { event.preventDefault(); first.focus(); }
});

// Small compositor-only drift, active solely while the hero is in view.
const heroPhoto = document.querySelector<HTMLElement>('.hero-photo');
let heroInView = true, framePending = false;
if (heroPhoto && !document.querySelector('.signature-hero') && 'IntersectionObserver' in window) {
 const heroObserver = new IntersectionObserver(entries => { heroInView = entries[0].isIntersecting; });
 heroObserver.observe(heroPhoto);
 window.addEventListener('scroll', () => {
  if (motion.matches || !heroInView || framePending) return;
  framePending = true; requestAnimationFrame(() => { heroPhoto.style.transform = `translateY(${Math.min(window.scrollY * .07, 55)}px) scale(1.02)`; framePending = false; });
 }, { passive: true });
 motion.addEventListener('change', () => { if (motion.matches) heroPhoto.style.transform = ''; });
}

// Keep each language link on the section the visitor is currently reading.
if (document.getElementById('home')) {
 const destinations = [...document.querySelectorAll<HTMLElement>('main section[id], main #press, main #music-films, footer #contact')];
 const languageLinks = [...document.querySelectorAll<HTMLAnchorElement>('.language-switch a[lang]')];
 function currentSection() {
  if (window.scrollY + window.innerHeight >= document.documentElement.scrollHeight - 4) return 'contact';
  const edge = (header?.getBoundingClientRect().height ?? 104) + 48;
  return destinations.filter(el => el.getBoundingClientRect().top <= edge).sort((a,b) => a.getBoundingClientRect().top - b.getBoundingClientRect().top).at(-1)?.id ?? 'home';
 }
 function updateSectionLinks() {
  const id = currentSection();
  const navId = ({voice:'about',music:'media',collection:'media','music-films':'media',newsletter:'contact'} as Record<string,string>)[id] ?? id;
  languageLinks.forEach(link => { link.href = `/${link.lang}/#${id}`; });
  links?.querySelectorAll<HTMLAnchorElement>('a').forEach(link => {
   if (link.hash === `#${navId}`) link.setAttribute('aria-current','location');
   else link.removeAttribute('aria-current');
  });
 }
 let sectionFrame = false;
 window.addEventListener('scroll', () => {
  if (sectionFrame) return;
  sectionFrame = true;
  requestAnimationFrame(() => { updateSectionLinks(); sectionFrame = false; });
 }, {passive:true});
 window.addEventListener('hashchange', updateSectionLinks);
 window.addEventListener('resize', updateSectionLinks);
 languageLinks.forEach(link => link.addEventListener('click', updateSectionLinks));
 updateSectionLinks();
}
