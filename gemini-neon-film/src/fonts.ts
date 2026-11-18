import {loadFont} from '@remotion/fonts';
import {continueRender, delayRender, staticFile} from 'remotion';

export const FLEX = 'Google Sans Flex';
export const SANS = 'Google Sans';

const flexWeights = [100, 200, 300, 400, 500, 600, 700, 800, 900];
const sansWeights = [400, 500, 600, 700];

const handle = delayRender('Loading Google Sans fonts');
Promise.all([
	...flexWeights.map((w) =>
		loadFont({
			family: FLEX,
			url: staticFile(`gemini-neon-assets/fonts/google-sans-flex/google-sans-flex-latin-${w}-normal.woff2`),
			weight: String(w),
		}),
	),
	...sansWeights.map((w) =>
		loadFont({
			family: SANS,
			url: staticFile(`gemini-neon-assets/fonts/google-sans/google-sans-latin-${w}-normal.woff2`),
			weight: String(w),
		}),
	),
])
	.then(() => continueRender(handle))
	.catch((e) => {
		console.error(e);
		continueRender(handle);
	});
