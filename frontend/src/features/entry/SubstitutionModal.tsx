import { useState } from 'react'
import { useMatchStore } from '../../store/matchStore'
import { useTeamPlayers } from '../../api/players'
import { useCreateSubstitution } from '../../api/sets'
import type { LineupSlot } from '@vst/shared'

const SLOT_LABELS: Record<number, string> = {
  1: 'Slot 1 — Right Back',
  2: 'Slot 2 — Right Front',
  3: 'Slot 3 — Middle Front',
  4: 'Slot 4 — Left Front',
  5: 'Slot 5 — Left Back',
  6: 'Slot 6 — Middle Back',
}

interface Props {
  setId: string
  homeTeamId: string | null
  awayTeamId: string | null
  homeTeamName: string
  awayTeamName: string
  homeLineup: LineupSlot[]
  awayLineup: LineupSlot[]
  onClose: () => void
}

export function SubstitutionModal({
  setId,
  homeTeamId,
  awayTeamId,
  homeTeamName,
  awayTeamName,
  homeLineup,
  awayLineup,
  onClose,
}: Props) {
  const matchStore = useMatchStore()
  const createSub = useCreateSubstitution(setId)

  // Default to home team; if home is null, fall back to away
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(
    homeTeamId ?? awayTeamId
  )
  const [selectedSlot, setSelectedSlot] = useState<number | null>(null)
  const [newPlayerId, setNewPlayerId] = useState<string>('')

  const { data: teamPlayers = [] } = useTeamPlayers(selectedTeamId ?? '')

  const activeLineup = selectedTeamId === homeTeamId ? homeLineup : awayLineup
  const currentSlotPlayer = selectedSlot
    ? activeLineup.find((s) => s.rotation_slot === selectedSlot) ?? null
    : null

  // Players not already in the lineup (except in the selected slot)
  const lineupPlayerIds = new Set(
    activeLineup.filter((s) => s.rotation_slot !== selectedSlot).map((s) => s.player_id)
  )
  const availablePlayers = (teamPlayers as unknown as Array<{ id: string; name: string; number: number | null; position: string; is_active: number }>)
    .filter((p) => p.is_active !== 0 && !lineupPlayerIds.has(p.id))

  async function handleSubmit() {
    if (!selectedSlot || !newPlayerId || !selectedTeamId) return
    const newPlayer = availablePlayers.find((p) => p.id === newPlayerId)
    if (!newPlayer) return

    await createSub.mutateAsync({
      teamId: selectedTeamId,
      playerOutId: currentSlotPlayer?.player_id ?? newPlayerId,
      playerInId: newPlayerId,
      rotationSlot: selectedSlot,
    })

    matchStore.applySubstitution(selectedTeamId, selectedSlot, {
      id: newPlayer.id,
      name: newPlayer.name,
      number: newPlayer.number,
      position: newPlayer.position,
    })

    onClose()
  }

  const trackedTeams = [
    homeTeamId ? { id: homeTeamId, name: homeTeamName } : null,
    awayTeamId ? { id: awayTeamId, name: awayTeamName } : null,
  ].filter(Boolean) as Array<{ id: string; name: string }>

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="card p-6 w-full max-w-lg">
        <h2 className="text-lg font-bold text-white mb-4">Record Substitution</h2>

        <div className="space-y-4">
          {/* Team selector (only shown if both teams are tracked) */}
          {trackedTeams.length > 1 && (
            <div>
              <p className="label">Team</p>
              <div className="flex gap-2">
                {trackedTeams.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => { setSelectedTeamId(t.id); setSelectedSlot(null); setNewPlayerId('') }}
                    className={`flex-1 py-2 rounded text-sm border ${
                      selectedTeamId === t.id
                        ? 'bg-blue-600 border-blue-500 text-white'
                        : 'bg-gray-800 border-gray-700 text-gray-300'
                    }`}
                  >
                    {t.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Rotation slot grid */}
          <div>
            <p className="label">Rotation slot</p>
            <div className="grid grid-cols-2 gap-2">
              {([1, 2, 3, 4, 5, 6] as const).map((slot) => {
                const slotPlayer = activeLineup.find((s) => s.rotation_slot === slot)
                return (
                  <button
                    key={slot}
                    onClick={() => { setSelectedSlot(slot); setNewPlayerId('') }}
                    className={`p-3 rounded-lg text-left border transition-colors ${
                      selectedSlot === slot
                        ? 'bg-blue-600/20 border-blue-500 text-white'
                        : 'bg-gray-800 border-gray-700 text-gray-300 hover:border-gray-500'
                    }`}
                  >
                    <p className="text-xs text-gray-400 mb-0.5">{SLOT_LABELS[slot]}</p>
                    <p className="text-sm font-medium">
                      {slotPlayer
                        ? `${slotPlayer.number !== null ? `#${slotPlayer.number} ` : ''}${slotPlayer.name}`
                        : <span className="text-gray-500 italic">Empty</span>
                      }
                    </p>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Player in picker */}
          {selectedSlot && (
            <div>
              <p className="label">
                Player coming in
                {currentSlotPlayer && (
                  <span className="text-gray-400 font-normal ml-1">
                    (replacing {currentSlotPlayer.number !== null ? `#${currentSlotPlayer.number} ` : ''}{currentSlotPlayer.name})
                  </span>
                )}
              </p>
              <select
                className="input w-full"
                value={newPlayerId}
                onChange={(e) => setNewPlayerId(e.target.value)}
              >
                <option value="">— Select player —</option>
                {availablePlayers.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.number !== null ? `#${p.number} ` : ''}{p.name} ({p.position})
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button onClick={onClose} className="btn-secondary flex-1">Cancel</button>
            <button
              onClick={handleSubmit}
              disabled={!selectedSlot || !newPlayerId || createSub.isPending}
              className="btn-primary flex-1"
            >
              {createSub.isPending ? 'Recording...' : 'Record Sub'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
