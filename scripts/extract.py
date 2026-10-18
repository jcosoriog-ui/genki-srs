import fitz, sys
d = fitz.open(sys.argv[1]); out = sys.argv[2]
for i in range(d.page_count):
    imgs = d[i].get_images(full=True)
    if not imgs: continue
    x = d.extract_image(imgs[0][0])
    open(f"{out}/p{i+1:03d}.{x['ext']}", "wb").write(x["image"])
