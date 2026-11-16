/** Seeded, stateless random helpers. Same inputs → same output, on every render. */
export const hashStr = (s: string): number => {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
};
const cache = new Map<string, number>();
export const seedOf = (s: string | number): number => {
  if (typeof s === "number") return s >>> 0;
  let v = cache.get(s);
  if (v === undefined) {
    v = hashStr(s);
    cache.set(s, v);
  }
  return v;
};
/** Random in [0,1) from up to three integers */
export const rnd = (a: number, b = 0, c = 0): number => {
  let h = (a | 0) ^ Math.imul((b | 0) + 0x9e3779b9, 0x85ebca6b) ^ Math.imul((c | 0) + 0x165667b1, 0xc2b2ae35);
  h = Math.imul(h ^ (h >>> 16), 0x45d9f3b);
  h = Math.imul(h ^ (h >>> 13), 0x45d9f3b);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
};
/** Random in [-1,1) */
export const srnd = (a: number, b = 0, c = 0) => rnd(a, b, c) * 2 - 1;
