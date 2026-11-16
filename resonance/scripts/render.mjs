// Render driver.
//   node scripts/render.mjs stills 0 150 299 ...   -> out/qa/fNNNN.jpg  (960x540 QA stills)
//   node scripts/render.mjs overview [step]        -> out/qa/overview/  (every Nth frame, default 30)
//   node scripts/render.mjs preview [shotIndex]    -> out/preview/shot-XX.mp4 (960x540)
//   node scripts/render.mjs final                  -> ProRes 4444 master + out/resonance-4k.mp4 + out/resonance-1080p.mp4
// The GL backend is "angle" (GPU); if no GPU context can be created it falls back to "swangle".
import {bundle} from '@remotion/bundler';
import {openBrowser, renderFrames, renderMedia, renderStill, selectComposition} from '@remotion/renderer';
import {execFileSync} from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'out');
fs.mkdirSync(OUT, {recursive: true});
const [mode = 'final', ...args] = process.argv.slice(2);
const env = process.env;
const SUB = env.SUBFRAMES ? Number(env.SUBFRAMES) : undefined;
const FPS = 60;
const SHOT_TIMES = [0, 5, 10, 16, 21, 26, 31, 36, 42, 48];

const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);

const getBundle = async () => {
	const dir = path.join(OUT, '.bundle');
	if (env.REUSE_BUNDLE && fs.existsSync(path.join(dir, 'index.html'))) return dir;
	log('bundling...');
	return bundle({entryPoint: path.join(ROOT, 'src/index.ts'), outDir: dir, publicDir: path.join(ROOT, 'public')});
};

const pickGl = async (serveUrl) => {
	if (env.GL) return env.GL;
	const cache = path.join(OUT, '.gl');
	if (fs.existsSync(cache)) return fs.readFileSync(cache, 'utf8').trim();
	let gl = 'angle';
	try {
		const comp = await selectComposition({serveUrl, id: 'GlProbe', chromiumOptions: {gl}});
		await renderStill({serveUrl, composition: comp, output: path.join(OUT, '.probe.png'), chromiumOptions: {gl}, timeoutInMilliseconds: 60000, logLevel: 'error'});
	} catch (err) {
		log(`"angle" renderer unavailable (${String(err.message).split('\n')[0].slice(0, 80)}); falling back to "swangle"`);
		gl = 'swangle';
	}
	fs.writeFileSync(cache, gl);
	return gl;
};

const serveUrl = await getBundle();
const gl = await pickGl(serveUrl);
log(`GL renderer: ${gl}`);
const chromiumOptions = {gl, enableMultiProcessOnLinux: true};
const timeoutInMilliseconds = 900000;
const onBrowserLog = (l) => {
	if (/collision|error|warn|perf/i.test(l.text) && !/GPU stall|GL_CLOSE_PATH|willReadFrequently|Automatic fallback/i.test(l.text)) console.log('  [browser]', l.text.slice(0, /Shader Error/.test(l.text) ? 3500 : 400));
};
const compFor = async (inputProps) => selectComposition({serveUrl, id: 'Resonance', inputProps, chromiumOptions, timeoutInMilliseconds});

if (mode === 'stills') {
	const inputProps = {subframes: SUB ?? 4, debugCam: env.DEBUGCAM ? env.DEBUGCAM.split(',').map(Number) : null};
	const composition = await compFor(inputProps);
	const scale = env.SCALE ? Number(env.SCALE) : 0.25;
	const dir = path.join(OUT, env.QADIR || 'qa');
	fs.mkdirSync(dir, {recursive: true});
	const browser = await openBrowser('chrome', {chromiumOptions});
	for (const f of args.map(Number)) {
		const t0 = performance.now();
		const output = path.join(dir, `${env.TAG || 'f'}${String(f).padStart(4, '0')}.jpg`);
		await renderStill({serveUrl, composition, frame: f, output, inputProps, scale, imageFormat: 'jpeg', jpegQuality: 92, chromiumOptions, timeoutInMilliseconds, puppeteerInstance: browser, onBrowserLog});
		log(`still ${f} -> ${path.relative(ROOT, output)} (${((performance.now() - t0) / 1000).toFixed(1)} s)`);
	}
	await browser.close({silent: true});
} else if (mode === 'overview') {
	const step = Number(args[0] || 30);
	const inputProps = {subframes: SUB ?? 2, prof: !!env.PROF, hide: env.HIDE || '', debugCam: env.DEBUGCAM ? env.DEBUGCAM.split(',').map(Number) : null};
	const composition = await compFor(inputProps);
	const dir = path.join(OUT, 'qa', 'overview');
	fs.rmSync(dir, {recursive: true, force: true});
	fs.mkdirSync(dir, {recursive: true});
	const range = env.RANGE ? env.RANGE.split('-').map(Number) : null;
	await renderFrames({
		serveUrl, composition, inputProps, outputDir: dir, imageFormat: 'jpeg', jpegQuality: 90, scale: env.SCALE ? Number(env.SCALE) : 0.25, everyNthFrame: step, frameRange: range, concurrency: 1, chromiumOptions, timeoutInMilliseconds, onBrowserLog,
		onStart: () => {}, onFrameUpdate: (n) => log(`overview frames: ${n}`),
	});
} else if (mode === 'preview') {
	const which = args.length ? args.map(Number) : SHOT_TIMES.slice(0, -1).map((_, i) => i);
	const inputProps = {subframes: SUB ?? 4};
	const composition = await compFor(inputProps);
	fs.mkdirSync(path.join(OUT, 'preview'), {recursive: true});
	for (const i of which) {
		const range = [SHOT_TIMES[i] * FPS, SHOT_TIMES[i + 1] * FPS - 1];
		const output = path.join(OUT, 'preview', `shot-${String(i + 1).padStart(2, '0')}.mp4`);
		const t0 = performance.now();
		await renderMedia({serveUrl, composition, inputProps, codec: 'h264', crf: 20, scale: 0.25, frameRange: range, outputLocation: output, concurrency: Number(env.CONCURRENCY || 2), chromiumOptions, timeoutInMilliseconds, muted: true, enforceAudioTrack: false, onBrowserLog, imageFormat: 'jpeg', jpegQuality: 95});
		log(`preview shot ${i + 1} -> ${path.relative(ROOT, output)} (${((performance.now() - t0) / 1000).toFixed(0)} s)`);
	}
} else if (mode === 'final') {
	// Resumable chunked render. Each chunk is a ProRes 4444 segment; segments are concatenated
	// losslessly, the natively-4K title is composited on top, and both H.264 deliverables are
	// encoded from the resulting ProRes 4444 master.
	//   NATIVE=1  -> render the 3D film at native 3840x2160 (GPU machines; add SUBFRAMES=8)
	//   default   -> software-GL path: 3D at 1920x1080, lanczos upscale to 4K, 4K title overlay
	const native = !!env.NATIVE;
	const id = native ? 'Resonance' : 'ResonanceHD';
	const inputProps = {subframes: SUB ?? (native ? 8 : 1), noTitle: true};
	const composition = await selectComposition({serveUrl, id, inputProps, chromiumOptions, timeoutInMilliseconds});
	const total = composition.durationInFrames;
	const CHUNK = Number(env.CHUNK || 60);
	const segDir = path.join(OUT, 'segments');
	fs.mkdirSync(segDir, {recursive: true});
	const from = Number(env.FROM || 0), to = Number(env.TO || total);
	const segs = [];
	for (let a = 0; a < total; a += CHUNK) {
		const b = Math.min(total, a + CHUNK) - 1;
		const output = path.join(segDir, `seg-${String(a).padStart(5, '0')}.mov`);
		segs.push(output);
		if (a < from || a >= to) continue;
		if (fs.existsSync(output)) continue;
		const t0 = performance.now();
		const tmp = output.replace('.mov', '.part.mov');
		await renderMedia({serveUrl, composition, inputProps, codec: 'prores', proResProfile: '4444', pixelFormat: 'yuv444p10le', imageFormat: 'png', frameRange: [a, b], outputLocation: tmp, concurrency: 1, chromiumOptions, timeoutInMilliseconds, muted: true, enforceAudioTrack: false, onBrowserLog});
		fs.renameSync(tmp, output);
		log(`segment ${a}-${b} done in ${((performance.now() - t0) / 60000).toFixed(1)} min`);
	}
	if (segs.every((s) => fs.existsSync(s)) && !env.NO_ENCODE) {
		const ff = (a) => execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', ...a], {stdio: 'inherit'});
		const list = path.join(segDir, 'list.txt');
		fs.writeFileSync(list, segs.map((s) => `file '${s}'`).join('\n'));
		const film = path.join(OUT, 'film-3d.mov');
		log('concatenating segments...');
		ff(['-f', 'concat', '-safe', '0', '-i', list, '-c', 'copy', '-an', film]);
		log('rendering the title natively at 4K (with alpha)...');
		const titleComp = await selectComposition({serveUrl, id: 'TitleOnly', chromiumOptions, timeoutInMilliseconds});
		const title = path.join(OUT, 'title-4k.mov');
		await renderMedia({serveUrl, composition: titleComp, codec: 'prores', proResProfile: '4444', pixelFormat: 'yuva444p10le', imageFormat: 'png', outputLocation: title, concurrency: 2, chromiumOptions, timeoutInMilliseconds, muted: true, enforceAudioTrack: false});
		const titleStart = (total - titleComp.durationInFrames) / FPS;
		const master = path.join(OUT, 'resonance-master-prores4444.mov');
		log('compositing the ProRes 4444 master (3840x2160)...');
		const up = native ? 'null' : 'scale=3840:2160:flags=lanczos,unsharp=5:5:0.35:5:5:0.0';
		ff(['-i', film, '-itsoffset', String(titleStart), '-i', title, '-filter_complex', `[0:v]${up}[bg];[bg][1:v]overlay=0:0:eof_action=pass:format=auto,format=yuv444p10le[v]`, '-map', '[v]', '-r', '60', '-c:v', 'prores_ks', '-profile:v', '4444', '-pix_fmt', 'yuv444p10le', '-vendor', 'apl0', '-an', master]);
		const x264 = ['-c:v', 'libx264', '-preset', 'slow', '-crf', '16', '-pix_fmt', 'yuv420p', '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-movflags', '+faststart', '-an', '-r', '60'];
		log('encoding out/resonance-4k.mp4 ...');
		ff(['-i', master, ...x264, path.join(OUT, 'resonance-4k.mp4')]);
		log('encoding out/resonance-1080p.mp4 ...');
		ff(['-i', master, '-vf', 'scale=1920:1080:flags=lanczos', ...x264, path.join(OUT, 'resonance-1080p.mp4')]);
		log('done');
	} else {
		log('not all segments present yet; run again to continue');
	}
} else {
	console.error('unknown mode', mode);
	process.exit(1);
}
process.exit(0);
