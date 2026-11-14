"""Run in the dedicated container: same/older builds and failed embedding preserve state."""
import copy
import hashlib
from datetime import timedelta
from sqlalchemy import text
from app import knowledge_runtime as knowledge
from app.knowledge_protocol import canonical,publication

class UnavailableProvider:
    def embed(self,rows):raise RuntimeError('Simulated provider outage')

knowledge.initialize()
original=copy.deepcopy(knowledge.snapshot())
before=knowledge.status()
def counts():
    with knowledge.engine.connect() as db:
        return tuple(db.execute(text('SELECT (SELECT count(*) FROM documents), (SELECT count(*) FROM document_chunks), (SELECT count(*) FROM messages)')).one())
unchanged_counts=counts()
assert knowledge.apply(original,UnavailableProvider())['changed'] is False
older=copy.deepcopy(original)
older['publishedAt']=(publication(original)-timedelta(days=1)).isoformat()
older['documents'][0]['content']+=' Simulated obsolete fact.'
older['revision']=hashlib.sha256(canonical({key:older[key] for key in ['schemaVersion','documents','catalog']}).encode()).hexdigest()
assert knowledge.apply(older,UnavailableProvider())['superseded'] is True
changed=copy.deepcopy(older)
changed['publishedAt']=(publication(original)+timedelta(seconds=1)).isoformat()
try:
    knowledge.apply(changed,UnavailableProvider())
    raise AssertionError('Provider failure was ignored')
except RuntimeError as error:
    assert str(error)=='Simulated provider outage'
assert knowledge.status()==before
assert counts()==unchanged_counts
print('Verified: unchanged builds skip embedding, old builds cannot overwrite facts, provider failure preserves knowledge and conversations.')
