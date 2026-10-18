import fitz, sys, json, re
d = fitz.open(sys.argv[1])
# section/lesson by pdf page
conv = [(13,32),(14,56),(15,80),(16,102),(17,124),(18,146),(19,170),(20,190),(21,216),(22,238),(23,260),(None,283)]
read = [(13,284),(14,291),(15,296),(16,303),(17,309),(18,316),(19,323),(20,331),(21,338),(22,344),(23,350),(None,357)]
def where(p):
    for lst, sec in ((conv,'会'),(read,'読')):
        for (l,a),(_,b) in zip(lst,lst[1:]):
            if a <= p < b: return sec, l
    return None, None
pages = []
for p in range(1, d.page_count+1):
    sec, les = where(p)
    if not sec: continue
    blocks = []
    for b in d[p-1].get_text('dict')['blocks']:
        t = ''
        for l in b.get('lines', []):
            lt = ''.join(s['text'] for s in l['spans'] if s['size'] >= 6.5)
            if t and lt and re.match(r'[A-Za-z]', lt[:1]) and re.search(r'[A-Za-z.,]$', t): t += ' '
            t += lt
        t = t.replace('ﬁ','fi').replace('ﬂ','fl')
        if t.strip(): blocks.append(t.strip())
    pages.append(dict(book=2, section=sec, lesson=les, page=p, blocks=blocks))
json.dump(pages, open('g2pages.json','w'), ensure_ascii=False)
print(len(pages)); print(pages[5]['blocks'][:15])
