/**
 * Volleyball rotation logic.
 *
 * Rotation slots 1-6 correspond to court positions:
 *   1 = Right Back (server position)
 *   2 = Right Front
 *   3 = Middle Front
 *   4 = Left Front
 *   5 = Left Back
 *   6 = Middle Back
 *
 * A team rotates (slot increments by 1, wrapping 6→1) when they WIN a sideout
 * (they were the RECEIVING team and won the point, gaining the serve).
 */

/** Advance rotation: (current % 6) + 1, wrapping 6 → 1 */
export function advanceRotation(current: number): number {
  return (current % 6) + 1
}

/**
 * Given the result of a rally, compute the next rotations for both teams.
 * @param servingTeamId - which team served this rally
 * @param winningTeamId - which team won the point
 * @param homeTeamId - the home team's ID
 * @param homeRotation - current home team rotation (1-6)
 * @param awayRotation - current away team rotation (1-6)
 */
export function computeNextRotations(
  servingTeamId: string | null,
  winningTeamId: string | null,
  homeTeamId: string,
  homeRotation: number,
  awayRotation: number
): { nextHomeRotation: number; nextAwayRotation: number; nextServingTeamId: string | null } {
  const homeIsServing = servingTeamId === homeTeamId
  const homeWon = winningTeamId === homeTeamId

  // Sideout: receiving team wins the point → they get serve next AND rotate
  const homeSideout = !homeIsServing && homeWon
  const awaySideout = homeIsServing && !homeWon

  return {
    nextHomeRotation: homeSideout ? advanceRotation(homeRotation) : homeRotation,
    nextAwayRotation: awaySideout ? advanceRotation(awayRotation) : awayRotation,
    nextServingTeamId: winningTeamId,
  }
}
