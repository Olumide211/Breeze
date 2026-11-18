import React from 'react';
import {Img, staticFile, useCurrentFrame} from 'remotion';
import {FLEX} from './fonts';
import {Layout} from './layout';
import {Glint} from './Glint';
import {
	GROW_FRAME,
	KEY_FRAMES,
	SEND_FRAME,
	TYPED_TEXT,
	charsTyped,
	easeInOutCubic,
	easeOutCubic,
	easeOutQuart,
	lerp,
	tween,
} from './timing';

// Measured from reference/gemini-app/*.jpg, scaled to 1080 wide.
const PILL = {w: 838, h: 235, r: 117, plus: 120, text: 220, mic: 575, btn: 719};
const GROWN = {w: 957, h: 414, r: 105, plus: 120, mic: 693.5, btn: 838, textX: 72, textTop: 66, btnFromBottom: 120};
const BTN = 119;
const TYPE_SIZE = 42; // Google Sans Flex 700
const TYPE_LH = 54;
const BUBBLE = {w: 811, h: 234, padX: 83, lh: 58, textW: 645};

const abs = (x: number, y: number, w: number, h: number): React.CSSProperties => ({
	position: 'absolute',
	left: x,
	top: y,
	width: w,
	height: h,
});

const Plus: React.FC<{cx: number; cy: number; o: number}> = ({cx, cy, o}) => (
	<svg style={{...abs(cx - 28, cy - 28, 56, 56), opacity: o}} viewBox="-28 -28 56 56">
		<path d="M -24 0 H 24 M 0 -24 V 24" stroke="#fff" strokeWidth={2.6} strokeLinecap="round" fill="none" />
	</svg>
);

const Mic: React.FC<{cx: number; cy: number; o: number}> = ({cx, cy, o}) => (
	<svg style={{...abs(cx - 28, cy - 30, 56, 60), opacity: o}} viewBox="-28 -30 56 60">
		<g stroke="#fff" strokeWidth={3} fill="none" strokeLinecap="round">
			<rect x={-8.5} y={-23} width={17} height={30} rx={8.5} />
			<path d="M -16 -2 Q -16 16 0 16 Q 16 16 16 -2" />
			<path d="M 0 16 V 24" />
		</g>
	</svg>
);

const ActionButton: React.FC<{cx: number; cy: number; f: number; scale: number}> = ({cx, cy, f, scale}) => {
	const toSend = tween(f, KEY_FRAMES[0], KEY_FRAMES[0] + 8, 0, 1, easeInOutCubic);
	const toStop = tween(f, SEND_FRAME + 6, SEND_FRAME + 14, 0, 1, easeInOutCubic);
	const voiceO = 1 - toSend;
	const sendO = toSend * (1 - toStop);
	return (
		<div style={{...abs(cx - BTN / 2, cy - BTN / 2, BTN, BTN), transform: `scale(${scale})`}}>
			<div style={{...abs(0, 0, BTN, BTN), borderRadius: BTN, background: '#192968', opacity: voiceO}}>
				<svg style={abs(0, 0, BTN, BTN)} viewBox="-60 -60 120 120">
					<g stroke="#d9def1" strokeWidth={4.6} strokeLinecap="round">
						<path d="M -14 -9 V 9" />
						<path d="M 0 -22 V 22" />
						<path d="M 14 -9 V 9" />
					</g>
				</svg>
			</div>
			<div style={{...abs(0, 0, BTN, BTN), borderRadius: BTN, background: '#2f45a8', opacity: sendO}}>
				<svg style={abs(0, 0, BTN, BTN)} viewBox="-60 -60 120 120">
					<g stroke="#ffffff" strokeWidth={4.2} strokeLinecap="round" strokeLinejoin="round" fill="none">
						<path d="M 0 21 V -20" />
						<path d="M -17 -3 L 0 -20 L 17 -3" />
					</g>
				</svg>
			</div>
			<div style={{...abs(0, 0, BTN, BTN), borderRadius: BTN, background: '#131313', opacity: toStop}}>
				<svg style={abs(0, 0, BTN, BTN)} viewBox="-60 -60 120 120">
					<rect x={-17} y={-17} width={34} height={34} rx={8} stroke="#fff" strokeWidth={3.4} fill="none" />
				</svg>
			</div>
		</div>
	);
};

/** The single spark of scenes 1–2. Only ever scaled, rotated and faded. */
export const IntroSpark: React.FC<{L: Layout}> = ({L}) => {
	const f = useCurrentFrame();
	if (f < 12 || f >= 106) return null;
	const [cx, cy] = L.sparkCenter;
	const fadeIn = tween(f, 12, 54, 0, 1, easeOutQuart);
	const s1 = lerp(0.85, 1, tween(f, 12, 54, 0, 1, easeOutQuart));
	const shrink = 1 - tween(f, 84, 104, 0, 1, easeInOutCubic);
	const rot = tween(f, 12, 54, 0, 45, easeInOutCubic) + tween(f, 84, 104, 0, 90, easeInOutCubic);
	const size = L.sparkSize;
	const twinkle = Math.sin(Math.PI * tween(f, 40, 70, 0, 1, (t) => t));
	return (
		<>
			<Img
				src={staticFile('gemini-neon-assets/logos/gemini-spark-color.svg')}
				style={{
					...abs(cx - size / 2, cy - size / 2, size, size),
					opacity: fadeIn,
					transform: `rotate(${rot}deg) scale(${s1 * shrink})`,
				}}
			/>
			<Glint id="intro" cx={cx} cy={cy} size={size * 1.25} amount={0.75 * twinkle * twinkle} rotate={rot} />
		</>
	);
};

/** Ask Gemini box, typing, bubble and thinking dots (scenes 2–5). */
export const AppUI: React.FC<{L: Layout}> = ({L}) => {
	const f = useCurrentFrame();
	if (f < 84) return null;
	const W = L.W;

	// ---- box geometry
	const grow = tween(f, GROW_FRAME, GROW_FRAME + 10, 0, 1, easeOutCubic);
	const snap = tween(f, SEND_FRAME + 6, SEND_FRAME + 18, 0, 1, easeOutQuart);
	const g = Math.max(0, grow - snap);
	let w: number, h: number, top: number;
	const opening = f < 126;
	if (f < 126) {
		w = tween(f, 84, 104, 0, PILL.w, easeOutQuart);
		h = tween(f, 100, 126, 2, PILL.h, easeInOutCubic);
		top = L.pillOpenY - h / 2;
	} else {
		w = lerp(PILL.w, GROWN.w, g);
		h = lerp(PILL.h, GROWN.h, g);
		const glide = tween(f, 126, 144, 0, 1, easeInOutCubic);
		const bottom = lerp(L.pillOpenY + PILL.h / 2, L.pillBottom, glide);
		top = bottom - h;
	}
	const left = (W - w) / 2;
	const radius = Math.min(h / 2, lerp(PILL.r, GROWN.r, g));
	const lineToFill = tween(f, 100, 114, 0, 1, easeInOutCubic);
	const fill = `rgb(${Math.round(lerp(255, 28, lineToFill))},${Math.round(lerp(255, 28, lineToFill))},${Math.round(
		lerp(255, 28, lineToFill),
	)})`;
	const boxBottom = top + h;
	const btnY = opening ? top + h / 2 : boxBottom - lerp(PILL.h / 2, GROWN.btnFromBottom, g);

	// ---- contents (staggered 3 frames)
	const cIn = (i: number) => tween(f, 118 + i * 3, 126 + i * 3, 0, 1, easeOutCubic);
	const firstKey = KEY_FRAMES[0];
	const placeholderO = cIn(1) * (1 - tween(f, firstKey, firstKey + 3, 0, 1, (t) => t)) + tween(f, SEND_FRAME + 12, SEND_FRAME + 22);
	const micO = cIn(2) * (1 - tween(f, SEND_FRAME + 6, SEND_FRAME + 14));
	const press = f >= SEND_FRAME && f <= SEND_FRAME + 6 ? 1 - 0.06 * Math.sin((Math.PI * (f - SEND_FRAME)) / 6) : 1;

	// ---- typed text
	const n = f < SEND_FRAME + 6 ? charsTyped(f) : 0;
	const typed = TYPED_TEXT.slice(0, n);
	const textLeft = left + lerp(PILL.text, GROWN.textX, g);
	const textTop = lerp(btnY - TYPE_LH / 2, top + GROWN.textTop, g);
	let caretOn = false;
	if (f >= 144 && f < 168) caretOn = Math.floor((f - 144) / 6) % 2 === 0;
	else if (f >= 168 && f < SEND_FRAME) caretOn = true;

	// ---- bubble (scene 5)
	const lift = tween(f, SEND_FRAME + 6, SEND_FRAME + 30, 0, 1, easeInOutCubic);
	const showBubble = f >= SEND_FRAME + 6;
	const grownLeft = (W - GROWN.w) / 2;
	const grownTop = L.pillBottom - GROWN.h;
	const srcX = grownLeft + GROWN.textX - BUBBLE.padX;
	const srcY = grownTop + GROWN.textTop - (BUBBLE.h - 2 * BUBBLE.lh) / 2 - (BUBBLE.lh - TYPE_LH) / 2;
	const dstX = L.bubbleRight - BUBBLE.w;
	const dstY = L.bubbleTop;
	const bx = lerp(srcX, dstX, lift);
	const by = lerp(srcY, dstY, lift);
	const bw = lerp(GROWN.w - 2 * GROWN.textX + 2 * BUBBLE.padX, BUBBLE.w, lift);
	const bubbleFill = tween(f, SEND_FRAME + 6, SEND_FRAME + 20);
	const oldTextO = 1 - tween(f, SEND_FRAME + 6, SEND_FRAME + 16);
	const newTextO = tween(f, SEND_FRAME + 10, SEND_FRAME + 22);
	const padY = (BUBBLE.h - 2 * BUBBLE.lh) / 2;

	// ---- thinking dots
	const dotsO = tween(f, 356, 366, 0, 1, easeOutCubic);
	const dotsY = L.bubbleTop + BUBBLE.h + 90;
	const bump = (t: number) => (t > 0 && t < 1 ? Math.sin(Math.PI * t) : 0);

	const textStyle: React.CSSProperties = {
		fontFamily: FLEX,
		fontWeight: 700,
		fontSize: TYPE_SIZE,
		color: '#ffffff',
		whiteSpace: 'normal',
	};

	return (
		<div style={{position: 'absolute', inset: 0}}>
			{/* the box / line of light */}
			<div style={{...abs(left, top, w, h), borderRadius: radius, background: fill}} />
			<Plus cx={left + PILL.plus} cy={btnY} o={cIn(0)} />
			<div
				style={{
					...abs(left + PILL.text, btnY - 30, 400, 60),
					fontFamily: FLEX,
					fontWeight: 600,
					fontSize: 50,
					lineHeight: '60px',
					color: '#b0b0b0',
					opacity: Math.min(1, placeholderO),
					whiteSpace: 'nowrap',
				}}
			>
				Ask Gemini
			</div>
			<Mic cx={left + lerp(PILL.mic, GROWN.mic, g)} cy={btnY} o={micO} />
			{f >= 118 ? (
				<div style={{opacity: cIn(3)}}>
					<ActionButton cx={left + lerp(PILL.btn, GROWN.btn, g)} cy={btnY} f={f} scale={press} />
				</div>
			) : null}

			{/* typed text (wraps inside the 2-line box; never scrolls or clips) */}
			{f < SEND_FRAME + 6 ? (
				<div style={{...abs(textLeft, textTop, GROWN.w - 2 * GROWN.textX, 200), ...textStyle, lineHeight: `${TYPE_LH}px`}}>
					{typed}
					<span
						style={{
							display: 'inline-block',
							width: 3,
							height: 46,
							marginLeft: n > 0 ? 2 : 0,
							verticalAlign: -9,
							background: '#ffffff',
							opacity: caretOn ? 1 : 0,
							borderRadius: 2,
						}}
					/>
				</div>
			) : null}

			{/* the message lifts into the frosted bubble */}
			{showBubble ? (
				<div
					style={{
						...abs(bx, by, bw, BUBBLE.h),
						borderRadius: BUBBLE.h / 2,
						background: `rgba(20, 62, 60, ${0.82 * bubbleFill})`,
					}}
				>
					<div
						style={{
							...abs(BUBBLE.padX, padY + (BUBBLE.lh - TYPE_LH) / 2, GROWN.w - 2 * GROWN.textX, 200),
							...textStyle,
							lineHeight: `${TYPE_LH}px`,
							opacity: oldTextO,
						}}
					>
						{TYPED_TEXT}
					</div>
					<div
						style={{
							...abs(BUBBLE.padX, padY, BUBBLE.textW, 200),
							...textStyle,
							lineHeight: `${BUBBLE.lh}px`,
							opacity: newTextO,
						}}
					>
						{TYPED_TEXT}
					</div>
				</div>
			) : null}

			{/* thinking dots: three 12px dots rippling twice */}
			{f >= 356
				? [0, 1, 2].map((i) => {
						const dy = -6 * (bump((f - 362 - i * 8) / 12) + bump((f - 382 - i * 8) / 12));
						return (
							<div
								key={i}
								style={{
									...abs(L.dotsX + i * 20 - 6, dotsY - 6 + dy, 12, 12),
									borderRadius: 6,
									background: '#ffffff',
									opacity: dotsO,
								}}
							/>
						);
				  })
				: null}
		</div>
	);
};

