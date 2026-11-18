import {KEY_FRAMES, TYPED_TEXT, GROW_FRAME} from '../src/timing';
console.log(JSON.stringify({grow: GROW_FRAME, keys: KEY_FRAMES.map((f, i) => [TYPED_TEXT[i], f])}));
