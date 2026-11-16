// On-screen credits: a small tracked role line over the name, held for a whole shot and cut with it.
import '@fontsource/montserrat/500.css';
import '@fontsource/montserrat/700.css';
import React from 'react';
import {AbsoluteFill, useVideoConfig} from 'remotion';
import {CREDITS, creditWindow, FPS, type Credit} from './timeline';

const smooth = (a: number, b: number, v: number) => {
	const t = Math.min(1, Math.max(0, (v - a) / (b - a)));
	return t * t * (3 - 2 * t);
};

export const CreditCard: React.FC<{credit: Credit; opacity?: number}> = ({credit, opacity = 1}) => {
	const {width, height} = useVideoConfig();
	const k = width / 3840;
	const shadow = `0 0 ${26 * k}px rgba(0,0,10,0.55), 0 ${3 * k}px ${8 * k}px rgba(0,0,10,0.5)`;
	return (
		<AbsoluteFill style={{opacity, color: '#fff', fontFamily: 'Montserrat, sans-serif'}}>
			<div style={{position: 'absolute', left: credit.x * width, top: credit.y * height, transform: 'translate(-50%, -50%)', textAlign: 'center', whiteSpace: 'nowrap', textShadow: shadow}}>
				<div style={{fontWeight: 500, fontSize: 56 * k, letterSpacing: '0.42em', marginRight: '-0.42em', textTransform: 'uppercase', lineHeight: 1}}>{credit.role}</div>
				<div style={{fontWeight: 700, fontSize: 88 * k, letterSpacing: '0.34em', marginRight: '-0.34em', marginTop: 26 * k, lineHeight: 1}}>{credit.name}</div>
			</div>
		</AbsoluteFill>
	);
};

// The credit that belongs to this frame, if any. The first one fades in with the picture.
export const Credits: React.FC<{frame: number}> = ({frame}) => {
	const t = frame / FPS;
	const credit = CREDITS.find((c) => {
		const [a, b] = creditWindow(c);
		return t >= a && t < b;
	});
	if (!credit) return null;
	return <CreditCard credit={credit} opacity={smooth(0, 0.9, t)} />;
};
