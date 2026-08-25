// Categorical series palette (light mode), validated with the dataviz skill's
// checker: lightness band, chroma floor, adjacent CVD separation and
// normal-vision floor all PASS. Three slots sit below 3:1 contrast on a light
// surface, which is why every chart here carries direct labels and a table view.
//
// Order is the colorblind-safety mechanism, not cosmetics. Do not reorder, and
// never generate a 9th hue — fold the tail into OTHER instead.
export const SERIES_COLORS = [
  '#2a78d6', // blue
  '#eb6834', // orange
  '#1baf7a', // aqua
  '#eda100', // yellow
  '#e87ba4', // magenta
  '#008300', // green
  '#4a3aa7', // violet
  '#e34948', // red
] as const

export const OTHER_COLOR = '#9ca3af'
export const TRACK_COLOR = '#e5e7eb'

// Slots are pinned to the initiative, never to its rank — so re-sorting the
// ranking chart or filtering the list never repaints the survivors.
export function assignColors(ids: string[]): Record<string, string> {
  const stable = [...ids].sort()
  const map: Record<string, string> = {}
  stable.forEach((id, i) => {
    map[id] = SERIES_COLORS[i] ?? OTHER_COLOR
  })
  return map
}
