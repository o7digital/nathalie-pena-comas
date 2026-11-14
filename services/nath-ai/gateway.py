"""Nath AI preview gateway over the Olivia 3.6 core recovered from the VPS."""
import hashlib
import hmac
import json
import os
import threading
import time
import uuid
from datetime import datetime
from zoneinfo import ZoneInfo
from collections import defaultdict, deque
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, Header, HTTPException
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy import select, text
from .chat_engine import generate
from .db import engine, tenant_session
from .embeddings import get_provider
from .models import Audit, Conversation, Message
from . import knowledge_runtime as knowledge
from .knowledge_protocol import factual_context,select_page_hits
from .vector_store import PgVectorStore

TENANT='nathalie-dev'
LANGUAGES=r'^(es|en|de|fr|it|sv|hu|hr|ru|zh-TW|ja)$'
provider=get_provider()
store=PgVectorStore()
lock=threading.Lock()
limits=defaultdict(deque)
busy=set()


def seed():
    knowledge.initialize()
    knowledge.apply(json.loads(Path('/app/knowledge/manifest.json').read_text()),provider)
    with engine.begin() as connection:
        connection.execute(text("CREATE TABLE IF NOT EXISTS website_threads (id TEXT PRIMARY KEY, status TEXT NOT NULL DEFAULT 'ai')"))
        connection.execute(text("CREATE TABLE IF NOT EXISTS website_visitor_messages (id TEXT PRIMARY KEY, thread_id TEXT NOT NULL, content TEXT NOT NULL, language TEXT NOT NULL)"))
        connection.execute(text("CREATE TABLE IF NOT EXISTS website_operator_messages (id TEXT PRIMARY KEY, thread_id TEXT NOT NULL, content TEXT NOT NULL)"))


@asynccontextmanager
async def lifespan(app):
    seed()
    yield


app=FastAPI(title='Nath AI — Olivia 3.6',version='3.6.0',lifespan=lifespan,docs_url=None,redoc_url=None,openapi_url=None)


class Body(BaseModel):
    model_config=ConfigDict(extra='forbid')
    conversation_id:str=Field(pattern=r'^[a-f0-9]{48}$')
    session_id:str=Field(pattern=r'^[a-f0-9]{32}$')
    client_hash:str=Field(pattern=r'^[a-f0-9]{64}$')
    # This is the website/interface locale, not a forced response language.
    language:str=Field(default='es',pattern=LANGUAGES)
    consent:bool


class Chat(Body):
    message:str=Field(min_length=1,max_length=4000)


class Stored(Body):
    content:str=Field(min_length=1,max_length=4000)
    model:str|None=None


def authorize(authorization):
    expected=os.getenv('NATH_AI_GATEWAY_KEY','')
    if not expected or not hmac.compare_digest(authorization or '', 'Bearer '+expected):
        raise HTTPException(401,'Authentication required')


def thread_status(identifier):
    with engine.connect() as connection:
        return connection.execute(text('SELECT status FROM website_threads WHERE id=:id'),{'id':identifier}).scalar() or 'ai'


def reserve(body):
    now=time.monotonic()
    with lock:
        for key in list(limits):
            while limits[key] and limits[key][0]<now-60:
                limits[key].popleft()
            if not limits[key]:
                del limits[key]
        for key,cap in [('global',60),('session:'+body.session_id,12),('ip:'+body.client_hash,24)]:
            if len(limits[key])>=cap:
                raise HTTPException(429,'Please wait before sending another message')
        if body.conversation_id in busy or len(busy)>=3:
            raise HTTPException(429,'A reply is already being prepared')
        for key in ['global','session:'+body.session_id,'ip:'+body.client_hash]:
            limits[key].append(now)
        busy.add(body.conversation_id)


@app.get('/health')
def health():
    with engine.connect() as connection:
        connection.execute(text('SELECT 1'))
    return {'status':'ok','site':TENANT,'version':'3.6.0','provider_configured':bool(os.getenv('OPENAI_API_KEY')),'response_language_policy':'visitor-message',**knowledge.status()}


@app.get('/knowledge/status')
def knowledge_status(authorization:str|None=Header(None)):
    authorize(authorization)
    return knowledge.status()


@app.post('/knowledge/sync')
def knowledge_sync(manifest:dict,authorization:str|None=Header(None)):
    authorize(authorization)
    try:
        return knowledge.apply(manifest,provider)
    except ValueError:
        raise HTTPException(400,'Invalid published knowledge')


@app.get('/conversations/{identifier}')
def conversations(identifier:str,authorization:str|None=Header(None)):
    authorize(authorization)
    if len(identifier)!=48 or any(x not in '0123456789abcdef' for x in identifier):
        raise HTTPException(400,'Invalid conversation')
    with engine.connect() as connection:
        operators=[{'id':r.id,'role':'operator','content':r.content} for r in connection.execute(text('SELECT id, content FROM website_operator_messages WHERE thread_id=:id'),{'id':identifier})]
    return {'configured':True,'status':thread_status(identifier),'messages':operators}


@app.post('/conversations')
def register(body:Stored,authorization:str|None=Header(None)):
    authorize(authorization)
    if not body.consent:
        raise HTTPException(400,'Consent required')
    with engine.begin() as connection:
        connection.execute(text('INSERT INTO website_threads (id) VALUES (:id) ON CONFLICT (id) DO NOTHING'),{'id':body.conversation_id})
        connection.execute(text('INSERT INTO website_visitor_messages (id,thread_id,content,language) VALUES (:id,:thread,:content,:language)'),{'id':str(uuid.uuid4()),'thread':body.conversation_id,'content':body.content,'language':body.language})
    return {'conversation':{'status':thread_status(body.conversation_id)}}


@app.patch('/conversations')
def persisted(body:Stored,authorization:str|None=Header(None)):
    authorize(authorization)
    if not body.consent:
        raise HTTPException(400,'Consent required')
    # /chat commits the authentic provider reply; never trust browser-supplied AI text.
    return {'stored':True,'status':thread_status(body.conversation_id)}


@app.post('/chat')
def chat(body:Chat,authorization:str|None=Header(None)):
    authorize(authorization)
    if not body.consent:
        raise HTTPException(400,'Consent required')
    if thread_status(body.conversation_id)=='manual':
        raise HTTPException(409,'The team has taken over')
    reserve(body)
    try:
        with tenant_session(TENANT) as db:
            history=list(db.scalars(select(Message).where(Message.tenant_id==TENANT,Message.conversation_id==body.conversation_id).order_by(Message.id.desc()).limit(12)))[::-1]
            manifest=knowledge.snapshot()
            today=datetime.now(ZoneInfo('America/Mexico_City')).date().isoformat()
            search=store.search(db,TENANT,provider.embed([body.message])[0],body.message,64,0.12)
            context=factual_context(manifest,today,body.language)+select_page_hits(search,body.language)
            prompt=(f'Today in Mexico City: {today}. Website interface locale (fallback only): {body.language}.\n'
                    'Reply in the language of the latest visitor message, independently of the interface and retrieved sources. '
                    'Honor an explicit request for a different response language. For a language-neutral message, '
                    'keep the language of the visitor’s most recent substantive message in the conversation; '
                    'use the interface locale only if there is no language evidence.\nVisitor message:\n'+body.message)
            answer,model,response_id,duration=generate('BALANCED',prompt,history,context,tenant=TENANT)
            if not db.get(Conversation,body.conversation_id):
                db.add(Conversation(id=body.conversation_id,tenant_id=TENANT));db.flush()
            db.add_all([Message(tenant_id=TENANT,conversation_id=body.conversation_id,role='user',content=body.message),Message(tenant_id=TENANT,conversation_id=body.conversation_id,role='assistant',content=answer)])
            db.add(Audit(tenant_id=TENANT,action='nath.chat',metadata_json=json.dumps({'model':model,'conversation_id':body.conversation_id,'provider_response_id':response_id,'duration_ms':duration})))
            db.commit()
        # Keep the UI-locale envelope compatible with deployed widgets; reply text follows the message.
        return {'clientCode':'nathalie','reply':answer,'language':body.language,'version':'3.6.0','mode':'olivia-v3.6','model':model,'sources':list(dict.fromkeys(hit.source for hit in context if hit.kind=='document')),'knowledge_revision':manifest['revision']}
    finally:
        with lock:
            busy.discard(body.conversation_id)
