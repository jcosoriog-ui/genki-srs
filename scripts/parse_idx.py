import re, json, glob
words = set(w.strip().lower() for w in open('/usr/share/dict/words'))
TAG = r'(?:会L\d+(?:\(e\))?|読L\d+(?:-[IVX]+)?|会G|G)'
TAGS_RE = re.compile(r'\s*(' + TAG + r'(?:,\s*' + TAG + r')*)\s*$')
lines = []
for p in range(362, 378):
    for ln in open(f'g2idx_{p}.txt'):
        ln = ln.rstrip('\n').replace(' ', ' ')
        s = ln.strip()
        if not s: continue
        if re.match(r'^\d+▶巻末$|^単語さくいん', s) or s.startswith('単\n') or s in ('単','たん語','ごさくいん1　V o c a b u l a r y  I n d e x  ( J - E )'): continue
        if s.startswith('あいうえお　かきくけこ'): continue
        if re.fullmatch(r'[ぁ-んァ-ン]', s): continue
        if 'V o c a b' in s: continue
        if s.startswith(('会……','読……','G ……','(e)……','I・II・III','[u] u-verb','(Conversation','(Reading','(number of')): continue
        lines.append(s)
JP = re.compile(r'[\u3040-\u30ff\u4e00-\u9fff々〜～（）]')
entries, buf = [], ''
for s in lines:
    if buf:
        sep = '' if (buf.endswith('　') or (JP.search(buf[-1]) and JP.search(s[0]))) else ' '
        buf = buf + sep + s
    else: buf = s
    if TAGS_RE.search(buf):
        entries.append(buf); buf = ''
assert not buf, buf
def fixlig(t):
    def fx(m):
        w = m.group(0)
        if w.lower() in words or len(w) < 3: return w
        if w[0]=='T' and ('Th'+w[1:]).lower() in words: return 'Th'+w[1:]
        for i,ch in enumerate(w):
            if ch == 'f':
                for ins in ('t','fi','fl','ff'):
                    c = w[:i+1] + ins[1:] if ins!='t' else w[:i+1]+'t'+w[i+1:]
                    if ins!='t': c = w[:i] + ins + w[i+1:]
                    if c.lower() in words: return c
        return w
    return re.sub(r'[A-Za-z]+', fx, t)
out = []
JP = re.compile(r'[぀-ヿ一-鿿々〜～]')
for e in entries:
    m = TAGS_RE.search(e); tags = [t.strip() for t in m.group(1).split(',')]
    body = e[:m.start()].strip('　 ')
    parts = [x.strip() for x in body.split('　') if x.strip()]
    np=[]
    for x in parts:
        mm = re.match(r'^(\S*[\u3040-\u30ff\u4e00-\u9fff々）)]) +(\S.*)$', x)
        if mm and re.search(r'[A-Za-z~～]', mm.group(2)[:2]) : np += [mm.group(1), mm.group(2)]
        else: np.append(x)
    parts = np
    kana = parts[0]; kanji = ''; rest = parts[1:]
    if len(rest) >= 2 and JP.search(rest[0]) and not re.search(r'[a-z]{3}', rest[0]):
        kanji = rest[0]; rest = rest[1:]
    meaning = ' '.join(rest)
    vtype = ''
    mv = re.search(r'\s*\[(u|ru|irr\.)\]\s*$', meaning)
    if mv: vtype = mv.group(1); meaning = meaning[:mv.start()]
    meaning = re.sub(r'\bT(ank|at|en|ere|ey|is|ose|ese|ursday|e)\b', r'Th\1', meaning)
    meaning = re.sub(r'\bgif\b', 'gift', meaning)
    meaning = meaning.replace('ﬃ','ffi').replace('ﬁ','fi').replace('ﬂ','fl').replace('ﬀ','ff')
    meaning = fixlig(re.sub(r'\s+', ' ', meaning).replace('. . .', '...'))
    out.append(dict(kana=kana, kanji=kanji, meaning=meaning, verb=vtype, tags=tags, raw=e))
json.dump(out, open('g2index.json','w'), ensure_ascii=False, indent=0)
print(len(out))
import collections
print(collections.Counter(len(x['tags']) for x in out))
for x in out[:5]+out[400:405]: print(x)
odd = [x for x in out if JP.search(x['meaning']) or not x['meaning']]
print('odd', len(odd)); [print(x['raw']) for x in odd[:40]]
