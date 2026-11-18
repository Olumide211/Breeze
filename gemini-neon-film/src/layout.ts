export type Layout = {
	id: 'vertical' | 'square';
	W: number;
	H: number;
	// scene 1-2
	sparkCenter: [number, number];
	sparkSize: number;
	pillOpenY: number; // centre y where the line opens into the pill
	pillBottom: number; // bottom edge of the box after it glides home
	// scene 5
	bubbleTop: number;
	bubbleRight: number;
	dotsX: number;
	// scene 6-7: hero "4" while it forms / ignites (x,y = centre of the tube's bbox, h = height)
	fourForm: {x: number; y: number; h: number};
	// scene 8 final
	fourFinal: {x: number; y: number; h: number};
	icons: [number, number][];
	iconSize: number;
	lockup: {
		sparkSize: number;
		fontSize: number;
		gap: number;
		// left edge of the lockup (null = centred) and baseline y
		left: number | null;
		baseline: number;
	};
};

// Real widths measured with Google Sans Flex 500 (scripts/measure.mjs)
export const LOCKUP_TEXT_WIDTH_PER_PX = 480.165 / 70; // "Gemini 4 Neon"
export const CAP_HEIGHT = 1432 / 2000;

const arc = (cx: number, cy: number, rx: number, ry: number, degs: number[]): [number, number][] =>
	degs.map((d) => [cx + rx * Math.cos((d * Math.PI) / 180), cy + ry * Math.sin((d * Math.PI) / 180)]);

export const VERTICAL: Layout = {
	id: 'vertical',
	W: 1080,
	H: 1920,
	sparkCenter: [540, 900],
	sparkSize: 220,
	pillOpenY: 900,
	pillBottom: 1560,
	bubbleTop: 300,
	bubbleRight: 1008,
	dotsX: 92,
	fourForm: {x: 540, y: 820, h: 640},
	fourFinal: {x: 540, y: 760, h: 620},
	// gentle arc below and around the "4" (y grows downward)
	icons: arc(540, 820, 420, 450, [162, 130, 101, 79, 50, 18]),
	iconSize: 110,
	lockup: {sparkSize: 62, fontSize: 70, gap: 20, left: null, baseline: 1330},
};

export const SQUARE: Layout = {
	id: 'square',
	W: 1080,
	H: 1080,
	sparkCenter: [540, 540],
	sparkSize: 200,
	pillOpenY: 540,
	pillBottom: 1000,
	bubbleTop: 120,
	bubbleRight: 1008,
	dotsX: 92,
	fourForm: {x: 720, y: 540, h: 600},
	// Spec asks for (760,540) ~580 tall, but at that size the "4" (415px wide incl. tube)
	// would touch the 555px-wide lockup. Nudged right and slightly smaller so there is
	// clear air between them and the electrode cap stays inside the 72px margin.
	fourFinal: {x: 795, y: 540, h: 540},
	// arc around the left and lower side of the "4"
	icons: arc(720, 540, 415, 415, [78, 108, 138, 168, 198, 228]),
	iconSize: 110,
	lockup: {sparkSize: 54, fontSize: 60, gap: 17, left: 72, baseline: 540 + (60 * CAP_HEIGHT) / 2},
};

export const lockupGeometry = (L: Layout) => {
	const {sparkSize, fontSize, gap, left, baseline} = L.lockup;
	const textW = LOCKUP_TEXT_WIDTH_PER_PX * fontSize;
	const total = sparkSize + gap + textW;
	const x0 = left ?? (L.W - total) / 2;
	const cap = fontSize * CAP_HEIGHT;
	return {
		x0,
		total,
		textW,
		textX: x0 + sparkSize + gap,
		sparkCx: x0 + sparkSize / 2,
		sparkCy: baseline - cap / 2,
		rect: {x: x0, y: baseline - cap - 10, w: total, h: cap + 30},
	};
};
