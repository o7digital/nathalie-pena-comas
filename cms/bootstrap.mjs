// Run with the Directus dev service variables, never with a production token.
import { readFile } from 'node:fs/promises';
import { resolve, dirname, relative } from 'node:path';
import { randomBytes, createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import ts from 'typescript';
import { request } from 'node:https';
import deployment from './deployment.json' with { type: 'json' };

const base = process.env.DIRECTUS_URL || process.env.PUBLIC_URL;
const token = process.env.ADMIN_TOKEN;
if (base !== deployment.url || !token) throw new Error('Use the Nathalie dev Directus URL and ADMIN_TOKEN.');
async function api(path, method = 'GET', body) {
 const headers = { Authorization: `Bearer ${token}` };
 let bytes;
 if (body instanceof FormData) {
  const encoded = new Response(body); headers['Content-Type'] = encoded.headers.get('content-type'); bytes = Buffer.from(await encoded.arrayBuffer());
 } else if (body !== undefined) { headers['Content-Type'] = 'application/json'; bytes = Buffer.from(JSON.stringify(body)); }
 if (bytes) headers['Content-Length'] = bytes.length;
 const response = await new Promise((resolve, reject) => {
  const req = request(`${base}${path}`, { method, headers }, res => {
   const chunks = []; res.on('data', chunk => chunks.push(chunk));
   res.on('end', () => resolve({ status: res.statusCode, body: Buffer.concat(chunks).toString() }));
   res.on('error', reject);
  });
  req.setTimeout(60000, () => req.destroy(new Error('Directus request timed out'))); req.on('error', reject); req.end(bytes);
 });
 const result = JSON.parse(response.body);
 if (response.status >= 400) throw new Error(`${method} ${path}: ${response.status} ${JSON.stringify(result.errors)}`);
 return result.data;
}
const stableId = value => {
 const hex = createHash('sha256').update(`nathalie:${value}`).digest('hex');
 return `${hex.slice(0,8)}-${hex.slice(8,12)}-4${hex.slice(13,16)}-a${hex.slice(17,20)}-${hex.slice(20,32)}`;
};
const folderId = stableId('public-media');
const folders = await api('/folders?limit=-1');
if (!folders.some(folder => folder.id === folderId)) await api('/folders', 'POST', { id: folderId, name: 'Medios públicos del sitio' });

function field(name, type = 'string', options = {}) {
 return { field: name, type, schema: { is_nullable: true, ...(type === 'string' ? { max_length: 2000 } : {}), ...options.schema }, meta: { interface: type === 'text' ? 'input-multiline' : type === 'integer' ? 'input' : 'input', width: 'full', ...options.meta } };
}
const status = field('status', 'string', { schema: { default_value: 'draft' }, meta: { interface: 'select-dropdown', width: 'half', options: { choices: [{ text: 'Borrador', value: 'draft' }, { text: 'Publicado', value: 'published' }, { text: 'Archivado', value: 'archived' }] } } });
const image = field('image', 'uuid', { meta: { interface: 'file-image', special: ['file'], options: { folder: folderId }, required: true } });
const definitions = {
 gallery: { label: 'Fotografías', icon: 'photo_library', fields: [field('title'), image, field('credit')] },
 albums: { label: 'Álbumes', icon: 'album', fields: [field('title'), image, field('detail'), field('url'), field('category', 'string', { meta: { interface: 'select-dropdown', options: { choices: [{ text: 'Clásico', value: 'classical' }, { text: 'Contemporáneo', value: 'contemporary' }] } } })] },
 videos: { label: 'Videos', icon: 'movie', fields: [field('title'), image, field('detail'), field('youtube_id'), field('category', 'string', { meta: { interface: 'select-dropdown', options: { choices: [{ text: 'Ópera', value: 'opera' }, { text: 'Video musical', value: 'film' }] } } })] },
 concerts: { label: 'Conciertos', icon: 'event', fields: [field('title'), field('date', 'date', { meta: { interface: 'datetime' } }), field('ensemble'), field('venue'), field('city')] },
 site_images: { label: 'Imágenes de las secciones', icon: 'wallpaper', fields: [field('title'), field('key'), image] },
 site_texts: { label: 'Textos y traducciones', icon: 'translate', fields: [field('key'), field('locale', 'string', { meta: { interface: 'select-dropdown', options: { choices: ['es','en','de','fr','it','sv','hu','hr','ru','zh-TW','ja'].map(value => ({ text: value, value })) } } }), field('value', 'text')] },
};
const existing = await api('/collections');
for (const [name, definition] of Object.entries(definitions)) {
 if (existing.some(collection => collection.collection === name)) {
  const fields = await api(`/fields/${name}`);
  for (const item of definition.fields) if (!fields.some(field => field.field === item.field)) await api(`/fields/${name}`, 'POST', item);
  continue;
 }
 await api('/collections', 'POST', {
  collection: name, schema: {}, meta: { icon: definition.icon, display_template: name === 'site_texts' ? '{{locale}} · {{key}}' : '{{title}}', sort_field: 'sort', archive_field: 'status', archive_value: 'archived', unarchive_value: 'draft', translations: [{ language: 'es-ES', translation: definition.label }] },
  fields: [field('id', 'string', { schema: { is_primary_key: true, is_nullable: false, max_length: 200 }, meta: { hidden: true } }), status, field('sort', 'integer', { schema: { default_value: 0 }, meta: { width: 'half' } }), ...definition.fields],
 });
 if (definition.fields.some(item => item.field === 'image')) await api('/relations', 'POST', { collection: name, field: 'image', related_collection: 'directus_files', schema: { on_delete: 'SET NULL' } });
 console.log('Created collection', name);
}

const uploaded = new Map();
async function upload(path) {
 if (uploaded.has(path)) return uploaded.get(path);
 const id = stableId(relative(process.cwd(), path));
 const found = await api(`/files?filter[id][_eq]=${id}&fields=id,filesize,width,height`);
 const bytes = await readFile(path);
 if (!found.length || Number(found[0].filesize) !== bytes.length || !found[0].width || !found[0].height) {
  const form = new FormData(); form.set('id', id); form.set('folder', folderId);
  form.set('title', path.split('/').pop());
  form.set('file', new Blob([bytes], { type: /\.png$/i.test(path) ? 'image/png' : 'image/jpeg' }), path.split('/').pop());
  await api(found.length ? `/files/${id}` : '/files', found.length ? 'PATCH' : 'POST', form);
 }
 uploaded.set(path, id); return id;
}
async function source(file) {
 let text = await readFile(file, 'utf8');
 if (file.endsWith('.astro')) text = text.split('---')[1];
 const ast = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true);
 const imports = new Map();
 for (const node of ast.statements) if (ts.isImportDeclaration(node) && node.importClause?.name && /\.(jpg|jpeg|png)$/.test(node.moduleSpecifier.text)) imports.set(node.importClause.name.text, resolve(dirname(file), node.moduleSpecifier.text));
 async function value(node) {
  if (ts.isAsExpression(node)) return value(node.expression);
  if (ts.isStringLiteralLike(node)) return node.text;
  if (ts.isNumericLiteral(node)) return Number(node.text);
  if (ts.isIdentifier(node) && imports.has(node.text)) return upload(imports.get(node.text));
  if (ts.isArrayLiteralExpression(node)) return Promise.all(node.elements.map(value));
  if (ts.isObjectLiteralExpression(node)) return Object.fromEntries(await Promise.all(node.properties.map(async property => [property.name.getText(ast).replace(/^['"]|['"]$/g, ''), await value(property.initializer)])));
  if (ts.isCallExpression(node) && node.expression.getText(ast) === 'l') return value(node.arguments[1] || node.arguments[0]);
  throw new Error(`Unsupported content value in ${file}: ${node.getText(ast)}`);
 }
 return { ast, value };
}
async function variable(file, name) {
 const { ast, value } = await source(file);
 for (const statement of ast.statements) if (ts.isVariableStatement(statement)) for (const declaration of statement.declarationList.declarations) if (declaration.name.getText(ast) === name) return value(declaration.initializer);
 throw new Error(`Missing ${name} in ${file}`);
}
async function insertMissing(collection, rows) {
 const current = new Set((await api(`/items/${collection}?fields=id&limit=-1`)).map(row => row.id));
 const missing = rows.filter(row => !current.has(row.id));
 for (let offset = 0; offset < missing.length; offset += 100) await api(`/items/${collection}`, 'POST', missing.slice(offset, offset + 100));
 console.log(collection, rows.length, 'seed entries;', missing.length, 'added');
}
const published = (row, sort, id) => ({ id, status: 'published', sort, ...row });
const albums = await variable('src/data/albums.ts', 'localAlbums');
await insertMissing('albums', albums.map((row, i) => published({ ...row, category: [1,3].includes(i) ? 'classical' : 'contemporary' }, i, `album-${i+1}`)));
const gallery = await variable('src/components/Gallery.astro', 'localPhotos');
await insertMissing('gallery', gallery.map(({ src, ...row }, i) => published({ ...row, image: src }, i, `photo-${i+1}`)));
const opera = await variable('src/components/Videos.astro', 'localOpera');
const films = await variable('src/components/Videos.astro', 'localFilms');
await insertMissing('videos', [...opera.map(row => ({ ...row, category: 'opera' })), ...films.map(row => ({ ...row, category: 'film' }))].map(({ id, ...row }, i) => published({ ...row, youtube_id: id }, i, `video-${id}`)));
const concerts = await variable('src/data/schedule.ts', 'localSchedule');
await insertMissing('concerts', concerts.map((row, i) => published(row, i, `concert-${row.date}`)));
const images = [ ['hero','Retrato principal','src/assets/official/hero.jpg'], ['story','Biografía','src/assets/official/editorial.jpg'], ['spirituosi','Ensemble Spirituosi','src/assets/official/spirituosi.jpg'], ['press','Prensa','src/assets/official/press-oh.jpeg'] ];
await insertMissing('site_images', await Promise.all(images.map(async ([key,title,path], i) => published({ key, title, image: await upload(resolve(path)) }, i, key))));

const localized = JSON.parse(await readFile('src/data/localized.json', 'utf8'));
const original = await variable('src/data/translations.ts', 'originalTranslations');
const texts = new Map();
function addText(key, locale, value) {
 if (typeof value !== 'string') return;
 const id = stableId(`${locale}:${key}`); texts.set(id, published({ key, locale, value }, texts.size, id));
}
for (const [key, english] of Object.entries(original.en)) {
 addText(`translation:${key}`, 'en', english); addText(`translation:${key}`, 'es', original.es[key]);
 for (const [locale, dictionary] of Object.entries(localized)) addText(`translation:${key}`, locale, dictionary[english] ?? english);
}
// Extract the existing bilingual calls without evaluating component code.
for await (const file of (await import('node:fs/promises')).glob('src/{components,layouts}/**/*.astro')) {
 const text = await readFile(file, 'utf8');
 const calls = /\bl\(\s*("(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*')\s*(?:,\s*("(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*')\s*)?\)/g;
 const literal = text => { const scanner = ts.createScanner(ts.ScriptTarget.Latest, true, ts.LanguageVariant.Standard, text); scanner.scan(); return scanner.getTokenValue(); };
 for (const match of text.matchAll(calls)) {
  const spanish = literal(match[1]), english = match[2] ? literal(match[2]) : spanish;
  addText(`copy:${english}`, 'en', english); addText(`copy:${english}`, 'es', spanish);
  for (const [locale, dictionary] of Object.entries(localized)) addText(`copy:${english}`, locale, dictionary[english] ?? english);
 }
}
await insertMissing('site_texts', [...texts.values()]);
await api('/settings', 'PATCH', { project_name: 'Nathalie Peña-Comas · Contenido', project_color: '#BFA274', default_language: 'es-ES' });

// Only the build identity can read content and assets; images are mirrored to Vercel at build time.
const policies = await api('/policies?limit=-1');
let reader = policies.find(policy => policy.name === 'Website build');
if (!reader) reader = await api('/policies', 'POST', { name: 'Website build', icon: 'public', admin_access: false, app_access: false });
const permissions = await api('/permissions?limit=-1');
async function permission(policy, collection, filter, fields = ['*']) {
 if (!permissions.some(row => row.policy === policy && row.collection === collection && row.action === 'read')) await api('/permissions', 'POST', { policy, collection, action: 'read', permissions: filter, fields });
}
// Core supports collection-level read access. Publication filtering happens in the
// server-only build loader; there is no anonymous content or asset access.
for (const collection of Object.keys(definitions)) await permission(reader.id, collection, {});
await permission(reader.id, 'directus_files', {});
const roles = await api('/roles?limit=-1');
let role = roles.find(item => item.name === 'Website build');
if (!role) role = await api('/roles', 'POST', { name: 'Website build', icon: 'public', policies: [{ policy: reader.id }] });
const users = await api('/users?filter[first_name][_eq]=Website%20build&limit=-1');
let readToken = process.env.WEBSITE_READ_TOKEN;
if (!users.length) {
 readToken = randomBytes(32).toString('hex');
 await api('/users', 'POST', { first_name: 'Website build', role: role.id, status: 'active', token: readToken });
} else if (!readToken) throw new Error('Build identity exists; recover WEBSITE_READ_TOKEN from Railway before rerunning.');
const save = spawnSync('railway', ['variable','set','WEBSITE_READ_TOKEN','--stdin','--service','directus','--environment','dev','--skip-deploys','--json'], { input: readToken, encoding: 'utf8' });
if (save.status !== 0) throw new Error('Could not store the build token in Railway.');
console.log('CMS seeded. Build token stored in the Railway dev service. No secrets printed.');

const hook = process.env.VERCEL_PREVIEW_DEPLOY_HOOK;
if (hook) {
 const flows = await api('/flows?limit=-1');
 if (!flows.some(flow => flow.name === 'Actualizar vista previa')) {
  const flow = await api('/flows', 'POST', { name: 'Actualizar vista previa', icon: 'publish', status: 'active', trigger: 'manual', accountability: 'all', options: { collections: Object.keys(definitions), location: 'both', requireSelection: false, requireConfirmation: true, confirmationDescription: 'Actualizar la vista previa con el contenido publicado. El sitio público no cambia.', async: true } });
  const operation = await api('/operations', 'POST', { flow: flow.id, key: 'refresh_preview', name: 'Actualizar vista previa', type: 'request', position_x: 20, position_y: 1, options: { method: 'POST', url: hook, headers: [] } });
  await api(`/flows/${flow.id}`, 'PATCH', { operation: operation.id });
  console.log('Created manual preview publishing flow, restricted to the Vercel dev branch.');
 }
}
