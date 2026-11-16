import React from 'react';
import {AbsoluteFill, Composition} from 'remotion';
import {Film} from './Film';
import {DURATION, FPS, HEIGHT, TITLE_START, WIDTH} from './timeline';
import {Title} from './Title';
import {useCurrentFrame} from 'remotion';

// Title on a transparent background, rendered natively at 4K and composited over the film.
const TitleOnly: React.FC = () => <Title frame={useCurrentFrame() + TITLE_START} />;

// Used by scripts/render.mjs to test whether the requested GL backend can create a context.
const GlProbe: React.FC = () => {
	if (typeof document !== 'undefined') {
		const gl = document.createElement('canvas').getContext('webgl2');
		if (!gl) throw new Error('WebGL2 context could not be created');
	}
	return <AbsoluteFill style={{backgroundColor: '#000'}} />;
};

export const Root: React.FC = () => (
	<>
		<Composition id="Resonance" component={Film} width={WIDTH} height={HEIGHT} fps={FPS} durationInFrames={DURATION} defaultProps={{subframes: 1}} />
		<Composition id="TitleOnly" component={TitleOnly} width={WIDTH} height={HEIGHT} fps={FPS} durationInFrames={DURATION - TITLE_START} />
		<Composition id="GlProbe" component={GlProbe} width={320} height={180} fps={FPS} durationInFrames={1} />
	</>
);
