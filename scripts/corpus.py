import json, re, glob, statistics
JP = re.compile(r'[぀-ヿ一-鿿々]')
# ---------- Genki 1 (OCR)
conv1 = [(1,45),(2,65),(3,91),(4,111),(5,137),(6,155),(7,175),(8,195),(9,219),(10,239),(11,263),(12,281),(None,304)]
read1 = [(1,305),(2,309),(3,313),(4,317),(5,321),(6,327),(7,333),(8,338),(9,343),(10,349),(11,355),(12,361),(None,366)]
conv2 = [(13,32),(14,56),(15,80),(16,102),(17,124),(18,146),(19,170),(20,190),(21,216),(22,238),(23,260),(None,283)]
read2 = [(13,284),(14,291),(15,296),(16,303),(17,309),(18,316),(19,323),(20,331),(21,338),(22,344),(23,350),(None,357)]
def where(p, conv, read):
    for lst, sec in ((conv,'会'),(read,'読')):
        for (l,a),(_,b) in zip(lst,lst[1:]):
            if a <= p < b: return sec, l
    return None, None
pages = []
for f in sorted(glob.glob('g1ocr/p*.json')):
    p = int(re.search(r'p(\d+)', f).group(1))
    sec, les = where(p, conv1, read1)
    if not sec: continue
    a = json.load(open(f))
    jp = [o for o in a if JP.search(o['t'])]
    if not jp: continue
    med = statistics.median(o['h'] for o in jp)
    boxes = [o for o in a if not (o['h'] < 0.66*med and JP.search(o['t']) and len(o['t']) <= 6)]
    # group into lines by y-center
    boxes.sort(key=lambda o: (o['y']+o['h']/2))
    lines = []
    for o in boxes:
        yc = o['y']+o['h']/2
        if lines and abs(lines[-1]['yc']-yc) < 0.006 :
            lines[-1]['b'].append(o)
        else: lines.append(dict(yc=yc, b=[o]))
    blocks = []
    for ln in lines:
        bs = sorted(ln['b'], key=lambda o: o['x'])
        t = ''
        for o in bs:
            if t and not (JP.search(t[-1]) and JP.search(o['t'][0])): t += ' '
            t += o['t']
        blocks.append(dict(t=t.strip(), conf=min(o['c'] for o in bs)))
    pages.append(dict(book=1, section=sec, lesson=les, page=p, blocks=[b['t'] for b in blocks], ocr=True))
# ---------- Genki 2
g2 = json.load(open('g2pages.json'))
for pg in g2:
    joined = []
    for b in pg['blocks']:
        if joined and JP.search(joined[-1][-1:]) and JP.search(b[:1]): joined[-1] += b
        else: joined.append(b)
    pg['blocks'] = joined; pg['ocr'] = False
    pages.append(pg)
# split into sentences
sents = []
for pg in pages:
    for b in pg['blocks']:
        for s in re.split(r'(?<=[。！？!?」])\s*', b):
            s = s.strip()
            if JP.search(s): sents.append(dict(book=pg['book'], section=pg['section'], lesson=pg['lesson'], page=pg['page'], text=s, ocr=pg['ocr']))
json.dump(sents, open('sentences.json','w'), ensure_ascii=False)
print(len(sents))
import random; random.seed(1)
for s in random.sample(sents, 25): print(s['book'], s['section'], s['lesson'], s['page'], s['text'][:90])
