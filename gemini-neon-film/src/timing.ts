import {Easing, interpolate, random} from 'remotion';

export const FPS = 60;
export const DURATION = 720;

export const easeInOutCubic = Easing.inOut(Easing.cubic);
export const easeOutQuart = Easing.out(Easing.poly(4));
export const easeOutCubic = Easing.out(Easing.cubic);

/** Clamped interpolate helper: maps frame f over [a,b] to [from,to] with an easing. */
export const tween = (
	f: number,
	a: number,
	b: number,
	from = 0,
	to = 1,
	easing: (t: number) => number = easeInOutCubic,
) =>
	interpolate(f, [a, b], [from, to], {
		extrapolateLeft: 'clamp',
		extrapolateRight: 'clamp',
		easing,
	});

export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

// ---------------------------------------------------------------------------
// Typing
// ---------------------------------------------------------------------------
export const TYPED_TEXT = "Hi neon, what can you do that opus 5.5 can't?";
export const TYPE_START = 168;
export const SEND_FRAME = 324;

/** Frame on which each character appears (seeded, humanised 35–65 ms per key). */
export const KEY_FRAMES: number[] = (() => {
	const ms: number[] = [0];
	let t = 0;
	for (let i = 1; i < TYPED_TEXT.length; i++) {
		let dt = 35 + random(`key-interval-${i}`) * 30;
		const prev = TYPED_TEXT[i - 1];
		if (prev === ',') dt += 150; // breath after the comma
		if (TYPED_TEXT.slice(0, i).endsWith('that')) dt += 130; // beat after "that"
		t += dt;
		ms.push(t);
	}
	// Must finish a few frames before the send press.
	const maxMs = ((SEND_FRAME - 6 - TYPE_START) / FPS) * 1000;
	const k = t > maxMs ? maxMs / t : 1;
	const frames = ms.map((m) => TYPE_START + Math.round((m * k * FPS) / 1000));
	// keep strictly increasing
	for (let i = 1; i < frames.length; i++) frames[i] = Math.max(frames[i], frames[i - 1] + 2);
	return frames;
})();

/** Number of characters visible at frame f. */
export const charsTyped = (f: number) => {
	let n = 0;
	for (const k of KEY_FRAMES) if (f >= k) n++;
	return n;
};

/**
 * Index of the first character of the first word that would collide with the
 * mic in the single-line pill. Measured offline with the real font
 * (Google Sans Flex 700 @ 42px): "Hi neon, what" = 280px fits in the 310px
 * available between x=220 and the mic, "Hi neon, what can" = 364px does not.
 */
export const GROW_CHAR_INDEX = TYPED_TEXT.indexOf('can');
export const GROW_FRAME = KEY_FRAMES[GROW_CHAR_INDEX];

// ---------------------------------------------------------------------------
// Neon ignition (synced to sound/neon-ignition-flicker.wav, measured from f480)
// flickers at 0.00 / 0.09 / 0.17 / 0.31 / 0.40 s, full on at 0.55 s
// 0.00 s = electrodes catch, then 4 irregular flickers, then the surge.
// ---------------------------------------------------------------------------
export const IGNITE = 480;
const FLICKER: Record<number, number> = {
	// 0.09s -> f485.4 : on 3 frames
	485: 0.52, 486: 0.64, 487: 0.41,
	// 0.17s -> f490.2 : on 2 frames
	490: 0.33, 491: 0.47,
	// 0.31s -> f498.6 : on 4 frames
	499: 0.71, 500: 0.84, 501: 0.6, 502: 0.77,
	// 0.40s -> f504 : on 2 frames
	504: 0.5, 505: 0.42,
	// 0.55s -> f513 : surge
};

/** Electrode glow (ends of the tube) 0..1 */
export const electrodeLevel = (f: number) => {
	if (f < IGNITE) return 0;
	return Math.min(1, (f - IGNITE + 1) / 3);
};

/** Gas brightness along the whole tube, 0..~1.15 */
export const neonLevel = (f: number) => {
	const fi = Math.floor(f);
	if (fi < IGNITE) return 0;
	if (fi < 513) return FLICKER[fi] ?? 0;
	if (fi === 513) return 0.72;
	if (fi === 514) return 1.0;
	if (fi === 515) return 1.12;
	const over = 0.15 * Math.exp(-(f - 516) / 5);
	return (1 + over) * shimmer(f);
};

/** Faint ±2% shimmer at 2 Hz with a seeded phase and tiny seeded jitter. */
export const shimmer = (f: number) => {
	const phase = random('shimmer-phase') * Math.PI * 2;
	const t = f / FPS;
	const jitter = (random(`shimmer-${Math.floor(f)}`) - 0.5) * 0.006;
	return 1 + 0.02 * Math.sin(2 * Math.PI * 2 * t + phase) + jitter;
};

/** Is this frame inside a flicker (for uneven brightness along the tube) */
export const flickerUneven = (f: number) => (f >= IGNITE && f < 516 ? 1 : 0);

// Six neon icons: f520 + 7 frames each, each with a tiny 2-flicker ignition.
export const ICON_START = 520;
export const ICON_STEP = 7;
export const iconLevel = (i: number, f: number) => {
	const s = ICON_START + i * ICON_STEP;
	const d = Math.floor(f) - s;
	let v: number;
	if (d < 0) v = 0;
	else if (d === 0) v = 0.55;
	else if (d === 1) v = 0.42;
	else if (d === 2 || d === 3) v = 0;
	else if (d === 4) v = 0.78;
	else if (d === 5) v = 0.66;
	else if (d === 6) v = 0.12;
	else v = Math.min(1, 0.72 + (d - 7) * 0.1);
	// scene 8: glow fades first, then the glass
	return v * (1 - tween(f, 564, 584));
};
export const iconGlass = (i: number, f: number) => {
	const s = ICON_START + i * ICON_STEP;
	return tween(f, s - 8, s, 0, 1, easeOutCubic) * (1 - tween(f, 576, 600));
};
