import copy
import hashlib
import json
import sys
import unittest
from pathlib import Path
from types import SimpleNamespace

sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from knowledge_protocol import canonical,validate_manifest,statistics,factual_context,select_page_hits

MANIFEST=json.loads((Path(__file__).resolve().parents[1]/'knowledge/manifest.json').read_text())

def signed(value):
    value['revision']=hashlib.sha256(canonical({key:value[key] for key in ['schemaVersion','documents','catalog']}).encode()).hexdigest()
    return value

class KnowledgeTests(unittest.TestCase):
    def test_javascript_manifest_has_matching_python_checksum_and_full_counts(self):
        validate_manifest(MANIFEST)
        counts=statistics(MANIFEST)
        self.assertEqual(counts,MANIFEST['stats'])
        self.assertEqual([counts[key] for key in ['pages','calendarEvents','operaRoles','concertWorks','albums','recordings']],[22,26,18,40,4,2])

    def test_tampered_content_is_rejected(self):
        value=copy.deepcopy(MANIFEST);value['documents'][0]['content']='Altered'
        with self.assertRaisesRegex(ValueError,'checksum'):validate_manifest(value)

    def test_duplicate_ids_external_sources_and_invalid_dates_are_rejected(self):
        for mutate in [lambda m:m['documents'].append(m['documents'][0]),lambda m:m['documents'][0].update(source='https://other-client.example/'),lambda m:m['catalog']['calendar'][0].update(date='2027-02-31')]:
            value=copy.deepcopy(MANIFEST);mutate(value)
            with self.assertRaises(ValueError):validate_manifest(signed(value))

    def test_all_dates_are_supplied_regardless_of_vector_ranking(self):
        context=factual_context(MANIFEST,'2026-11-14','fr');calendar=context[0].content
        for event in MANIFEST['catalog']['calendar']:
            self.assertIn(event['date'],calendar);self.assertIn(event['title'],calendar)
        self.assertTrue(any(line.startswith('PAST | ') and '2026-03-15' in line for line in calendar.splitlines()))
        self.assertTrue(any(line.startswith('TODAY_OR_UPCOMING | ') and '2026-11-15' in line for line in calendar.splitlines()))
        self.assertIn('TODAY_OR_UPCOMING',calendar)
        self.assertEqual(calendar.count('"kind":"recording_release"'),2)
        self.assertIn('Source: /fr/#schedule',calendar)
        self.assertIn('"ticket_status":"free"',calendar);self.assertIn('"ticket_status":"soon"',calendar)

    def test_complete_roles_works_preparation_markers_and_listening_links_survive(self):
        context=factual_context(MANIFEST,'2026-11-14','es')
        for kind,index in [('opera',1),('concert',2)]:
            for group in MANIFEST['catalog']['repertoire'][kind]:self.assertIn(canonical(group),context[index].content)
        self.assertIn('preparation',context[1].content)
        for recording in MANIFEST['catalog']['recordings']:
            self.assertIn(recording['url'],context[3].content);self.assertIn(recording['date'],context[3].content)
        for album in MANIFEST['catalog']['albums']:self.assertIn(album['title'],context[3].content)

    def test_retrieval_prefers_visitor_language_and_excludes_conversations(self):
        def hit(locale,section='about',kind='document',category='page'):
            return SimpleNamespace(kind=kind,content=locale+' text',source='/'+locale+'/#'+section,metadata={'kind':category,'locale':locale,'section':section})
        selected=select_page_hits([hit('es'),hit('de'),hit('fr'),hit('en','news'),hit('es','news'),hit('fr','privacy',kind='memory'),hit('es','schedule',category='calendar_event')],'fr')
        self.assertEqual([h.source for h in selected],['/fr/#about','/es/#news'])
        self.assertTrue(all(h.content.startswith('Source: /') for h in selected))

if __name__=='__main__':unittest.main()
