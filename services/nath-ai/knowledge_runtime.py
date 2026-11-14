"""Authenticated, atomic published-site updates over the dedicated Olivia core."""
import hashlib
import json
import threading
from sqlalchemy import select,delete,text
from .db import engine,tenant_session
from .models import Document,DocumentChunk
from .knowledge_protocol import validate_manifest,publication,statistics,canonical

TENANT='nathalie-dev'
knowledge_lock=threading.RLock()
active=None


def initialize():
    global active
    with engine.begin() as connection:
        connection.execute(text('CREATE TABLE IF NOT EXISTS website_knowledge (id TEXT PRIMARY KEY, manifest_json TEXT NOT NULL)'))
        saved=connection.execute(text("SELECT manifest_json FROM website_knowledge WHERE id='current'")).scalar()
        active=json.loads(saved) if saved else None


def snapshot():
    with knowledge_lock:
        if active is None:raise RuntimeError('Published site knowledge is unavailable')
        return active


def status():
    manifest=snapshot()
    return {'revision':manifest['revision'],'publishedAt':manifest['publishedAt'],'stats':statistics(manifest),'version':'3.6.0'}


def save_state(manifest,db):
    db.execute(text("INSERT INTO website_knowledge (id,manifest_json) VALUES ('current',:body) ON CONFLICT (id) DO UPDATE SET manifest_json=excluded.manifest_json"),{'body':json.dumps(manifest,ensure_ascii=False,separators=(',',':'))})


def apply(manifest,provider):
    global active
    validate_manifest(manifest)
    with knowledge_lock:
        if active and publication(manifest)<publication(active):
            return {**status(),'superseded':True,'changed':False}
        if active and manifest['revision']==active['revision']:
            if publication(manifest)>publication(active):
                with tenant_session(TENANT) as db:save_state(manifest,db);db.commit()
                active=manifest
            return {**status(),'superseded':False,'changed':False}
        with tenant_session(TENANT) as db:
            existing={json.loads(row.metadata_json).get('knowledge_id','legacy:'+row.source):{'id':row.id,'hash':json.loads(row.metadata_json).get('revision')} for row in db.scalars(select(Document).where(Document.tenant_id==TENANT))}
        prepared=[];pending=[]
        for doc in manifest['documents']:
            digest=hashlib.sha256(canonical(doc).encode()).hexdigest()
            if existing.get(doc['id'],{}).get('hash')==digest:continue
            chunks=[doc['content'][i:i+1400] for i in range(0,len(doc['content']),1220)]
            prepared.append((doc,digest,chunks));pending.extend(chunks)
        vectors=[]
        for start in range(0,len(pending),64):
            result=provider.embed(pending[start:start+64])
            if len(result)!=len(pending[start:start+64]):raise RuntimeError('Incomplete knowledge embeddings')
            vectors.extend(result)
        wanted={doc['id'] for doc in manifest['documents']};changed={doc['id'] for doc,_,_ in prepared}
        with tenant_session(TENANT) as db:
            for identifier,previous in existing.items():
                if identifier not in wanted or identifier in changed:
                    db.execute(delete(DocumentChunk).where(DocumentChunk.tenant_id==TENANT,DocumentChunk.document_id==previous['id']))
                    db.execute(delete(Document).where(Document.tenant_id==TENANT,Document.id==previous['id']))
            position=0
            for doc,digest,chunks in prepared:
                metadata=json.dumps({**doc['metadata'],'knowledge_id':doc['id'],'revision':digest,'site':TENANT})
                row=Document(tenant_id=TENANT,title=doc['title'],content=doc['content'],source=doc['source'],metadata_json=metadata)
                db.add(row);db.flush()
                for index,chunk in enumerate(chunks):
                    db.add(DocumentChunk(tenant_id=TENANT,document_id=row.id,chunk_index=index,content=chunk,source=doc['source'],metadata_json=metadata,embedding=vectors[position]));position+=1
            save_state(manifest,db);db.commit()
        active=manifest
        return {**status(),'superseded':False,'changed':True}
