import fitz, sys, re, json
d = fitz.open(sys.argv[1])
# reading section lesson starts (pdf pages), from TOC
starts = [(13,284),(14,291),(15,296),(16,303),(17,309),(18,316),(19,323),(20,331),(21,338),(22,344),(23,350),(None,357)]
CIRC = '⑴⑵⑶⑷⑸⑹⑺⑻⑼⑽⑾⑿⒀⒁⒂⒃⒄⒅⒆⒇'
out = []
for (les, a), (_, b) in zip(starts, starts[1:]):
    for p in range(a, b):
        lines = [l.strip() for l in d[p-1].get_text().split('\n')]
        nums = [int(l) for l in lines if re.fullmatch(r'\d{3}', l) and 146 <= int(l) <= 400]
        # find entries: a line that is a single kanji followed by a ▶/▷ line
        idx = [i for i,l in enumerate(lines) if re.fullmatch(r'[一-鿿々]', l) and i+1 < len(lines) and lines[i+1].startswith(('▶','▷'))]
        if not idx: continue
        ents = []
        for k,i in enumerate(idx):
            j = idx[k+1] if k+1 < len(idx) else len(lines)
            blk = lines[i:j]
            kan = blk[0]; on=[]; kun=[]; comp=[]; meaning=''; strokes=None; mode=None
            buf = []
            for l in blk[1:]:
                if l.startswith('▶'): mode='on'; on += l[1:].split(); continue
                if l.startswith('▷'): mode='kun'; kun += l[1:].split(); continue
                if l and l[0] in CIRC: strokes = CIRC.index(l[0])+1; mode='end'; continue
                if mode=='end' or not l or re.fullmatch(r'\d+', l) or l.startswith('(▶'): continue
                if re.fullmatch(r'[ぁ-んー\s　]+', l) and mode in ('on','kun') and not comp:
                    (on if mode=='on' else kun).extend(l.split()); continue
                mode='body'; buf.append(l)
            text = ' '.join(buf)
            mm = re.search(r'\(\s*([^()]*(?:\([^()]*\)[^()]*)*)\)\s*$', text)
            # meaning is the last parenthesized chunk on its own line(s)
            mlines = []
            while buf and (buf[-1].startswith('(') or (mlines and not '（' in buf[-1])) and not '（' in buf[-1]:
                mlines.insert(0, buf.pop())
                if mlines[0].startswith('('): break
            meaning = re.sub(r'\s+',' ', ' '.join(mlines)).strip()
            meaning = re.sub(r'^\(\s*|\s*\)$','', meaning)
            body = re.sub(r'\s*\n\s*', ' ', '\n'.join(buf)).replace('ﬁ','fi').replace('ﬂ','fl').replace('ﬃ','ffi').replace('ﬀ','ff')
            if not meaning:
                mm = re.search(r'\(\s+([^()]+)\)', body)
                if mm:
                    meaning = re.sub(r'\s+',' ',mm.group(1)).strip(); body = (body[:mm.start()] + body[mm.end():]).strip()
            # split compounds: WORD（reading）gloss
            for m in re.finditer(r'([^\s　（）]+?)（([^）]+)）\s*([^　]*?)(?=　|\s[^\s（]+（|$)', body):
                comp.append(dict(word=m.group(1), reading=m.group(2), meaning=m.group(3).strip()))
            ents.append(dict(kanji=kan, on=on, kun=kun, meaning=meaning, strokes=strokes, compounds=comp, body=body, lesson=les, page=p))
        assert len(nums)==len(ents), (p, nums, [e['kanji'] for e in ents])
        for n,e in zip(nums, ents): e['num']=n
        out += ents
json.dump(out, open('g2kanji.json','w'), ensure_ascii=False, indent=1)
print(len(out), out[0]['num'], out[-1]['num'])
for e in out[:3]+out[-2:]: print({k:v for k,v in e.items() if k!='body'})
