// Change the name in one place:
export const MODEL_FAMILY = 'Gemini 4';
export const MODEL_NAME = 'Neon';

import React from 'react';
import {AbsoluteFill, Img, staticFile, useCurrentFrame} from 'remotion';
import {CameraMotionBlur} from '@remotion/motion-blur';
import './fonts';
import {FLEX} from './fonts';
import {Layout, lockupGeometry} from './layout';
import {World} from './World';
import {AppUI, IntroSpark} from './AppUI';
import {NeonHalo, NeonIcons, Particles} from './Neon';
import {Glint} from './Glint';
import {easeInOutCubic, easeOutCubic, tween} from './timing';

const Lockup: React.FC<{L: Layout}> = ({L}) => {
	const f = useCurrentFrame();
	if (f < 590) return null;
	const g = lockupGeometry(L);
	const {fontSize, sparkSize, baseline} = L.lockup;
	const wipe = tween(f, 590, 614, -2, 125, easeInOutCubic);
	const settle = 6 * (1 - tween(f, 590, 614, 0, 1, easeOutCubic));
	// line box = font size; baseline sits at 0.84em with Google Sans Flex metrics
	const ascent = (1932 / 2000) * fontSize;
	const content = ((1932 + 572) / 2000) * fontSize;
	const baselineInBox = (fontSize - content) / 2 + ascent;
	const mask = `linear-gradient(90deg, #000 ${wipe - 18}%, transparent ${wipe}%)`;
	const twinkle = Math.sin(Math.PI * tween(f, 660, 700, 0, 1, (t) => t));
	return (
		<>
			<div
				style={{
					position: 'absolute',
					left: g.x0,
					top: g.sparkCy - sparkSize,
					width: g.total + 4,
					height: sparkSize * 2,
					transform: `translateY(${settle}px)`,
					WebkitMaskImage: mask,
					maskImage: mask,
				}}
			>
				<Img
					src={staticFile('gemini-neon-assets/logos/gemini-spark-color.svg')}
					style={{position: 'absolute', left: 0, top: sparkSize / 2, width: sparkSize, height: sparkSize}}
				/>
				<div
					style={{
						position: 'absolute',
						left: sparkSize + L.lockup.gap,
						top: baseline - baselineInBox - (g.sparkCy - sparkSize),
						fontFamily: FLEX,
						fontWeight: 500,
						fontSize,
						lineHeight: `${fontSize}px`,
						color: '#ffffff',
						whiteSpace: 'nowrap',
						letterSpacing: 0,
					}}
				>
					{`${MODEL_FAMILY} ${MODEL_NAME}`}
				</div>
			</div>
			<Glint id="lockup" cx={g.sparkCx} cy={g.sparkCy + settle} size={sparkSize * 1.9} amount={twinkle * 0.85} rotate={0} />
		</>
	);
};

/** 1.5% monochrome grain, re-seeded every frame (deterministic). */
const Grain: React.FC<{L: Layout}> = ({L}) => {
	const f = useCurrentFrame();
	return (
		<svg width={L.W} height={L.H} style={{position: 'absolute', left: 0, top: 0, mixBlendMode: 'overlay', opacity: 0.11}}>
			<filter id="grain" x="0" y="0" width="100%" height="100%">
				<feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves={2} seed={(f * 7919) % 100000} stitchTiles="stitch" />
				<feColorMatrix type="saturate" values="0" />
			</filter>
			<rect width={L.W} height={L.H} filter="url(#grain)" />
		</svg>
	);
};

/** UI blurs out (0 -> 30px) as the aurora floods the frame; camera motion blur only here. */
const UILayer: React.FC<{L: Layout}> = ({L}) => {
	const f = useCurrentFrame();
	if (f >= 422) return null;
	const out = tween(f, 396, 420, 0, 1, easeInOutCubic);
	return (
		<AbsoluteFill
			style={{
				opacity: 1 - out,
				filter: out > 0 ? `blur(${30 * out}px)` : undefined,
				transform: `translateY(${-70 * out}px) scale(${1 + 0.05 * out})`,
			}}
		>
			<AppUI L={L} />
		</AbsoluteFill>
	);
};

export const NeonFilm: React.FC<{L: Layout}> = ({L}) => {
	const f = useCurrentFrame();
	const blurWindow = f >= 398 && f < 422;
	return (
		<AbsoluteFill style={{background: '#000', overflow: 'hidden'}}>
			<World L={L} />
			<Particles L={L} />
			<NeonHalo L={L} />
			<NeonIcons L={L} />
			<IntroSpark L={L} />
			{blurWindow ? (
				<CameraMotionBlur shutterAngle={240} samples={8}>
					<UILayer L={L} />
				</CameraMotionBlur>
			) : (
				<UILayer L={L} />
			)}
			<Lockup L={L} />
			<Grain L={L} />
		</AbsoluteFill>
	);
};
