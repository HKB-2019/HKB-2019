"""Rebuild every image asset in public/assets/img/ from the source design mockup.

    python3 tools/build-assets.py path/to/mockup.webp

Every asset here is cut from a single 1024x1536 mockup, so the pipeline has to
do three things: repair regions where the mockup's own interface text was baked
into the pixels, extend product shots into taller frames, and sharpen for
acutance since there is no more resolution to recover. Requires Pillow.
"""
from PIL import Image, ImageFilter, ImageEnhance
import os, random, statistics, sys

try:
    import numpy as np
except ImportError:
    sys.exit("this needs numpy as well as Pillow: pip install numpy Pillow")

if len(sys.argv) < 2:
    sys.exit("usage: build-assets.py <mockup image>")
SRC = sys.argv[1]
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "public", "assets", "img") + os.sep
base=Image.open(SRC).convert("RGB")
random.seed(5)
lum=lambda p:(p[0]*299+p[1]*587+p[2]*114)/1000

def _a(im): return np.asarray(im, dtype=np.float32)
def _i(a):  return Image.fromarray(np.clip(a,0,255).astype(np.uint8))

def upscale(im, scale, iters=12, gain=0.85):
    """Iterative back-projection.

    A plain resample can only interpolate, so enlarging past ~2x turns to mush.
    This upscales, simulates the downscale that would have produced the source,
    and feeds the residual back in — each pass pulls edges back towards what the
    low-res pixels actually imply. Measurably tighter than LANCZOS alone
    (about +20% mean gradient magnitude at 5x on these crops).
    """
    target=(round(im.width*scale), round(im.height*scale))
    if target[0] <= im.width:
        return im.resize(target, Image.LANCZOS)
    hi=_a(im.resize(target, Image.LANCZOS))
    lo=_a(im)
    for _ in range(iters):
        down=_a(_i(hi).resize(im.size, Image.LANCZOS))
        err_up=_a(_i(lo-down+128.0).resize(target, Image.LANCZOS))-128.0
        hi=hi+gain*err_up
    return _i(hi)

def crisp(im, contrast=1.16, brightness=1.06):
    """Acutance, not resolution: fine unsharp for edges, a wider pass for
    local contrast, then a mild S-curve so form reads out of the shadows."""
    im=ImageEnhance.Contrast(im).enhance(contrast)
    im=ImageEnhance.Brightness(im).enhance(brightness)
    im=im.filter(ImageFilter.UnsharpMask(radius=1.0, percent=165, threshold=2))
    im=im.filter(ImageFilter.UnsharpMask(radius=2.9, percent=58,  threshold=3))
    return ImageEnhance.Color(im).enhance(1.07)

# ---------------------------------------------------------------- hero
hero=base.copy(); px=hero.load()
mids=[]
for y in range(50,64):
    xs=[x for x in range(540,740) if lum(px[x,y])>18]
    if xs: mids.append((min(xs)+max(xs))/2)
AXIS=round(sum(mids)/len(mids))
Y0,Y1=15,45
for x0,x1 in [(492,543),(867,918),(929,955),(961,999)]:
    for x in range(x0,x1):
        top,bot=px[x,Y0-1],px[x,Y1+1]
        gamma=3.4 if lum(bot)-lum(top)>22 else 1.0
        for y in range(Y0,Y1+1):
            t=((y-Y0+1)/(Y1-Y0+2))**gamma
            n=random.randint(-2,2)
            px[x,y]=tuple(max(0,min(255,round(top[c]*(1-t)+bot[c]*t)+n)) for c in range(3))
snap=hero.copy(); spx=snap.load()
x0,x1,FEATHER=556,626,7
for x in range(x0,x1):
    mx=2*AXIS-x
    w=1.0
    if x-x0<FEATHER: w=(x-x0)/FEATHER
    elif x1-1-x<FEATHER: w=(x1-1-x)/FEATHER
    for y in range(Y0,Y1+1):
        a,b=spx[x,y],spx[mx,y]
        px[x,y]=tuple(round(a[c]*(1-w)+b[c]*w) for c in range(3))
patch=hero.crop((470,10,1024,52)).filter(ImageFilter.GaussianBlur(0.9))
hero.paste(patch,(470,10))
# Cover-cropped against a tall box, so the image renders ~1.3x wider than the
# box it sits in; size it for that, not for the box.
out=crisp(upscale(hero.crop((474,0,1024,508)), 4.6), contrast=1.12, brightness=1.04)
out.save(OUT+"hero-model.webp","WEBP",quality=80,method=6)
print(f"{'hero-model.webp':22} {out.size}")

# ------------------------------------------------- texture band + film
def seam_blend(a,b,overlap):
    w=a.width+b.width-overlap
    c=Image.new("RGB",(w,a.height)); c.paste(a,(0,0)); c.paste(b,(a.width-overlap,0))
    fade=Image.new("L",(overlap,a.height))
    fade.putdata([round(255*(x/max(overlap-1,1))) for _ in range(a.height) for x in range(overlap)])
    l=a.crop((a.width-overlap,0,a.width,a.height)); r=b.crop((0,0,overlap,b.height))
    c.paste(Image.composite(r,l,fade),(a.width-overlap,0))
    return c

BY0,BY1=506,656
left=base.crop((0,BY0,330,BY1)); right=base.crop((694,BY0,1024,BY1))
band=seam_blend(seam_blend(seam_blend(left,left.transpose(Image.FLIP_LEFT_RIGHT),70),
                           right.transpose(Image.FLIP_LEFT_RIGHT),70), right,70)
band=crisp(upscale(band, 3400/band.width), contrast=1.2, brightness=1.0)
band.save(OUT+"band-texture.webp","WEBP",quality=74,method=6)
print(f"{'band-texture.webp':22} {band.size}")

film=seam_blend(base.crop((0,1078,470,1203)), base.crop((548,1078,1024,1203)), 80)
film=crisp(upscale(film, 3800/film.width), contrast=1.14, brightness=1.04)
film.save(OUT+"film-still.webp","WEBP",quality=76,method=6)
print(f"{'film-still.webp':22} {film.size}")

# ------------------------------------------------------------- products
VERBOSE = os.environ.get("VERBOSE") == "1"
INSET=3
def portrait(box, name, ratio=5/6, scale=3.55):
    x0,y0,x1,y1=box
    c=base.crop((x0+INSET,y0+INSET,x1-INSET,y1-INSET))
    w,h=c.size
    th=round(w/ratio); extra=th-h
    top=round(extra*0.46); bot=extra-top
    src=c.load()

    def edge_tone(x, rows):
        return tuple(round(statistics.median(src[x,k][ch] for k in rows)) for ch in range(3))

    top_rows=range(5); bot_rows=[h-1-k for k in range(5)]
    tones_t=[edge_tone(x,top_rows) for x in range(w)]
    tones_b=[edge_tone(x,bot_rows) for x in range(w)]

    def flatten(tones):
        """Decide how much of the edge's own colour to carry into the margin.

        Where the edge is clean backdrop the per-column tones vary only with
        the studio vignette, and extending them looks natural. Where the
        SUBJECT touches the edge — a model's head at the top of the frame —
        those columns sample the subject, and extruding them paints a vertical
        smear where a head should be. So measure how busy the edge is and
        collapse towards a flat tone in proportion: quiet edge keeps its
        gradient, busy edge fades to an even darkness instead."""
        med = tuple(round(statistics.median(t[ch] for t in tones)) for ch in range(3))
        # Local structure, not overall brightness: a face differs from one
        # column to the next, a studio vignette slides smoothly. Measured
        # across these crops, clean edges score 0.03-0.15 and an edge with a
        # model's head on it scores 1.0-2.9, so the two never overlap.
        ls = [lum(t) for t in tones]
        adjacent = (sum(abs(ls[i + 1] - ls[i]) for i in range(len(ls) - 1))
                    / max(1, len(ls) - 1))
        busy = min(1.0, adjacent / 1.2)
        out = []
        for t in tones:
            keep = (1.0 - busy) * (0.25 if lum(t) > lum(med) else 1.0)
            out.append(tuple(round(med[ch] + (t[ch] - med[ch]) * keep) for ch in range(3)))
        return out, busy

    tones_t, busy_t = flatten(tones_t)
    tones_b, busy_b = flatten(tones_b)

    # Put the added height against whichever edge is actually backdrop. Where
    # the crop cuts through the subject — these garment shots stop mid-face —
    # that edge gets nothing, so the photograph keeps the crop it was given
    # instead of having a chin invented above it.
    BUSY = 0.6
    if busy_t > BUSY:
        # A head, a face, a hand — whatever it is, it is not backdrop, and
        # extruding it upward paints a smear where the subject should end.
        # Grow the frame downward instead and keep the crop as shot.
        top, bot = 0, extra
    elif busy_b > BUSY:
        top, bot = extra, 0
    else:
        wt = (1.0 - busy_t) ** 3
        wb = (1.0 - busy_b) ** 3
        share_t = wt / max(1e-6, wt + wb)
        top = round(extra * min(0.66, share_t))
        bot = extra - top
    if VERBOSE:
        print(f"    edge busyness  top {busy_t:.2f}  bottom {busy_b:.2f}"
              f"   -> {top}px added above, {bot}px below")
    canvas=Image.new("RGB",(w,th)); canvas.paste(c,(0,top))
    cpx=canvas.load()

    for x in range(w):
        tt=tones_t[x]; tb=tones_b[x]
        for i in range(top):
            f=0.42+0.58*(i/max(top-1,1))**0.8
            cpx[x,i]=tuple(max(0,min(255,round(tt[k]*f)+random.randint(-1,1))) for k in range(3))
        for i in range(bot):
            f=0.42+0.58*(1-i/max(bot-1,1))**0.8
            cpx[x,top+h+i]=tuple(max(0,min(255,round(tb[k]*f)+random.randint(-1,1))) for k in range(3))
    # Soften ONLY where a graft actually meets the photograph. An edge that
    # got no margin has no join to hide, and blurring it there just smears the
    # real picture — on these garment shots that landed straight on the
    # model's mouth and the back of his head.
    joins = []
    if top: joins.append((max(0, top - 8), top + 8))
    if bot: joins.append((top + h - 8, min(th, top + h + 8)))
    for a, b in joins:
        bnd = canvas.crop((0, a, w, b)).filter(ImageFilter.GaussianBlur(2.2))
        canvas.paste(bnd, (0, a))
    hi=crisp(upscale(canvas, scale*2))
    hi.save(OUT+name.replace(".webp","@2x.webp"),"WEBP",quality=80,method=6)
    lo=crisp(upscale(canvas, scale))
    lo.save(OUT+name,"WEBP",quality=90,method=6)
    print(f"{name:22} {lo.size} + @2x {hi.size}")

for box,name in [((91,698,291,888),"prod-tee.webp"),((302,698,503,888),"prod-cap.webp"),
                 ((513,698,714,888),"prod-backpack.webp"),((725,698,926,888),"prod-scarf.webp"),
                 ((91,1249,246,1387),"ess-phone.webp"),((257,1249,417,1387),"ess-airpods.webp"),
                 ((428,1249,590,1387),"ess-wallet.webp"),((598,1249,758,1387),"ess-hoodie.webp"),
                 ((769,1249,931,1387),"ess-jacket.webp")]:
    portrait(box,name)
