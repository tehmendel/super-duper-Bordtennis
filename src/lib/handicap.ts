// Rough handicap heuristic for casual/uneven matches: roughly 1 point of
// head start per 25 rating difference, capped just under the game point.
export function suggestedHandicap(ratingA: number, ratingB: number, gamePoint = 11) {
  const diff = Math.abs(ratingA - ratingB)
  const points = Math.min(Math.round(diff / 25), gamePoint - 1)
  return points
}
