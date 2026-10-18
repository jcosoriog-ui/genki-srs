import json, re, csv, os, sys
OUT = sys.argv[1]; os.makedirs(OUT, exist_ok=True)
JP = re.compile(r'[぀-ヿ一-鿿々]')
KAN = re.compile(r'[一-鿿々]')
OFF = {1: 9, 2: 10}
sents = json.load(open('sentences.json'))
# keep only sentence-like lines
idx0 = json.load(open('g2index.json'))
KNOWN = '\n'.join([e['kanji'] for e in idx0] + [x['text'] for x in sents if not x['ocr']] + [l for l in open('g1kanji.txt')])
def runs_ok(t):
    return all(r in KNOWN for r in re.findall(r'[\u4e00-\u9fff々]+', t))
# split multi-item exercise lines into pieces
pieces = []
for x in sents:
    for part in re.split(r'\s+[a-zA-Z]?\d*\.\s*|・\s*・|\s{2,}|→', x['text']):
        part = part.strip()
        if part: pieces.append(dict(x, text=part))
sents = pieces
def good(s):
    t = s['text']
    if not (5 <= len(t) <= 90): return False
    if s['ocr'] and not runs_ok(t): return False
    jp = len(JP.findall(t)); lat = len(re.findall(r'[A-Za-z]', t))
    if lat > 2 or jp < 0.6*len(t): return False
    if re.search(r'読み書き編|会話・文法編|第\d+課|課$', t): return False
    s['full'] = bool(re.search(r'[。？！?」か]$', t))
    return s['full'] or len(t) >= 7
cands = [s for s in sents if good(s)]
for s in cands:
    s['clean'] = re.sub(r'^[\s\d０-９A-Za-z.．\)）:：・*＊→\-–、，,。／/]+', '', s['text']).strip()
print('candidate sentences', len(cands))

# ---------------- vocabulary
idx = json.load(open('g2index.json'))
fix = {'Reading and Writing section) いちじかん': 'いちじかん', 'せんきゅうひゃくろくじゅうねんだい 1960 年代': 'せんきゅうひゃくろくじゅうねんだい'}
for e in idx:
    if e['kana'] in fix:
        if '1960' in e['kana']: e['kanji'] = '1960年代'
        e['kana'] = fix[e['kana']]
    if e['kana'].startswith('ふる（あめ'):
        e['kanji'] = '降る（雨/雪が）'; e['meaning'] = '(rain/snow) falls'
    e['kana'] = re.sub(r'/ ', '/', e['kana']); e['kanji'] = re.sub(r'/ ', '/', e['kanji'])
def parse_tag(t):
    if t in ('G', '会G'): return dict(section='G', lesson=None, useful=False, exercise=None)
    m = re.match(r'(会|読)L(\d+)(\(e\))?(?:-([IVX]+))?', t)
    return dict(section=m.group(1), lesson=int(m.group(2)), useful=bool(m.group(3)), exercise=m.group(4))
def base_forms(e):
    out = []
    for f in (e['kanji'], e['kana']):
        if not f: continue
        for alt in re.split(r'[/／]', f):
            alt = re.sub(r'（[^）]*）|\([^)]*\)|[～〜…＋+]|negative', '', alt).strip()
            alt = re.sub(r'\s.*$', '', alt)
            if alt and JP.search(alt): out.append(alt)
    return list(dict.fromkeys(out))
ROW = {'う':'わいうえおっ','く':'かきくけこい','ぐ':'がぎぐげごい','す':'さしすせそ','つ':'たちつてとっ','ぬ':'なにぬねのん','ぶ':'ばびぶべぼん','む':'まみむめもん','る':'らりるれろっ'}
def patterns(e):
    pats = []
    for f in base_forms(e):
        v = e['verb']
        if v == 'u' and f[-1] in ROW and len(f) >= 2:
            pats.append(re.escape(f[:-1]) + '[' + ROW[f[-1]] + ('い' if f.endswith(('ゃる','さる')) else '') + ']')
        elif v == 'ru' and f.endswith('る') and len(f) >= 2:
            pats.append(re.escape(f[:-1]) + '(?:る|ます|ま|て|た|な|ら|よ|れ|させ|られ|ず)')
        elif v == 'irr.' and f.endswith('する'):
            pats.append(re.escape(f[:-2]) + '(?:する|し|さ|す|せ)')
        elif v == 'irr.' and f.endswith(('くる','来る')):
            pre = re.escape(f[:-2])
            pats.append(pre + ('(?:来る|来ま|来て|来た|来な|来ら|来れ|来よ)' if f.endswith('来る') else '(?:くる|きま|きて|きた|こな|こら|これ|こよ)'))
        elif f.endswith('い') and len(f) >= 3 and not f.endswith(('うい','ない')) and KAN.search(f):
            pats.append(re.escape(f[:-1]) + '(?:い|く|かっ|け|さ|そう)')
        else:
            pats.append(re.escape(f))
    return pats
def find_example(e, first):
    pats = [re.compile(p) for p in patterns(e)]
    if not pats: return None
    best = None
    for s in cands:
        if s['lesson'] is None: continue
        hit = None
        for i, p in enumerate(pats):
            for m in p.finditer(s['clean']):
                a, b = m.start(), m.end(); c = s['clean']
                if KAN.search(m.group(0)) and len(re.sub(r'[^\u4e00-\u9fff]', '', m.group(0))) <= 2 and ((a > 0 and KAN.match(c[a-1])) or (b < len(c) and KAN.match(c[b]) and KAN.match(m.group(0)[-1]))):
                    continue
                hit = (i, m); break
            if hit: break
        if not hit: continue
        score = 0
        if first and first['lesson']:
            d = s['lesson'] - first['lesson']
            score += 100 if d == 0 else (60 - 3*d if d > 0 else 20 + 2*d)
            if s['section'] == first['section']: score += 8
        if not s['ocr']: score += 6
        if not s['full']: score -= 60
        if e['kanji'] and not KAN.search(pats[hit[0]].pattern): score -= 15
        if not KAN.search(pats[hit[0]].pattern) and len(base_forms(e)[-1]) <= 2 and hit[1].start() > 0 and re.match(r'[ぁ-ん]', s['clean'][hit[1].start()-1]): score -= 40
        if hit[0] == 0 and KAN.search(pats[0].pattern): score += 5   # matched kanji form
        L = len(s['clean']); score -= abs(L - 22) * 0.3
        bare = re.sub(r'^[^：:]{1,8}[：:]\s*', '', s['clean'])
        bare = re.sub(r'[。！？!?、\s]', '', bare)
        if bare == hit[1].group(0) or len(bare) <= len(hit[1].group(0)) + 2: score -= 50   # la palabra sola
        if best is None or score > best[0]: best = (score, s)
    return best[1] if best else None
vocab = []
for i, e in enumerate(idx, 1):
    tags = [dict(raw=t, **parse_tag(t)) for t in e['tags']]
    lessons = [t for t in tags if t['lesson']]
    first = min(lessons, key=lambda t: (t['lesson'], t['useful'], t['section'] != '会')) if lessons else tags[0]
    ex = find_example(e, first)
    vocab.append(dict(
        id=i, kana=e['kana'], kanji=e['kanji'], meaning_en=e['meaning'],
        word_type={'u': 'u-verb', 'ru': 'ru-verb', 'irr.': 'irregular verb'}.get(e['verb'], ''),
        book=(1 if (first['lesson'] or 0) <= 12 else 2), lesson=first['lesson'], section=first['section'],
        useful_expression=first['useful'], exercise=first['exercise'] or '',
        all_lessons=', '.join(e['tags']),
        example_ja=ex['clean'] if ex else '', example_book=ex['book'] if ex else '',
        example_lesson=ex['lesson'] if ex else '', example_section=ex['section'] if ex else '',
        example_page=(ex['page'] - OFF[ex['book']]) if ex else '', example_from_ocr=bool(ex and ex['ocr'])))
# ---------------- kanji
kanji = []
def comp_split(s):
    parts = re.split(r';\s*(?=[^\sA-Za-z0-9"(.])', s)
    out = []
    for p in parts:
        m = re.match(r'(.+?)\(([^)]*)\)\s*(.*)$', p.strip())
        if m: out.append(dict(word=m.group(1), reading=m.group(2), meaning=m.group(3).strip()))
    return out
for ln in open('g1kanji.txt'):
    les, num, k, on, kun, mean, strokes, comps = ln.rstrip('\n').split('|')
    kanji.append(dict(number=int(num), kanji=k, book=1, lesson=int(les), meaning_en=mean, on_yomi=on.split(), kun_yomi=kun.split(),
                      strokes=int(strokes), compounds=comp_split(comps), page=None))
G1KPAGE = {3:304,4:308,5:312,6:318,7:324,8:329,9:334,10:340,11:346,12:352}
for k in kanji: k['page'] = G1KPAGE[k['lesson']] + (0 if k['number'] in range(1,9) or k['number'] in (16,17,18,19,20,21,22,23,30,31,32,33,34,35,36,37,44,45,46,47,48,49,50,51,59,60,61,62,63,64,65,66,73,74,75,76,77,78,79,80,87,88,89,90,91,92,93,94,102,103,104,105,106,107,108,109,116,117,118,119,120,121,122,123,132,133,134,135,136,137,138,139) else 1)
for e in json.load(open('g2kanji.json')):
    kanji.append(dict(number=e['num'], kanji=e['kanji'], book=2, lesson=e['lesson'], meaning_en=e['meaning'], on_yomi=e['on'], kun_yomi=e['kun'],
                      strokes=e['strokes'], compounds=e['compounds'], page=e['page'] - OFF[2]))
kanji.sort(key=lambda k: k['number'])
assert [k['number'] for k in kanji] == list(range(1, 318)), 'numbering gap'
for k in kanji:
    best = None
    for s in cands:
        if s['lesson'] is None or k['kanji'] not in s['clean']: continue
        d = s['lesson'] - k['lesson']
        if not s['full']: continue
        score = (100 if d == 0 else (60 - 3*d if d > 0 else -100)) + (10 if s['section'] == '読' else 0) + (6 if not s['ocr'] else 0) - abs(len(s['clean']) - 22) * 0.3
        if best is None or score > best[0]: best = (score, s)
    s = best[1] if best and best[0] > -50 else None
    k.update(example_ja=s['clean'] if s else '', example_book=s['book'] if s else '', example_lesson=s['lesson'] if s else '',
             example_section=s['section'] if s else '', example_page=(s['page'] - OFF[s['book']]) if s else '', example_from_ocr=bool(s and s['ocr']))
def norm(o):
    if isinstance(o, str): return o.replace('ﬁ','fi').replace('ﬂ','fl').replace('ﬃ','ffi').replace('ﬀ','ff')
    if isinstance(o, list): return [norm(x) for x in o]
    if isinstance(o, dict): return {k: norm(x) for k, x in o.items()}
    return o
vocab = norm(vocab); kanji = norm(kanji)
# ---------------- write
json.dump(vocab, open(f'{OUT}/vocabulary.json', 'w'), ensure_ascii=False, indent=1)
json.dump(kanji, open(f'{OUT}/kanji.json', 'w'), ensure_ascii=False, indent=1)
with open(f'{OUT}/vocabulary.csv', 'w', newline='') as f:
    w = csv.DictWriter(f, fieldnames=list(vocab[0].keys())); w.writeheader(); w.writerows(vocab)
with open(f'{OUT}/kanji.csv', 'w', newline='') as f:
    rows = [dict(k, on_yomi=' '.join(k['on_yomi']), kun_yomi=' '.join(k['kun_yomi']),
                 compounds=' ／ '.join(f"{c['word']}（{c['reading']}）{c['meaning']}" for c in k['compounds'])) for k in kanji]
    w = csv.DictWriter(f, fieldnames=list(rows[0].keys())); w.writeheader(); w.writerows(rows)
print('vocab', len(vocab), 'with example', sum(1 for v in vocab if v['example_ja']), 'ocr ex', sum(v['example_from_ocr'] for v in vocab))
print('kanji', len(kanji), 'with example', sum(1 for k in kanji if k['example_ja']))
