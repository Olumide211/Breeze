// Shot 10: "RESONANCE" ripples in like a sound wave with a glow pulse, followed by the credit.
import '@fontsource/inter/400.css';
import '@fontsource/inter/500.css';
import '@fontsource/syncopate/700.css';
import React from 'react';
import {AbsoluteFill, useVideoConfig} from 'remotion';
import {FPS, TITLE_START} from './timeline';

const clamp = (v: number, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const ease = (t: number) => 1 - Math.pow(1 - clamp(t), 3);
const WORD = 'RESONANCE';

export const Title: React.FC<{frame: number}> = ({frame}) => {
	const {width} = useVideoConfig();
	const k = width / 3840;
	const t = (frame - TITLE_START) / FPS; // seconds since the title began
	if (t < 0) return null;
	const out = 1 - clamp((t - 2.0) / 0.34);
	const pulse = Math.exp(-Math.pow((t - 0.95) / 0.22, 2)); // glow pulse once the word has landed
	// travelling waveform behind the word: a burst that settles into a hairline
	const W = 2600, H = 420, N = 180;
	let d = '';
	for (let i = 0; i <= N; i++) {
		const x = i / N;
		const front = clamp((t * 1.55 - x) / 0.22);
		const env = Math.sin(Math.PI * clamp((t * 1.55 - x) / 0.5)) * Math.exp(-Math.max(0, t - 0.2) * 2.4) * (1 - Math.pow(Math.abs(x - 0.5) * 2, 3));
		const y = H / 2 + Math.sin(x * 46 - t * 16) * env * 150 * (0.6 + 0.4 * Math.sin(x * 9 + t * 5));
		d += `${i ? 'L' : 'M'}${(x * W).toFixed(1)},${(front > 0 ? y : H / 2).toFixed(1)}`;
	}
	const lineIn = ease(t / 0.9);
	const credit = ease((t - 1.0) / 0.45);
	const osm = ease((t - 1.3) / 0.4);
	return (
		<AbsoluteFill style={{alignItems: 'center', justifyContent: 'center', opacity: out, color: '#fff'}}>
			<div style={{position: 'absolute', top: `${1080 * k - (H / 2) * k - 40 * k}px`, left: '50%', width: W * k, height: H * k, transform: 'translateX(-50%)', opacity: 0.85 * (1 - 0.55 * clamp((t - 0.9) / 0.5))}}>
				<svg viewBox={`0 0 ${W} ${H}`} width={W * k} height={H * k} style={{overflow: 'visible'}}>
					<defs>
						<linearGradient id="wave" x1="0" x2="1">
							<stop offset="0" stopColor="#35e0ff" stopOpacity="0" />
							<stop offset="0.25" stopColor="#35e0ff" />
							<stop offset="0.5" stopColor="#ffffff" />
							<stop offset="0.75" stopColor="#ff4fa3" />
							<stop offset="1" stopColor="#ff4fa3" stopOpacity="0" />
						</linearGradient>
					</defs>
					<path d={d} fill="none" stroke="url(#wave)" strokeWidth={5} strokeLinejoin="round" strokeDasharray={`${W * 1.2}`} strokeDashoffset={W * 1.2 * (1 - lineIn)} style={{filter: `drop-shadow(0 0 ${14}px rgba(80,220,255,0.9))`}} />
				</svg>
			</div>
			<div style={{display: 'flex', fontFamily: 'Syncopate, sans-serif', fontWeight: 700, fontSize: 250 * k, letterSpacing: `${0.2 + 0.1 * (1 - ease(t / 1.2))}em`, marginRight: '-0.2em', marginTop: -80 * k}}>
				{WORD.split('').map((ch, i) => {
					const lt = t - 0.1 - i * 0.055;
					const a = ease(lt / 0.32);
					// each letter rides the wave in: a decaying vertical oscillation + stretch
					const osc = Math.sin(lt * 17) * Math.exp(-Math.max(0, lt) * 5.2);
					const y = (1 - a) * 90 * k + osc * 58 * k;
					const sy = 1 + osc * 0.2;
					const glow = (22 + 70 * pulse + 40 * Math.max(0, osc)) * k;
					return (
						<span key={i} style={{display: 'inline-block', opacity: clamp(lt / 0.16), transform: `translateY(${y}px) scaleY(${sy})`, filter: `blur(${(1 - a) * 14 * k}px)`, textShadow: `0 0 ${glow}px rgba(120,220,255,${0.55 + 0.45 * pulse}), 0 0 ${glow * 2.4}px rgba(255,80,170,${0.3 + 0.4 * pulse}), 0 ${4 * k}px ${10 * k}px rgba(0,0,20,0.6)`}}>
							{ch}
						</span>
					);
				})}
			</div>
			<div style={{position: 'absolute', top: `${1080 * k + 190 * k}px`, width: '100%', textAlign: 'center', fontFamily: 'Inter, sans-serif'}}>
				<div style={{overflow: 'hidden', height: 110 * k}}>
					<div style={{transform: `translateY(${(1 - credit) * 110 * k}px)`, opacity: credit, fontSize: 62 * k, fontWeight: 500, letterSpacing: `${0.34 + 0.3 * (1 - credit)}em`, textShadow: `0 0 ${24 * k}px rgba(0,0,30,0.9)`}}>
						<span style={{opacity: 0.72, fontWeight: 400, fontSize: 44 * k, textTransform: 'uppercase'}}>Edited by</span>
						<span style={{marginLeft: '0.5em'}}>BreezeOg</span>
					</div>
				</div>
				<div style={{margin: `${18 * k}px auto 0`, width: 420 * k * credit, height: Math.max(1, 2 * k), background: 'linear-gradient(90deg, rgba(53,224,255,0), #35e0ff, #ff4fa3, rgba(255,79,163,0))'}} />
			</div>
			<div style={{position: 'absolute', bottom: 110 * k, width: '100%', textAlign: 'center', fontFamily: 'Inter, sans-serif', fontWeight: 400, fontSize: 30 * k, letterSpacing: '0.16em', opacity: 0.78 * osm, textShadow: `0 0 ${14 * k}px rgba(0,0,20,0.95)`}}>
				City data © OpenStreetMap contributors
			</div>
		</AbsoluteFill>
	);
};
