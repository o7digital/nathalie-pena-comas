"""Run on the authorized VPS. Secrets stay in mode-0600 server files, never in output."""
import json
import os
from pathlib import Path
import secrets
import shutil
import subprocess

root=Path('/opt/o7/apps/nathalie-olivia36')
source=Path('/opt/o7/apps/vialterna3-olivia36/core')
assert (source/'REVISION').read_text().strip()=='3453702'
assert not (root/'core').exists() or (root/'core/REVISION').read_text().strip()=='3453702'
shutil.copytree(source,root/'core',dirs_exist_ok=True,ignore=shutil.ignore_patterns('._*','__pycache__'))
if not (root/'.env').exists():
    details=json.loads(subprocess.check_output(['docker','inspect','vialterna3-olivia36']))[0]
    env=dict(row.split('=',1) for row in details['Config']['Env'] if '=' in row)
    password=secrets.token_urlsafe(36)
    selected={key:value for key,value in env.items() if key in {'OPENAI_API_KEY','OPENAI_API_URL','OPENAI_MODEL_FAST','OPENAI_MODEL_BALANCED','OPENAI_MODEL_POWERFUL','EMBEDDING_PROVIDER','EMBEDDING_MODEL','EMBEDDING_DIMENSIONS'}}
    assert selected.get('OPENAI_API_KEY')
    selected.update({'DATABASE_URL':f'postgresql+psycopg://nathalie:{password}@postgres:5432/nathalie','NATH_AI_GATEWAY_KEY':secrets.token_hex(32),'LOCAL_LLM_ENABLED':'false','CHAT_TIMEOUT_SECONDS':'50','TZ':'America/Mexico_City'})
    for path,values in [(root/'.env',selected),(root/'.env.db',{'POSTGRES_USER':'nathalie','POSTGRES_PASSWORD':password,'POSTGRES_DB':'nathalie'})]:
        descriptor=os.open(path,os.O_WRONLY|os.O_CREAT|os.O_EXCL,0o600)
        with os.fdopen(descriptor,'w') as output:
            output.write('\n'.join(f'{key}={value}' for key,value in values.items())+'\n')
print('Recovered Olivia 3.6 revision 3453702; dedicated credentials configured.')
