import {Config} from '@remotion/cli/config';

// PNG frames avoid JPEG artefacts in the dark gradients before the final encode.
Config.setVideoImageFormat('png');
Config.setOverwriteOutput(true);
// WebGL: 'angle' uses the GPU when there is one. On a GPU-less Linux box pass --gl=swangle.
Config.setChromiumOpenGlRenderer('angle');
