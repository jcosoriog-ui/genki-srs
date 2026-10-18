"""Añade meaning_es a data/vocabulary.json y data/kanji.json desde data/es/*.tsv (traducciones al español)."""
import json, glob, csv, os, re
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
def load(pat):
    d = {}
    for f in sorted(glob.glob(f'{ROOT}/data/es/{pat}')):
        for l in open(f):
            if l.strip():
                i, t = l.rstrip('\n').split('\t'); d[int(i)] = t
    return d
ves, kes = load('vocab_es_*.tsv'), load('kanji_es.tsv')
ces = {}
for l in open(f'{ROOT}/data/es/compounds_en_es.tsv'):
    en, es = l.rstrip('\n').split('\t'); ces[en] = es
v = json.load(open(f'{ROOT}/data/vocabulary.json')); k = json.load(open(f'{ROOT}/data/kanji.json'))
for x in v:
    if x['kanji'] == '交通系':
        x['kanji'] = '交通系ICカード'; x['meaning_en'] = 'rechargeable card such as Suica, Icoca, Pasmo, etc.'
    x['meaning_es'] = ves[x['id']]
vm = {x['meaning_en']: x['meaning_es'] for x in v}
for x in k:
    x['meaning_es'] = kes[x['number']]
    for c in x['compounds']:
        c['meaning_es'] = ces.get(c['meaning']) or vm[c['meaning']]
json.dump(v, open(f'{ROOT}/data/vocabulary.json', 'w'), ensure_ascii=False, indent=1)
json.dump(k, open(f'{ROOT}/data/kanji.json', 'w'), ensure_ascii=False, indent=1)
with open(f'{ROOT}/data/vocabulary.csv', 'w', newline='') as f:
    w = csv.DictWriter(f, fieldnames=list(v[0].keys())); w.writeheader(); w.writerows(v)
with open(f'{ROOT}/data/kanji.csv', 'w', newline='') as f:
    rows = [dict(x, on_yomi=' '.join(x['on_yomi']), kun_yomi=' '.join(x['kun_yomi']),
                 compounds=' ／ '.join(f"{c['word']}（{c['reading']}）{c['meaning_es']}" for c in x['compounds'])) for x in k]
    w = csv.DictWriter(f, fieldnames=list(rows[0].keys())); w.writeheader(); w.writerows(rows)
print('merged', len(v), len(k))
