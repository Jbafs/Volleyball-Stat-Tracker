import { create } from 'zustand'
import type { LineupSlot } from '@vst/shared'

interface MatchState {
  matchId: string | null
  setId: string | null
  setNumber: number
  homeTeamId: string | null
  awayTeamId: string | null
  homeScore: number
  awayScore: number
  homeRotation: number
  awayRotation: number
  servingTeamId: string | null

  // Lineup tracking (raw D1 rows with player data joined)
  homeLineup: LineupSlot[]
  awayLineup: LineupSlot[]

  setActiveMatch: (matchId: string, homeTeamId: string | null, awayTeamId: string | null) => void
  setActiveSet: (setId: string, setNumber: number, homeRot: number, awayRot: number, servingTeamId: string | null, homeScore: number, awayScore: number) => void
  applyRallyResult: (result: {
    nextHomeRotation: number
    nextAwayRotation: number
    nextServingTeamId: string | null
    homeScore: number
    awayScore: number
  }) => void
  setHomeLineup: (lineup: LineupSlot[]) => void
  setAwayLineup: (lineup: LineupSlot[]) => void
  applySubstitution: (
    teamId: string,
    rotationSlot: number,
    newPlayer: { id: string; name: string; number: number | null; position: string }
  ) => void
  syncScores: (homeScore: number, awayScore: number) => void
  reset: () => void
}

export const useMatchStore = create<MatchState>((set) => ({
  matchId: null,
  setId: null,
  setNumber: 1,
  homeTeamId: null,
  awayTeamId: null,
  homeScore: 0,
  awayScore: 0,
  homeRotation: 1,
  awayRotation: 1,
  servingTeamId: null,
  homeLineup: [],
  awayLineup: [],

  setActiveMatch: (matchId, homeTeamId, awayTeamId) =>
    set({ matchId, homeTeamId, awayTeamId }),

  setActiveSet: (setId, setNumber, homeRot, awayRot, servingTeamId, homeScore, awayScore) =>
    set({ setId, setNumber, homeRotation: homeRot, awayRotation: awayRot, servingTeamId, homeScore, awayScore }),

  applyRallyResult: (result) =>
    set({
      homeRotation: result.nextHomeRotation,
      awayRotation: result.nextAwayRotation,
      servingTeamId: result.nextServingTeamId,
      homeScore: result.homeScore,
      awayScore: result.awayScore,
    }),

  setHomeLineup: (lineup) => set({ homeLineup: lineup }),
  setAwayLineup: (lineup) => set({ awayLineup: lineup }),

  applySubstitution: (teamId, rotationSlot, newPlayer) =>
    set((s) => {
      const isHome = teamId === s.homeTeamId
      const lineup = isHome ? s.homeLineup : s.awayLineup
      const slotExists = lineup.some((sl) => sl.rotation_slot === rotationSlot)
      let updated: LineupSlot[]
      if (slotExists) {
        updated = lineup.map((sl) =>
          sl.rotation_slot === rotationSlot
            ? { ...sl, player_id: newPlayer.id, name: newPlayer.name, number: newPlayer.number, position: newPlayer.position }
            : sl
        )
      } else {
        // Slot not in lineup yet — add it
        updated = [
          ...lineup,
          {
            id: `sub-${Date.now()}`,
            set_id: s.setId ?? '',
            team_id: teamId,
            player_id: newPlayer.id,
            rotation_slot: rotationSlot,
            name: newPlayer.name,
            number: newPlayer.number,
            position: newPlayer.position,
            created_at: Date.now(),
          },
        ]
      }
      return isHome ? { homeLineup: updated } : { awayLineup: updated }
    }),

  syncScores: (homeScore, awayScore) => set({ homeScore, awayScore }),

  reset: () =>
    set({
      matchId: null, setId: null, setNumber: 1,
      homeTeamId: null, awayTeamId: null,
      homeScore: 0, awayScore: 0,
      homeRotation: 1, awayRotation: 1, servingTeamId: null,
      homeLineup: [], awayLineup: [],
    }),
}))
