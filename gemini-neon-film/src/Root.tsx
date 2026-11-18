import React from 'react';
import {Composition} from 'remotion';
import {NeonFilm} from './NeonFilm';
import {SQUARE, VERTICAL} from './layout';
import {DURATION, FPS} from './timing';

export const Root: React.FC = () => (
	<>
		<Composition id="NeonVertical" component={NeonFilm} durationInFrames={DURATION} fps={FPS} width={1080} height={1920} defaultProps={{L: VERTICAL}} />
		<Composition id="NeonSquare" component={NeonFilm} durationInFrames={DURATION} fps={FPS} width={1080} height={1080} defaultProps={{L: SQUARE}} />
	</>
);
