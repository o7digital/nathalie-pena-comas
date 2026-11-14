"""Pure knowledge validation and complete factual context; no network or model calls."""
import hashlib
import json
from datetime import datetime
from types import SimpleNamespace

LANGUAGES={'es','en','de','fr','it','sv','hu','hr','ru','zh-TW','ja'}

def canonical(value):
    return json.dumps(value,ensure_ascii=False,sort_keys=True,separators=(',',':'))

def validate_manifest(manifest):
    if not isinstance(manifest,dict) or manifest.get('schemaVersion')!=1:
        raise ValueError('Unsupported knowledge schema')
    documents=manifest.get('documents')
    catalog=manifest.get('catalog')
    if not isinstance(documents,list) or not 1<=len(documents)<=1000 or not isinstance(catalog,dict):
        raise ValueError('Invalid knowledge documents')
    if not isinstance(catalog.get('calendar'),list) or not isinstance(catalog.get('repertoire'),dict):
        raise ValueError('Missing complete catalogues')
    for kind,field in [('opera','roles'),('concert','works')]:
        groups=catalog['repertoire'].get(kind)
        if not isinstance(groups,list) or any(not isinstance(group,dict) or not isinstance(group.get(field),list) for group in groups):
            raise ValueError('Invalid complete repertoire')
    if any(not isinstance(catalog.get(key),list) for key in ['languages','albums','recordings']):
        raise ValueError('Missing discography or languages')
    revision=hashlib.sha256(canonical({k:manifest[k] for k in ['schemaVersion','documents','catalog']}).encode()).hexdigest()
    if manifest.get('revision')!=revision:
        raise ValueError('Knowledge checksum mismatch')
    published=datetime.fromisoformat(manifest.get('publishedAt','').replace('Z','+00:00'))
    if published.tzinfo is None:
        raise ValueError('Knowledge publication must be timezone-aware')
    ids=set()
    for doc in documents:
        if not isinstance(doc,dict) or not isinstance(doc.get('id'),str) or not 1<=len(doc['id'])<=128 or doc['id'] in ids:
            raise ValueError('Invalid or duplicate knowledge ID')
        ids.add(doc['id'])
        if not isinstance(doc.get('content'),str) or not doc['content'].strip() or len(doc['content'])>200000:
            raise ValueError('Invalid knowledge text')
        if not isinstance(doc.get('title'),str) or len(doc['title'])>255:
            raise ValueError('Invalid document title')
        if not isinstance(doc.get('source'),str) or len(doc['source'])>500 or not doc['source'].startswith(tuple('/'+lang+'/' for lang in LANGUAGES)):
            raise ValueError('Knowledge must refer to this website')
        if not isinstance(doc.get('metadata'),dict) or doc['metadata'].get('locale') not in LANGUAGES:
            raise ValueError('Invalid knowledge language')
    if len(canonical(manifest).encode())>2500000:
        raise ValueError('Knowledge is too large')
    for event in catalog['calendar']:
        if not isinstance(event,dict) or not isinstance(event.get('date'),str) or not event.get('title') or not event.get('id') or event.get('kind') not in ['performance','recording_release']:
            raise ValueError('Invalid calendar entry')
        datetime.strptime(event.get('date',''),'%Y-%m-%d')
    return manifest

def publication(manifest):
    return datetime.fromisoformat(manifest['publishedAt'].replace('Z','+00:00'))

def statistics(manifest):
    catalog=manifest['catalog']
    return {'pages':len(catalog.get('languages',[]))*2,'documents':len(manifest['documents']),
            'calendarEvents':len(catalog['calendar']),
            'operaRoles':sum(len(g['roles']) for g in catalog['repertoire']['opera']),
            'concertWorks':sum(len(g['works']) for g in catalog['repertoire']['concert']),
            'albums':len(catalog['albums']),'recordings':len(catalog['recordings'])}

def factual_context(manifest,today,language):
    """Never rely on nearest-vector ranking to enumerate dates, works or recordings."""
    catalog=manifest['catalog']
    calendar=[f'Complete official calendar. Today in Mexico City: {today}. Every announced entry follows; do not confuse a recording release with a live performance.']
    for event in sorted(catalog['calendar'],key=lambda row:(row['date'],row['id'])):
        status='PAST' if event['date']<today else 'TODAY_OR_UPCOMING'
        fields={key:event.get(key,'') for key in ['id','date','kind','title','ensemble','venue','city','ticket_status','url']}
        calendar.append(status+' | '+canonical(fields))
    opera=['Complete CLASSICAL OPERA REPERTOIRE. These are repertoire roles, not scheduled bookings. A preparation marker means the role is being prepared, not a performed role.']
    for group in catalog['repertoire']['opera']:
        opera.append(canonical(group))
    concert=['Complete CLASSICAL CONCERT / ORATORIO / ART SONG REPERTOIRE. These works are not dates on the calendar.']
    for group in catalog['repertoire']['concert']:
        concert.append(canonical(group))
    recordings=['Complete discography: albums and recordings with their published categories, release dates and platform links.',canonical({'albums':catalog['albums'],'recordings':catalog['recordings']})]
    rows=[('schedule',calendar),('repertorio',opera),('repertorio',concert),('collection',recordings)]
    return [SimpleNamespace(kind='document',source=f'/{language}/#{section}',content='Source: '+f'/{language}/#{section}'+'\n'+'\n'.join(lines),metadata={'kind':'complete_catalogue','section':section}) for section,lines in rows]

def select_page_hits(hits,language,limit=10):
    """Prefer the visitor language, avoiding duplicate translations crowding context."""
    chosen={}
    for hit in hits:
        if hit.kind!='document' or hit.metadata.get('kind')!='page':
            continue
        section=hit.metadata.get('section','')
        locale=hit.metadata.get('locale','')
        priority=0 if locale==language else 1 if locale=='es' else 2 if locale=='en' else 3
        current=chosen.get(section)
        if current is None or priority<current[0]:
            chosen[section]=(priority,locale)
    selected=[]
    for hit in hits:
        if hit.kind!='document' or hit.metadata.get('kind')!='page':
            continue
        if hit.metadata.get('locale')!=chosen[hit.metadata.get('section','')][1]:
            continue
        selected.append(SimpleNamespace(kind='document',source=hit.source,content='Source: '+hit.source+'\n'+hit.content,metadata=hit.metadata))
        if len(selected)>=limit:break
    return selected
