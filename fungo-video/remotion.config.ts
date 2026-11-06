import {Config} from '@remotion/cli/config';

// Static files (logos, fonts, optional music.mp3, genesis/) live in ./assets
Config.setPublicDir('./assets');
Config.setEntryPoint('./src/index.ts');
Config.setVideoImageFormat('jpeg');
Config.setJpegQuality(95);
Config.setCodec('h264');
Config.setCrf(16);
Config.setPixelFormat('yuv420p');
Config.setColorSpace('bt709');
// Use the pre-installed headless Chromium (no download needed)
Config.setBrowserExecutable(
  process.env.REMOTION_BROWSER ??
    '/opt/pw-browsers/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell'
);
