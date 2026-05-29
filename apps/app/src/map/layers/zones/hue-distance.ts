export type RGB = [number, number, number];

export const hexToRgb = (hex: string): RGB => [
  parseInt(hex.slice(1, 3), 16),
  parseInt(hex.slice(3, 5), 16),
  parseInt(hex.slice(5, 7), 16),
];

export const rgbToHue = ([r, g, b]: RGB): number => {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const d = max - min;
  if (d === 0) return 0;
  let h: number;
  if (max === rn) h = ((gn - bn) / d + 6) % 6;
  else if (max === gn) h = (bn - rn) / d + 2;
  else h = (rn - gn) / d + 4;
  return h * 60;
};

export const hueDistance = (a: number, b: number): number => {
  const d = Math.abs(a - b);
  return Math.min(d, 360 - d);
};

export const colorDistSq = (a: RGB, b: RGB): number =>
  (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2;

export const buildHueGroupMap = (
  palette: string[],
  threshold: number,
): Map<number, Set<number>> => {
  const hues = palette.map((hex) => rgbToHue(hexToRgb(hex)));
  const parent = palette.map((_, i) => i);
  const find = (i: number): number =>
    parent[i] === i ? i : (parent[i] = find(parent[i]));
  const union = (a: number, b: number) => {
    parent[find(a)] = find(b);
  };

  for (let i = 0; i < hues.length; i++) {
    for (let j = i + 1; j < hues.length; j++) {
      if (hueDistance(hues[i], hues[j]) < threshold) {
        union(i, j);
      }
    }
  }

  const groups = new Map<number, Set<number>>();
  for (let i = 0; i < palette.length; i++) {
    const root = find(i);
    if (!groups.has(root)) groups.set(root, new Set());
    groups.get(root)!.add(i);
  }

  const result = new Map<number, Set<number>>();
  for (const members of groups.values()) {
    if (members.size < 2) continue;
    for (const idx of members) result.set(idx, members);
  }
  return result;
};
