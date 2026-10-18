import localized from './localized.json';
import type { Locale } from './translations';
export const locales = [
 { code:'es', name:'Español', og:'es_MX' }, { code:'en', name:'English', og:'en_US' },
 { code:'de', name:'Deutsch (AT / DE)', og:'de_DE' }, { code:'fr', name:'Français', og:'fr_FR' },
 { code:'it', name:'Italiano', og:'it_IT' }, { code:'sv', name:'Svenska', og:'sv_SE' },
 { code:'hu', name:'Magyar', og:'hu_HU' }, { code:'hr', name:'Hrvatski', og:'hr_HR' },
 { code:'ru', name:'Русский', og:'ru_RU' }, { code:'zh-TW', name:'繁體中文（台灣）', og:'zh_TW' },
 { code:'ja', name:'日本語', og:'ja_JP' },
] as const;
export function localizer(lang: Locale) {
 return (spanish: string, english: string = spanish): string => {
  if (lang === 'es') return spanish;
  if (lang === 'en') return english;
  const copy: Record<string,string> = localized[lang];
  return copy[english] ?? english;
 };
}
