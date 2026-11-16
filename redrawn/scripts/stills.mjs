// Render review stills: node scripts/stills.mjs <name> <frame> [frame...]
// Writes out/stills/<name>.png (frames tiled 3 per row).
import { bundle } from "@remotion/bundler";
import { renderStill, selectComposition, openBrowser } from "@remotion/renderer";
import { execFileSync } from "node:child_process";
import { mkdirSync, rmSync } from "node:fs";
import path from "node:path";

const [name, ...frames] = process.argv.slice(2);
const dir = path.resolve("out/stills");
const tmp = path.join(dir, `_${name}`);
mkdirSync(tmp, { recursive: true });
const serveUrl = await bundle({ entryPoint: path.resolve("src/index.ts") });
const browser = await openBrowser("chrome");
const composition = await selectComposition({ serveUrl, id: "Redrawn", puppeteerInstance: browser });
let i = 0;
for (const f of frames) {
  await renderStill({ composition, serveUrl, frame: Number(f), output: path.join(tmp, `${String(i++).padStart(3, "0")}.png`), puppeteerInstance: browser });
}
await browser.close({ silent: true });
const cols = Math.min(3, frames.length);
const rows = Math.ceil(frames.length / cols);
execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-framerate", "1", "-i", path.join(tmp, "%03d.png"), "-vf", `scale=${process.env.W ?? 640}:-1,tile=${cols}x${rows}:padding=4:color=red`, "-frames:v", "1", path.join(dir, `${name}.png`)]);
rmSync(tmp, { recursive: true });
console.log(`out/stills/${name}.png`, frames.join(" "));
