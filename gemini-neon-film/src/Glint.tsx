import React from 'react';

/**
 * A thin four-point glint. Bloom is allowed here (spec: bloom only on the neon
 * and the spark's twinkle), so it has a soft blurred copy under a crisp one.
 */
export const Glint: React.FC<{
	cx: number;
	cy: number;
	size: number;
	amount: number; // 0..1
	rotate?: number;
	id: string;
}> = ({cx, cy, size, amount, rotate = 0, id}) => {
	if (amount <= 0.001) return null;
	const s = size;
	const ray = (w: number) =>
		`M ${-s / 2} 0 Q 0 ${-w} ${s / 2} 0 Q 0 ${w} ${-s / 2} 0 Z M 0 ${-s / 2} Q ${w} 0 0 ${s / 2} Q ${-w} 0 0 ${-s / 2} Z`;
	return (
		<svg
			width={s * 2}
			height={s * 2}
			viewBox={`${-s} ${-s} ${s * 2} ${s * 2}`}
			style={{
				position: 'absolute',
				left: cx - s,
				top: cy - s,
				transform: `rotate(${rotate}deg) scale(${0.35 + 0.65 * amount})`,
				opacity: amount,
				mixBlendMode: 'screen',
				overflow: 'visible',
			}}
		>
			<defs>
				<filter id={`gb-${id}`} x="-100%" y="-100%" width="300%" height="300%">
					<feGaussianBlur stdDeviation={s * 0.045} />
				</filter>
				<radialGradient id={`gc-${id}`}>
					<stop offset="0" stopColor="#ffffff" stopOpacity="0.9" />
					<stop offset="1" stopColor="#ffffff" stopOpacity="0" />
				</radialGradient>
			</defs>
			<circle r={s * 0.09} fill={`url(#gc-${id})`} />
			<path d={ray(s * 0.035)} fill="#ffffff" opacity={0.4} filter={`url(#gb-${id})`} />
			<path d={ray(s * 0.008)} fill="#ffffff" />
		</svg>
	);
};
