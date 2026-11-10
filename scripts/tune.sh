#!/bin/bash
# usage: scripts/tune.sh image [detail] [style]  -> writes PNGs into $OUT (default test-output/tune)
set -e
IMG=$1; DETAIL=${2:-high}; STYLE=${3:-realistic}
OUT=${OUT:-test-output/tune}; mkdir -p $OUT
NAME=$(basename ${IMG%.*})-$STYLE-$DETAIL
read W H < <(python3 -c "
from PIL import Image; import sys
im=Image.open('$IMG').convert('RGBA'); open('$OUT/in.rgba','wb').write(im.tobytes()); print(im.width, im.height)")
SNAP=${SNAP:-} npx tsx scripts/tune.ts $OUT/in.rgba $W $H $OUT/$NAME.rgba $DETAIL $STYLE
python3 -c "
from PIL import Image; import glob, numpy as np
from skimage.metrics import structural_similarity as ss
for f in glob.glob('$OUT/$NAME.rgba*'):
    Image.frombytes('RGBA',($W,$H),open(f,'rb').read()).convert('RGB').save(f.replace('.rgba','')+'.png')
a=np.array(Image.open('$OUT/$NAME.png').convert('L')); b=np.array(Image.open('$IMG').convert('L'))
print('skimage SSIM (gray, gaussian):', round(ss(a,b,gaussian_weights=True,sigma=1.5,use_sample_covariance=False,data_range=255),4))
"
rm -f $OUT/*.rgba*
