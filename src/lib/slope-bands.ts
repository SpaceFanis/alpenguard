export const TERRARIUM = 'https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png';
/** The slope bands ski tourers read on a map. Everything under 30° stays clear. */
export const SLOPE_BANDS = [
  { from: 30, to: 35, color: [242, 212, 58] },
  { from: 35, to: 40, color: [255, 138, 31] },
  { from: 40, to: 45, color: [229, 50, 45] },
  { from: 45, to: 90, color: [140, 20, 24] },
] as const;
