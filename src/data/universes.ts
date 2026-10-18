import { translations, type Locale } from './translations';
import { locales } from './locales';
export type Universe = 'classical' | 'popular';
const primary = {
 es: { classical: 'Soprano clásica', popular: 'Canciones populares', classicalSub: 'Ópera y música clásica', popularSub: 'Otro universo de su voz', explore: 'Explorar', home: 'Inicio', shortClassical: 'Clásica', shortPopular: 'Popular', invitation: 'Una voz. Dos universos.', popularIntro: 'El corazón de la música latina', popularDesc: 'Sombras Nada Más, Esclavo y Amo y el proyecto Quinto Elemento: Tierra. Un encuentro con la emoción y las raíces latinas.', entryDescription: 'Explora los dos universos de Nathalie Peña-Comas: soprano clásica y canciones populares.' },
 en: { classical: 'Classical soprano', popular: 'Popular songs', classicalSub: 'Opera & classical music', popularSub: 'Another world in her voice', explore: 'Explore', home: 'Home', shortClassical: 'Classical', shortPopular: 'Popular', invitation: 'One voice. Two worlds.', popularIntro: 'The heart of Latin music', popularDesc: 'Sombras Nada Más, Esclavo y Amo and the project Quinto Elemento: Tierra. An encounter with emotion and Latin roots.', entryDescription: 'Explore the two worlds of Nathalie Peña-Comas: classical soprano and popular songs.' }
} as const;
export const universePath = (lang: Locale, universe?: Universe) => `/${lang}/${universe ? (universe === 'classical' ? 'classical/' : 'popular/') : ''}`;

type UniverseCopy = { -readonly [K in keyof typeof primary.en]: string };
const labels: Record<string, string[]> = {
 de: ['Klassischer Sopran','Populäre Lieder','Oper & klassische Musik','Eine andere Welt ihrer Stimme','Entdecken','Start','Klassik','Populär','Eine Stimme. Zwei Welten.','Das Herz der lateinamerikanischen Musik'],
 fr: ['Soprano classique','Chansons populaires','Opéra et musique classique','Un autre univers de sa voix','Explorer','Accueil','Classique','Populaire','Une voix. Deux univers.','Le cœur de la musique latine'],
 it: ['Soprano classico','Canzoni popolari','Opera e musica classica','Un altro universo della sua voce','Esplora','Home','Classica','Popolare','Una voce. Due universi.','Il cuore della musica latina'],
 sv: ['Klassisk sopran','Populära sånger','Opera och klassisk musik','En annan värld i hennes röst','Utforska','Hem','Klassiskt','Populärt','En röst. Två världar.','Den latinamerikanska musikens hjärta'],
 hu: ['Klasszikus szoprán','Népszerű dalok','Opera és klasszikus zene','Hangjának egy másik világa','Felfedezés','Kezdőlap','Klasszikus','Populáris','Egy hang. Két világ.','A latin zene szíve'],
 hr: ['Klasični sopran','Popularne pjesme','Opera i klasična glazba','Drugi svijet njezina glasa','Istraži','Početna','Klasika','Popularno','Jedan glas. Dva svijeta.','Srce latinoameričke glazbe'],
 ru: ['Классическое сопрано','Популярные песни','Опера и классическая музыка','Другая грань её голоса','Открыть','Главная','Классика','Популярное','Один голос. Два мира.','Сердце латиноамериканской музыки'],
 'zh-TW': ['古典女高音','流行歌曲','歌劇與古典音樂','她歌聲中的另一個世界','探索','首頁','古典','流行','一個聲音，兩個世界。','拉丁音樂的核心'],
 ja: ['クラシック・ソプラノ','ポピュラーソング','オペラとクラシック音楽','歌声が紡ぐもう一つの世界','探す','ホーム','クラシック','ポピュラー','一つの声、二つの世界。','ラテン音楽の心']
};
const keys = ['classical','popular','classicalSub','popularSub','explore','home','shortClassical','shortPopular','invitation','popularIntro'] as const;
export const universeCopy = Object.fromEntries(locales.map(({code}) => {
 if (code === 'es' || code === 'en') return [code, primary[code]];
 const copy: UniverseCopy = { ...primary.en, popularDesc: translations[code].heroDesc, entryDescription: translations[code].heroDesc };
 keys.forEach((key, index) => { copy[key] = labels[code][index]; });
 return [code, copy];
})) as Record<Locale, UniverseCopy>;
