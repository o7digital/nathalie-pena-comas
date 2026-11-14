"""Build approved, complete site knowledge from the generated Spanish homepage."""
from html.parser import HTMLParser
from pathlib import Path
import json
import re

ROOT=Path(__file__).resolve().parents[2]
TARGETS={'about','schedule','repertorio','spirituosi','music','collection','contemporain','media','contact'}
class Extract(HTMLParser):
    def __init__(self):
        super().__init__();self.frames=[];self.active=None;self.skip=0;self.rows={}
    def handle_starttag(self,tag,attrs):
        attrs=dict(attrs)
        if tag in {'script','style'}:self.skip+=1
        if tag in {'section','footer'}:
            self.frames.append(self.active)
            if attrs.get('id') in TARGETS:
                self.active=attrs['id'];self.rows.setdefault(self.active,[])
        if self.active and tag in {'p','h2','h3','h4','li','div','dt','dd'}:self.rows[self.active].append('\n')
        if self.active and tag=='a' and attrs.get('href','').startswith(('https://','mailto:')):self.rows[self.active].append(' '+attrs['href']+' ')
        if self.active and tag=='time' and attrs.get('datetime'):self.rows[self.active].append(' Date: '+attrs['datetime']+' ')
    def handle_endtag(self,tag):
        if tag in {'script','style'}:self.skip=max(0,self.skip-1)
        if tag in {'section','footer'} and self.frames:self.active=self.frames.pop()
    def handle_data(self,data):
        if self.active and not self.skip:self.rows[self.active].append(data)
parser=Extract();parser.feed((ROOT/'dist/es/index.html').read_text())
documents=[{'title':f'Nathalie Peña-Comas — {name}','source':f'https://nathalie-pena-comas.vercel.app/es/#{name}','content':re.sub(r'[ \t]+',' ',''.join(parts)).strip()} for name,parts in parser.rows.items()]
assert {'about','schedule','repertorio','spirituosi'}<={r['source'].split('#')[1] for r in documents}
assert any('Bernd Kornherr' in r['content'] for r in documents)
output=Path(__file__).parent/'knowledge';output.mkdir(exist_ok=True)
(output/'documents.json').write_text(json.dumps(documents,ensure_ascii=False,indent=2)+'\n')
(output/'system.txt').write_text((Path(__file__).parent/'system.txt').read_text())
print(f'Nath AI knowledge: {len(documents)} complete website sections')
