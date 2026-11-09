import type { ImageMetadata } from 'astro';
import { mkdir, writeFile, rm } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { assertTranslationsReady } from '../../cms/studio/translations.mjs';

export type CmsImage = { src: string; width: number; height: number; cms: true };
export type ContentImage = ImageMetadata | CmsImage;
type File = { id: string; width: number | null; height: number | null; type: string };
export type CmsRecord = {
 id: string; status: string; sort: number; title: string; detail?: string;
 image?: File; credit?: string; url?: string; youtube_id?: string; category?: string;
 date?: string; ensemble?: string; venue?: string; city?: string; ticket_status?: string;
 key?: string; locale?: string; value?: string;
 source_hash?: string; auto_translated?: boolean; translated_at?: string;
};

const url = (import.meta.env.DIRECTUS_URL || process.env.DIRECTUS_URL || '').replace(/\/$/, '');
const token = import.meta.env.DIRECTUS_READ_TOKEN || process.env.DIRECTUS_READ_TOKEN;
const requests = new Map<string, Promise<CmsRecord[] | null>>();
const assets = new Map<string, Promise<string>>();
let imageQueue: Promise<unknown> = Promise.resolve();
const assetDirectory = resolve('public/_cms');
const cleanAssets = rm(assetDirectory, { recursive: true, force: true });

export function readContent(collection: string): Promise<CmsRecord[] | null> {
 if (!url) return Promise.resolve(null);
 if (!requests.has(collection)) requests.set(collection, fetchContent(collection));
 return requests.get(collection)!;
}

async function fetchContent(collection: string): Promise<CmsRecord[]> {
 if (!token) throw new Error('DIRECTUS_READ_TOKEN is required when DIRECTUS_URL is configured.');
 const endpoint = new URL(`${url}/items/${collection}`);
 endpoint.search = new URLSearchParams({ filter: JSON.stringify({ status: { _eq: 'published' } }), fields: '*,image.id,image.width,image.height,image.type', sort: 'sort,id', limit: '-1' }).toString();
 // Text and event collections do not have an image relationship.
 if (collection === 'site_texts' || collection === 'concerts') endpoint.searchParams.set('fields', '*');
 const response = await fetch(endpoint, { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(20000) });
 if (!response.ok) throw new Error(`Directus ${collection}: HTTP ${response.status}. Build stopped; keep the previous deployment.`);
 const result = await response.json();
 if (!Array.isArray(result.data)) throw new Error(`Invalid Directus response for ${collection}.`);
 await Promise.all(result.data.filter((row: CmsRecord) => row.image).map((row: CmsRecord) => mirrorImage(row.image!)));
 return result.data;
}

function mirrorImage(file: File): Promise<string> {
 if (!/^[a-f\d-]{36}$/i.test(file.id) || !/^image\/(jpeg|png|webp|avif)$/.test(file.type)) throw new Error('Only JPEG, PNG, WebP and AVIF content images are supported.');
 if (!assets.has(file.id)) {
 const download = imageQueue.then(async () => {
  await cleanAssets;
  let response: Response | undefined;
  for (let attempt = 0; attempt < 4; attempt++) {
   response = await fetch(`${url}/assets/${file.id}?width=2560&withoutEnlargement=true&format=webp&quality=90`, { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(60000) });
   if (![429,503].includes(response.status) || attempt === 3) break;
   await response.arrayBuffer(); await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1)));
  }
  if (!response) throw new Error('CMS image request did not complete.');
  if (!response.ok || !response.headers.get('content-type')?.startsWith('image/')) throw new Error(`Could not download CMS image ${file.id}: ${response.status}`);
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (bytes.byteLength > 32 * 1024 * 1024) throw new Error('CMS image exceeds the build image limit.');
  const hash = createHash('sha256').update(bytes).digest('hex').slice(0,16);
  const filename = `${file.id}-${hash}.webp`;
  await mkdir(assetDirectory, { recursive: true }); await writeFile(resolve(assetDirectory, filename), bytes);
  const src = `/_cms/${filename}`; mirroredImages.set(file.id, src); return src;
 });
 assets.set(file.id, download); imageQueue = download.catch(() => undefined);
 }
 return assets.get(file.id)!;
}

export function contentImage(file: File | undefined): CmsImage {
 if (!file || !/^[a-f\d-]{36}$/i.test(file.id) || !file.type?.startsWith('image/')) throw new Error('A published item needs an image file.');
 // All published images were downloaded before readContent resolves.
 const src = mirroredImages.get(file.id);
 if (!src) throw new Error('CMS image has not been mirrored.');
 return { src, width: file.width || 1280, height: file.height || 960, cms: true };
}

const mirroredImages = new Map<string, string>();

export function externalLink(value: string | undefined): string {
 if (!value || !/^https:\/\//i.test(value)) throw new Error('Content links must use HTTPS.');
 const parsed = new URL(value);
 if (parsed.username || parsed.password) throw new Error('Content links must not contain credentials.');
 return parsed.href;
}

export const textOverrides = await readContent('site_texts');
if(textOverrides?.some(row=>row.source_hash)) {
 const content: Record<string,CmsRecord[]>={};
 for(const collection of ['gallery','albums','videos','concerts'])content[collection]=(await readContent(collection))||[];
 assertTranslationsReady(textOverrides,content);
}
export function textOverride(key: string, locale: string): string | undefined {
 return textOverrides?.find(row => row.key === key && row.locale === locale)?.value;
}

export function localizedRecord(collection: string,id: string,field: string,locale: string,fallback: string): string {
 if(locale==='es')return fallback;
 return textOverride(`content:${collection}:${id}:${field}`,locale)??fallback;
}

export async function sectionImage(key: string, fallback: ImageMetadata): Promise<ContentImage> {
 const rows = await readContent('site_images');
 const row = rows?.find(row => row.key === key);
 return row ? contentImage(row.image) : fallback;
}

export function inlineHtml(value: string): string {
 return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/&lt;(\/?(?:em|strong)|br\s*\/?)&gt;/gi, '<$1>');
}
