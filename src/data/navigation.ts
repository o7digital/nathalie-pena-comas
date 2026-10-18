import type { Universe } from './universes';
import type { Locale } from './translations';
export const navigation = [
  { id: 'home', en: 'Home', es: 'Inicio' },
  { id: 'about', en: 'About', es: 'La artista' },
  { id: 'schedule', en: 'Schedule', es: 'Agenda' },
  { id: 'news', en: 'News', es: 'Noticias' },
  { id: 'press', en: 'Press', es: 'Prensa' },
  { id: 'media', en: 'Media', es: 'Videos' },
  { id: 'spirituosi', en: 'Spirituosi', es: 'Spirituosi' },
  { id: 'gallery', en: 'Gallery', es: 'Galería' },
  { id: 'contact', en: 'Contact', es: 'Contacto' },
] as const;
// Secondary utility pages return to the same localized homepage section.
export const sectionHref = (id: string, lang: Locale, isHome = true, universe: Universe = 'classical') => isHome ? `#${id}` : `/${lang}/${universe}/#${id}`;
