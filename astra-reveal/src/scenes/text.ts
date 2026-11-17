// UI text measurement + word wrap (Inter is loaded before the first frame renders).
let ctx: CanvasRenderingContext2D | null = null;
const cache = new Map<string, number>();
export const measureUi = (s: string) => {
  const hit = cache.get(s);
  if (hit !== undefined) return hit;
  if (!ctx) ctx = document.createElement('canvas').getContext('2d')!;
  ctx.font = '400 40px Inter';
  const w = ctx.measureText(s).width;
  cache.set(s, w);
  return w;
};

// Greedy word wrap. Returns [start, end) char ranges; trailing spaces stay on their line.
export const wrapRanges = (text: string, maxW: number): Array<[number, number]> => {
  const out: Array<[number, number]> = [];
  let start = 0;
  let lastBreak = -1;
  for (let i = 0; i <= text.length; i++) {
    if (i === text.length || text[i] === ' ') {
      const w = measureUi(text.slice(start, i));
      if (w > maxW && lastBreak > start) {
        out.push([start, lastBreak + 1]);
        start = lastBreak + 1;
      }
      lastBreak = i;
    }
  }
  out.push([start, text.length]);
  return out;
};
