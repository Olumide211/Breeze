// Renders the six white ring icons to 1024² PNGs: 01 = official blossom, 02–06 = Heroicons 2.2 outline (MIT).
// Same stroke weight on every icon: the 24-unit grid is drawn with stroke-width 1.25.
import {Resvg} from '@resvg/resvg-js';
import fs from 'node:fs';
const src = 'node_modules/heroicons/24/outline/';
const out = 'public/icons-line/';
// 01 is the official OpenAI blossom, used as-is (white, uniform scale, padding only).
const blossom = fs.readFileSync('public/astra-assets/logos/openai-blossom-white.svg', 'utf8')
  .replace('width="721" height="721" viewBox="0 0 721 721"', 'width="1024" height="1024" viewBox="-150 -150 1021 1021"');
fs.mkdirSync(out, {recursive: true});
fs.writeFileSync(out + '01-chatgpt.png', new Resvg(blossom, {fitTo: {mode: 'width', value: 1024}}).render().asPng());
console.log('01-chatgpt (official blossom)');

const icons = [
  ['02-codex', 'code-bracket'],
  ['03-sora', 'video-camera'],
  ['04-image', 'photo'],
  ['05-voice', 'microphone'],
  ['06-agent', 'cursor-arrow-rays'],
];
fs.mkdirSync(out, {recursive: true});
for (const [name, file] of icons) {
  let svg = fs.readFileSync(src + file + '.svg', 'utf8');
  svg = svg
    .replace('stroke-width="1.5"', 'stroke-width="1.25"')
    .replace('stroke="currentColor"', 'stroke="#ffffff"')
    // 24-unit grid with 2.4 units of padding each side, so all six share one optical box
    .replace('viewBox="0 0 24 24"', 'viewBox="-2.4 -2.4 28.8 28.8" width="1024" height="1024"');
  const png = new Resvg(svg, {fitTo: {mode: 'width', value: 1024}}).render().asPng();
  fs.writeFileSync(out + name + '.png', png);
  console.log(name, png.length);
}
