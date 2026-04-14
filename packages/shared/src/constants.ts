export const POSITIONS = ['OH', 'MB', 'RS', 'S', 'L', 'DS'] as const

export const MATCH_FORMATS = ['bo3', 'bo5'] as const
export const MATCH_FORMAT_LABELS: Record<string, string> = {
  bo3: 'Best of 3',
  bo5: 'Best of 5',
}
// Number of set wins required to win a match for each format
export const MATCH_FORMAT_WIN_THRESHOLD: Record<string, number> = {
  bo3: 2,
  bo5: 3,
}

export const POSITION_LABELS: Record<string, string> = {
  OH: 'Outside Hitter',
  MB: 'Middle Blocker',
  RS: 'Right Side',
  S: 'Setter',
  L: 'Libero',
  DS: 'Defensive Specialist',
}

// Serve quality: from the server's perspective (how hard for opponent to pass)
export const SERVE_QUALITY_LABELS: Record<number, string> = {
  0: 'Serve Error',
  1: 'Easy Pass',
  2: 'Pressured',
  3: 'Out of System',
  4: 'Ace',
}

// Serve receive quality: how well the receiver handled the serve (0=aced, 3=perfect)
export const RECEPTION_QUALITY_LABELS: Record<number, string> = {
  0: 'Aced (No Touch)',
  1: 'Poor (Out of System)',
  2: 'Good (In System)',
  3: 'Perfect',
}

// Pass quality: receiving an attack or freeball (0=error/dropped, 3=perfect)
export const PASS_QUALITY_LABELS: Record<number, string> = {
  0: 'Error (Dropped)',
  1: 'Poor (Out of System)',
  2: 'Good (In System)',
  3: 'Perfect',
}

// Net zones 1-9: left pin (1) → right pin (9) from the attacking team's perspective
// Zone 5 = middle, 3-4 = gap area (31 sets), 1-2 = outside left, 7-9 = right side
export const NET_ZONE_LABELS: Record<number, string> = {
  1: 'Left Pin (4)',
  2: 'Outside-Left',
  3: 'Gap',
  4: '31 / A-ball',
  5: 'Middle (1)',
  6: 'Right-Middle',
  7: 'Right-Gap',
  8: 'Right Side',
  9: 'Right Pin',
}

// Back row attack zones (standard court zones)
export const BACK_ROW_ZONES = [
  { zone: 5, label: 'Left Back (Pipe-L)' },
  { zone: 6, label: 'Middle Back (Pipe)' },
  { zone: 1, label: 'Right Back (Bic)' },
] as const

export const SET_TYPES = ['quick', 'outside', 'right_side', 'pipe', 'back_row', 'other'] as const

export const SET_TYPE_LABELS: Record<string, string> = {
  quick: 'Quick (1-ball)',
  outside: 'Outside',
  right_side: 'Right Side',
  pipe: 'Pipe',
  back_row: 'Back Row',
  other: 'Other',
}

export const SET_QUALITY_OPTIONS = ['on_target', 'tight', 'off_net', 'error'] as const

export const SET_QUALITY_LABELS: Record<string, string> = {
  on_target: 'On Target',
  tight: 'Tight (Close to Net)',
  off_net: 'Off Net (Too Far)',
  error: 'Setting Error',
}

export const ATTACK_RESULTS = ['kill', 'error', 'in_play', 'blocked'] as const

export const ATTACK_RESULT_LABELS: Record<string, string> = {
  kill: 'Kill',
  error: 'Attack Error',
  in_play: 'In Play',
  blocked: 'Blocked',
}

export const BLOCK_RESULTS = ['solo_block', 'assisted_block', 'block_touch', 'block_error'] as const

export const BLOCK_RESULT_LABELS: Record<string, string> = {
  solo_block: 'Solo Block',
  assisted_block: 'Assisted Block',
  block_touch: 'Block Touch',
  block_error: 'Block Error',
}

export const DIG_RESULTS = ['good_dig', 'poor_dig', 'no_dig'] as const

export const DIG_RESULT_LABELS: Record<string, string> = {
  good_dig: 'Good Dig (Playable)',
  poor_dig: 'Poor Dig (Not Playable)',
  no_dig: 'No Dig (Ball Dropped)',
}

export const ACTION_TYPES = ['serve', 'reception', 'pass', 'set', 'attack', 'dig', 'block', 'overpass'] as const

export const PASS_CONTEXTS = ['dig', 'freeball', 'block_cover'] as const

export const PASS_CONTEXT_LABELS: Record<string, string> = {
  dig: 'Dig',
  freeball: 'Freeball',
  block_cover: 'Block Cover',
}

export const FREEBALL_RESULTS = ['over', 'error'] as const

export const FREEBALL_RESULT_LABELS: Record<string, string> = {
  over: 'Over (Playable)',
  error: 'Error (Net / Out)',
}

export const POINT_TYPES = ['kill', 'ace', 'block', 'error', 'other'] as const

/**
 * Returns true when a set is over: win threshold reached with a 2-point lead.
 * Set 5 (deciding set) is first to 15; all others are first to 25.
 */
export function isSetComplete(homeScore: number, awayScore: number, setNumber: number): boolean {
  const target = setNumber >= 5 ? 15 : 25
  const maxScore = Math.max(homeScore, awayScore)
  const diff = Math.abs(homeScore - awayScore)
  return maxScore >= target && diff >= 2
}

// Court SVG coordinate system:
// Width = 900, Height = 450 (18m x 9m scaled 50px/m)
// Y=0 is top (opponent side), Y=450 is bottom (our side)
// Net is at Y=225
export const COURT = {
  WIDTH: 900,
  HEIGHT: 450,
  NET_Y: 225,
  // Our half: Y=225 to Y=450
  // Opponent half: Y=0 to Y=225
} as const
