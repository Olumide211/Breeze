import {loadFont} from '@remotion/fonts';
import {continueRender, delayRender, staticFile} from 'remotion';

const base = 'astra-assets/fonts/Inter/';
const handle = delayRender('Loading Inter + Inter Display');

Promise.all([
  loadFont({family: 'Inter', url: staticFile(base + 'woff2/Inter-Regular.woff2'), weight: '400'}),
  loadFont({family: 'Inter', url: staticFile(base + 'woff2/Inter-Medium.woff2'), weight: '500'}),
  loadFont({family: 'Inter', url: staticFile(base + 'woff2/Inter-SemiBold.woff2'), weight: '600'}),
  loadFont({family: 'Inter Display', url: staticFile(base + 'otf/InterDisplay-SemiBold.otf'), weight: '600', format: 'opentype'}),
])
  .then(() => continueRender(handle))
  .catch((err) => {
    console.error(err);
    continueRender(handle);
  });
