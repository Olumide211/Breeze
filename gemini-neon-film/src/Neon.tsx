import React, {useMemo} from 'react';
import {random, useCurrentFrame} from 'remotion';
import {FLEX} from './fonts';
import {Layout, lockupGeometry} from './layout';
import {distToFour, fourTransform, projectedPolyline, TUBE_R} from './fourPath';
import {ICON_ORDER, ICON_PATHS} from './iconPaths';
import {easeOutCubic, electrodeLevel, iconGlass, iconLevel, neonLevel, tween} from './timing';

const toPath = (pts: [number, number][]) =>
	pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`).join(' ');

/**
 * Bloom for the big neon "4": the halo is the 2D projection of the exact same
 * centre line the 3D tube is built on, stroked and blurred at three radii and
 * screen-blended. The wide pink-red halo is also the ~300px warm light spill
 * on the background; the blue world stays blue beyond it.
 */
export const NeonHalo: React.FC<{L: Layout}> = ({L}) => {
	const f = useCurrentFrame();
	if (f < 480) return null;
	const t = fourTransform(L, f);
	const pts = projectedPolyline(t);
	const d = toPath(pts);
	const N = neonLevel(f);
	const E = electrodeLevel(f);
	const r = TUBE_R * t.h;
	const ends = [pts[0], pts[pts.length - 1]];
	return (
		<>
			{/* warm light spill (~300px): normal blend so the blue is genuinely replaced by warmth */}
			<svg width={L.W} height={L.H} style={{position: 'absolute', left: 0, top: 0}}>
				<defs>
					<filter id="h-spill" filterUnits="userSpaceOnUse" x={-L.W} y={-L.H} width={L.W * 3} height={L.H * 3}>
						<feGaussianBlur stdDeviation={85} />
					</filter>
				</defs>
				<path d={d} fill="none" stroke="#ff5a2a" strokeWidth={r * 9} strokeLinecap="round" strokeLinejoin="round" opacity={0.34 * Math.min(1, N)} filter="url(#h-spill)" />
			</svg>
			<svg width={L.W} height={L.H} style={{position: 'absolute', left: 0, top: 0, mixBlendMode: 'screen'}}>
				<defs>
					<filter id="h-mid" filterUnits="userSpaceOnUse" x={-L.W} y={-L.H} width={L.W * 3} height={L.H * 3}>
						<feGaussianBlur stdDeviation={34} />
					</filter>
					<filter id="h-tight" filterUnits="userSpaceOnUse" x={-L.W} y={-L.H} width={L.W * 3} height={L.H * 3}>
						<feGaussianBlur stdDeviation={11} />
					</filter>
				</defs>
				<g fill="none" strokeLinecap="round" strokeLinejoin="round">
					<path d={d} stroke="#ff2d55" strokeWidth={r * 4.5} opacity={0.42 * N} filter="url(#h-mid)" />
					<path d={d} stroke="#ff4a1c" strokeWidth={r * 2.2} opacity={0.34 * N} filter="url(#h-tight)" />
				</g>
				{/* electrodes catch first */}
				{ends.map(([x, y], i) => (
					<circle key={i} cx={x} cy={y} r={r * 2.2} fill="#ff4a1c" opacity={0.55 * E * (1 - Math.min(1, N))} filter="url(#h-tight)" />
				))}
			</svg>
		</>
	);
};

/** Six small neon glyphs: thin glass tubes following each icon's shape. */
export const NeonIcons: React.FC<{L: Layout}> = ({L}) => {
	const f = useCurrentFrame();
	if (f < 510 || f > 602) return null;
	const S = L.iconSize;
	const u = 960 / S; // svg units per px
	return (
		<>
			{ICON_ORDER.map((key, i) => {
				const [cx, cy] = L.icons[i];
				const lv = iconLevel(i, f);
				const gl = iconGlass(i, f);
				if (gl <= 0 && lv <= 0) return null;
				const d = ICON_PATHS[key];
				const box: React.CSSProperties = {position: 'absolute', left: cx - S, top: cy - S, width: S * 2, height: S * 2, overflow: 'visible'};
				const vb = `${-480} ${-960 - 480} ${1920} ${1920}`;
				return (
					<React.Fragment key={key}>
						{/* glass (unlit tube walls), always crisp */}
						<svg style={{...box, opacity: gl}} viewBox={vb}>
							<path d={d} fill="rgba(205,232,255,0.10)" stroke="rgba(228,244,255,0.85)" strokeWidth={1.3 * u} />
						</svg>
						{lv > 0 ? (
							<>
								<svg style={{...box, mixBlendMode: 'screen'}} viewBox={vb}>
									<defs>
										<filter id={`ib-w-${i}`} x="-100%" y="-100%" width="300%" height="300%">
											<feGaussianBlur stdDeviation={16 * u} />
										</filter>
										<filter id={`ib-m-${i}`} x="-100%" y="-100%" width="300%" height="300%">
											<feGaussianBlur stdDeviation={4 * u} />
										</filter>
									</defs>
									<path d={d} fill="#ff2d55" stroke="#ff2d55" strokeWidth={10 * u} opacity={0.42 * lv} filter={`url(#ib-w-${i})`} />
									<path d={d} fill="#ff4a1c" stroke="#ff4a1c" strokeWidth={2 * u} opacity={0.6 * lv} filter={`url(#ib-m-${i})`} />
								</svg>
								<svg style={box} viewBox={vb}>
									<defs>
										<filter id={`ic-${i}`}>
											<feMorphology operator="erode" radius={1.7 * u} />
											<feGaussianBlur stdDeviation={0.5 * u} />
										</filter>
									</defs>
									<path d={d} fill="#ff5a2a" opacity={Math.min(1, lv)} />
									<path d={d} fill="#ffd2b0" opacity={Math.min(1, lv)} filter={`url(#ic-${i})`} />
									<path d={d} fill="none" stroke="rgba(255,214,196,0.8)" strokeWidth={1.1 * u} opacity={gl * 0.7} />
								</svg>
							</>
						) : null}
					</React.Fragment>
				);
			})}
		</>
	);
};

type P = {x: number; y: number; layer: 0 | 1 | 2; born: number; speed: number; drift: number; phase: number};

/** ~90 tiny white "4" glyphs floating at three depths, rising slowly (seeded). */
export const Particles: React.FC<{L: Layout}> = ({L}) => {
	const f = useCurrentFrame();
	const parts = useMemo<P[]>(() => {
		const out: P[] = [];
		for (let i = 0; i < 90; i++) {
			const r = (k: string) => random(`p-${k}-${i}`);
			const layer: 0 | 1 | 2 = i < 18 ? 0 : i < 46 ? 1 : 2; // near / mid / far
			// ~55% cluster around the hero like Carbon / Hydrogen, the rest anywhere
			let x: number, y: number;
			if (r('c') < 0.72) {
				const a = r('a') * Math.PI * 2;
				const rad = 250 + r('r') * 280;
				x = L.fourFinal.x + Math.cos(a) * rad * 0.8;
				y = L.fourFinal.y + Math.sin(a) * rad + 90;
			} else {
				x = 40 + r('x') * (L.W - 80);
				y = 40 + r('y') * (L.H + 120);
			}
			out.push({x, y, layer, born: 410 + r('b') * 56, speed: [0.42, 0.26, 0.14][layer] * (0.7 + 0.6 * r('s')), drift: (r('d') - 0.5) * 0.12, phase: r('ph') * 6.28});
		}
		return out;
	}, [L]);
	if (f < 410) return null;
	const t4 = fourTransform(L, f);
	const pts = projectedPolyline(t4);
	const N = Math.min(1, neonLevel(f));
	const lk = lockupGeometry(L).rect;
	const lockupOn = tween(f, 576, 600);
	const sizes = [16, 13, 18];
	const blurs = [0, 1.3, 4.2];
	const alphas = [0.95, 0.7, 0.22];
	return (
		<>
			{parts.map((p, i) => {
				const age = f - p.born;
				if (age < 0) return null;
				const appear = tween(age, 0, 26, 0, 1, easeOutCubic);
				const x = p.x + p.drift * age + 6 * Math.sin(age / 70 + p.phase);
				const y = p.y - p.speed * (f - 410);
				// keep the final lockup clean
				const dx = Math.max(lk.x - x, 0, x - (lk.x + lk.w));
				const dy = Math.max(lk.y - y, 0, y - (lk.y + lk.h));
				const clear = 1 - lockupOn * (1 - Math.min(1, Math.hypot(dx, dy) / 60));
				const dist = distToFour(x, y, pts);
				const warm = N * Math.max(0, 1 - dist / 300) ** 1.6;
				const col = `rgb(255, ${Math.round(255 - 120 * warm)}, ${Math.round(255 - 150 * warm)})`;
				const s = sizes[p.layer] * (0.85 + 0.15 * appear);
				return (
					<div
						key={i}
						style={{
							position: 'absolute',
							left: x - s * 0.3,
							top: y - s * 0.5,
							fontFamily: FLEX,
							fontWeight: 500,
							fontSize: s,
							lineHeight: 1,
							color: col,
							opacity: alphas[p.layer] * appear * clear * (1 + 0.25 * warm),
							filter: blurs[p.layer] ? `blur(${blurs[p.layer]}px)` : undefined,
						}}
					>
						4
					</div>
				);
			})}
		</>
	);
};
