import fs from 'fs'; import ww from 'wawoff2'; import opentype from 'opentype.js';
const load = async (w) => { const t = await ww.decompress(fs.readFileSync(`public/gemini-neon-assets/fonts/google-sans-flex/google-sans-flex-latin-${w}-normal.woff2`)); return opentype.parse(t.buffer.slice(t.byteOffset, t.byteOffset+t.byteLength)); };
const f7 = await load(700), f5 = await load(500), f6 = await load(600);
const T = "Hi neon, what can you do that opus 5.5 can't?";
const words = T.split(' '); let acc = '';
for (const w of words) { acc = acc ? acc + ' ' + w : w; console.log(JSON.stringify(acc), f7.getAdvanceWidth(acc, 42).toFixed(1)); }
console.log('Ask Gemini 600@50', f6.getAdvanceWidth('Ask Gemini', 50));
console.log('lockup 500@70', f5.getAdvanceWidth('Gemini 4 Neon', 70), '@60', f5.getAdvanceWidth('Gemini 4 Neon', 60));
