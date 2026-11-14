"""Add the isolated preview prefix only, with nginx validation and rollback."""
from pathlib import Path
import shutil
import subprocess
import urllib.request
root=Path('/opt/o7/apps/nathalie-olivia36')
config=Path('/opt/o7/mailcow/data/conf/nginx/olivia-private-chat.conf')
assert urllib.request.urlopen('http://127.0.0.1:8138/health',timeout=5).status==200
original=config.read_text()
assert 'server_name olivia.o7digitalgroup.com;' in original
block=(root/'proxy-location.conf').read_text()
if 'location ^~ /nathalie-preview/' in original:
    start=original.index('    location ^~ /nathalie-preview/')
    opening=original.index('{',start)
    depth=1;end=opening+1
    while depth:
        if original[end]=='{':depth+=1
        elif original[end]=='}':depth-=1
        end+=1
    updated=original[:start]+block[block.index('    location ^~'):].rstrip()+original[end:]
else:
    updated=original.replace('    location / {',block+'    location / {',1)
    assert updated!=original
if updated!=original:
    backup=Path('/opt/o7/backups/nathalie-olivia36/olivia-private-chat.before.conf')
    backup.parent.mkdir(parents=True,exist_ok=True)
    if not backup.exists():shutil.copy2(config,backup)
    config.write_text(updated)
    result=subprocess.run(['docker','exec','mailcowdockerized-nginx-mailcow-1','nginx','-t'],capture_output=True,text=True)
    if result.returncode:
        config.write_text(original)
        raise SystemExit('nginx validation failed; original configuration restored')
    try:
        subprocess.run(['docker','exec','mailcowdockerized-nginx-mailcow-1','nginx','-s','reload'],check=True,capture_output=True)
    except Exception:
        config.write_text(original)
        raise
print('Dedicated Nath AI preview prefix installed; existing routes preserved.')
