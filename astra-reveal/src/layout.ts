import {createContext, useContext} from 'react';

// Everything that differs between the 9:16 and 1:1 cuts. Timing is shared (timeline.ts).

export type TitleWord = {
  size: number;
  x: number; // left edge (left word) or right edge (right word)
  capTop?: number; // left word
  baseline?: number; // right word
};

export type Layout = {
  id: 'vertical' | 'square';
  W: number;
  H: number;
  blossom: {size: number; cx: number; cy: number};
  line: {w: number; startY: number}; // line grows at startY (the blossom centre)
  box: {cy: number}; // box bottom edge is fixed at cy + 72 when it grows for a 2nd line
  bubble: {right: number; cy: number; maxW: number};
  dot: {x0: number; y0: number; x1: number; y1: number}; // appears at (x0,y0), glides to (x1,y1)
  galaxy: {
    form: {x: number; y: number}; // birth point (= where the dot ends)
    hero: {x: number; y: number}; // settled hero position
    diamWide: number;
    diamHero: number;
  };
  icons: {back: number; front: number};
  titleLeft: TitleWord;
  titleRight: TitleWord;
  tagline: {
    anchor: 'underLeft' | 'underRight';
    size: number;
    gap: number; // px from the title's baseline to the tagline's cap top
  };
  endBlossom: {size: number; x: number; y: number}; // top-left corner
  stars: number;
};

// Inter Display SemiBold: ascent .9667em, descent .24em, cap .74em (measured).
export const displayMetrics = (size: number) => ({
  baselineInLineBox: (size - 1.2067 * size) / 2 + 0.9667 * size,
  cap: 0.74 * size,
});
// Inter Medium/Regular: ascent .96875em, descent .2422em, cap .727em.
export const interMetrics = (size: number, lineHeight: number) => {
  const baseline = (lineHeight - 1.2109 * size) / 2 + 0.96875 * size;
  return {baselineInLineBox: baseline, capTopInLineBox: baseline - 0.727 * size};
};

export const VERTICAL: Layout = {
  id: 'vertical',
  W: 1080,
  H: 1920,
  blossom: {size: 220, cx: 540, cy: 960},
  line: {w: 920, startY: 960},
  box: {cy: 960},
  bubble: {right: 990, cy: 960 - 220, maxW: 760},
  dot: {x0: 99, y0: 960 - 220 + 50 + 62, x1: 540, y1: 960},
  galaxy: {form: {x: 540, y: 960}, hero: {x: 540, y: 900}, diamWide: 900, diamHero: 860},
  icons: {back: 72, front: 150},
  // Spec: cap top 300 / baseline 1520. Moved in so the end-card blossom and tagline
  // stay inside the 260–1560 safe area (see README).
  titleLeft: {size: 150, x: 90, capTop: 360},
  titleRight: {size: 150, x: 990, baseline: 1460},
  tagline: {anchor: 'underRight', size: 30, gap: 37},
  endBlossom: {size: 56, x: 90, y: 360 - 40 - 56},
  stars: 1600,
};

const SQ_TITLE = 118;
const SQ_ASTRA_BASELINE = 1000;
export const SQUARE: Layout = {
  id: 'square',
  W: 1080,
  H: 1080,
  blossom: {size: 200, cx: 540, cy: 540},
  line: {w: 920, startY: 540},
  box: {cy: 600},
  bubble: {right: 1008, cy: 430, maxW: 760},
  dot: {x0: 81, y0: 430 + 50 + 56, x1: 540, y1: 540},
  galaxy: {form: {x: 540, y: 540}, hero: {x: 540, y: 560}, diamWide: 640, diamHero: 600},
  icons: {back: 56, front: 110},
  titleLeft: {size: SQ_TITLE, x: 72, capTop: 84},
  titleRight: {size: SQ_TITLE, x: 1008, baseline: SQ_ASTRA_BASELINE},
  tagline: {anchor: 'underLeft', size: 26, gap: 18},
  // 44px mark, bottom-left, centred on the cap-height middle of the "Astra" row
  endBlossom: {size: 44, x: 72, y: SQ_ASTRA_BASELINE - (0.74 * SQ_TITLE) / 2 - 22},
  stars: 900,
};

export const LayoutContext = createContext<Layout>(VERTICAL);
export const useLayout = () => useContext(LayoutContext);
