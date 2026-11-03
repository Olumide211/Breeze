"""Make 2x2 contact sheets (each tile 960x540, labelled) from stills."""
import sys, glob, os
from PIL import Image, ImageDraw
files = sorted(glob.glob(sys.argv[1]))
out = sys.argv[2]
os.makedirs(out, exist_ok=True)
for k in range(0, len(files), 4):
    sheet = Image.new("RGB", (1920, 1080), "black")
    for j, f in enumerate(files[k:k+4]):
        im = Image.open(f).resize((960, 540), Image.LANCZOS)
        ImageDraw.Draw(im).text((8, 8), os.path.basename(f), fill=(255, 255, 0))
        sheet.paste(im, ((j % 2) * 960, (j // 2) * 540))
    sheet.save(f"{out}/sheet{k//4:02d}.png")
