// QA helper: draws a labelled coordinate map (local metres) from the mask so camera paths can be planned.
// usage: node scripts/map.mjs x0 z0 x1 z1 out.png  [px,pz,label ...]
import fs from 'node:fs';
import zlib from 'node:zlib';
import {execFileSync} from 'node:child_process';
const [x0, z0, x1, z1] = process.argv.slice(2, 6).map(Number);
const out = process.argv[6];
const marks = process.argv.slice(7).map((s) => s.split(','));
const misc = JSON.parse(fs.readFileSync(new URL('../public/city/misc.json', import.meta.url)));
const M = misc.mask;
const cx = Math.round((x0 - M.x0) / M.px), cy = Math.round((z0 - M.z0) / M.px), cw = Math.round((x1 - x0) / M.px), ch = Math.round((z1 - z0) / M.px);
const scale = Math.min(4, 1400 / cw);
const step = (x1 - x0) > 3000 ? 500 : (x1 - x0) > 1200 ? 200 : 100;
let draw = '';
for (let x = Math.ceil(x0 / step) * step; x < x1; x += step) draw += `,drawbox=x=${Math.round((x - x0) / M.px * scale)}:y=0:w=1:h=ih:color=white@0.35,drawtext=text='${x}':x=${Math.round((x - x0) / M.px * scale) + 3}:y=4:fontsize=13:fontcolor=white`;
for (let z = Math.ceil(z0 / step) * step; z < z1; z += step) draw += `,drawbox=x=0:y=${Math.round((z - z0) / M.px * scale)}:w=iw:h=1:color=white@0.35,drawtext=text='${z}':x=4:y=${Math.round((z - z0) / M.px * scale) + 3}:fontsize=13:fontcolor=white`;
for (const [px, pz, label] of marks) draw += `,drawbox=x=${Math.round((px - x0) / M.px * scale) - 4}:y=${Math.round((pz - z0) / M.px * scale) - 4}:w=8:h=8:color=cyan:t=fill,drawtext=text='${label || ''}':x=${Math.round((px - x0) / M.px * scale) + 7}:y=${Math.round((pz - z0) / M.px * scale) - 6}:fontsize=14:fontcolor=cyan`;
execFileSync('ffmpeg', ['-loglevel', 'error', '-y', '-i', new URL('../public/city/mask.png', import.meta.url).pathname, '-vf', `crop=${cw}:${ch}:${cx}:${cy},scale=iw*${scale}:ih*${scale}:flags=neighbor${draw}`, out]);
