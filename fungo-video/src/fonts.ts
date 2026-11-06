import {loadFont} from '@remotion/fonts';
import {staticFile} from 'remotion';
import {FONTS} from './config';

const faces: [string, string, string][] = [
  [FONTS.headline, '500', 'fonts/space-grotesk-latin-500-normal.woff2'],
  [FONTS.headline, '700', 'fonts/space-grotesk-latin-700-normal.woff2'],
  [FONTS.mono, '400', 'fonts/jetbrains-mono-latin-400-normal.woff2'],
  [FONTS.mono, '500', 'fonts/jetbrains-mono-latin-500-normal.woff2'],
  [FONTS.mono, '700', 'fonts/jetbrains-mono-latin-700-normal.woff2'],
];

for (const [family, weight, file] of faces) {
  loadFont({family, url: staticFile(file), weight, format: 'woff2'});
}
