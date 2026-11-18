import fs from 'fs'; import ww from 'wawoff2'; import opentype from 'opentype.js';
const buf = fs.readFileSync(process.argv[2]);
const ttf = await ww.decompress(buf);
const font = opentype.parse(ttf.buffer.slice(ttf.byteOffset, ttf.byteOffset+ttf.byteLength));
console.log('upm', font.unitsPerEm, 'asc', font.ascender, 'desc', font.descender, 'cap', font.tables.os2.sCapHeight);
for (const s of process.argv.slice(3)) { const g = font.charToGlyph(s); console.log(s, 'adv', g.advanceWidth, JSON.stringify(g.getBoundingBox())); if (s==='4') console.log(g.path.commands.map(c=>c.type+' '+[c.x1,c.y1,c.x,c.y].filter(v=>v!==undefined).map(Math.round).join(',')).join(' | ')); }
const p = font.getAdvanceWidth(process.argv[3]==='4'?'Gemini 4 Neon':'x', 100); console.log('lockup width @100px', p);
