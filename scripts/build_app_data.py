"""Genera docs/data.js (datos compactos para la app) a partir de data/*.json."""
import json, os
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
v = json.load(open(f'{ROOT}/data/vocabulary.json'))
k = json.load(open(f'{ROOT}/data/kanji.json'))
TYPE = {'u-verb': 'u', 'ru-verb': 'ru', 'irregular verb': 'irr'}
def src(x):
    if not x['example_ja']: return ''
    return f"Genki {'I' if x['example_book'] == 1 else 'II'} · L{x['example_lesson']} · p.{x['example_page']}" + (' · OCR' if x['example_from_ocr'] else '')
vocab = []
for x in v:
    lesson = x['lesson'] or 1  # saludos (G) se estudian con la lección 1
    vocab.append({'i': x['id'], 'r': x['kana'], 'w': x['kanji'], 'es': x['meaning_es'], 'en': x['meaning_en'],
                  't': TYPE.get(x['word_type'], ''), 'l': lesson, 's': x['section'], 'e': 1 if x['useful_expression'] else 0,
                  'x': x['example_ja'], 'xs': src(x)})
kanji = []
for x in k:
    kanji.append({'i': x['number'], 'c': x['kanji'], 'es': x['meaning_es'], 'en': x['meaning_en'], 'on': x['on_yomi'], 'kun': x['kun_yomi'],
                  'n': x['strokes'], 'l': x['lesson'], 'p': x['page'], 'b': x['book'],
                  'cp': [[c['word'], c['reading'], c['meaning_es']] for c in x['compounds']],
                  'x': x['example_ja'], 'xs': src(x)})
with open(f'{ROOT}/docs/data.js', 'w') as f:
    f.write('// Generado por scripts/build_app_data.py — no editar a mano\n')
    f.write('window.GENKI_DATA=' + json.dumps({'vocab': vocab, 'kanji': kanji}, ensure_ascii=False, separators=(',', ':')) + ';\n')
print('vocab', len(vocab), 'kanji', len(kanji), 'bytes', os.path.getsize(f'{ROOT}/docs/data.js'))
