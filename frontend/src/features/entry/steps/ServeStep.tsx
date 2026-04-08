import { useState, useEffect } from 'react'
import { StepShell, PlayerPicker, QualityPicker } from './StepShell'
import { useRallyStore, nextStepAfterAction } from '../../../store/rallyStore'
import { useTeamPlayers } from '../../../api/players'
import { SERVE_QUALITY_LABELS } from '@vst/shared'
import type { ServeQuality, LineupSlot } from '@vst/shared'

const SERVE_OPTIONS = ([0, 1, 2, 3, 4] as ServeQuality[]).map((v) => ({
  value: v,
  label: SERVE_QUALITY_LABELS[v],
  color: v === 0 ? '#DC2626' : v === 4 ? '#059669' : undefined,
}))

interface Props {
  homeTeamId: string | null
  awayTeamId: string | null
  servingTeamId: string | null
  homeTeamName: string
  awayTeamName: string
  currentServer: LineupSlot | null
}

export function ServeStep({ homeTeamId, awayTeamId, servingTeamId, homeTeamName, awayTeamName, currentServer }: Props) {
  const [playerId, setPlayerId] = useState<string | null>(currentServer?.player_id ?? null)
  const [quality, setQuality] = useState<ServeQuality | null>(null)

  // When rotation changes between rallies, update the pre-selected server
  useEffect(() => {
    setPlayerId(currentServer?.player_id ?? null)
  }, [currentServer?.player_id])

  const { data: homePlayers = [] } = useTeamPlayers(homeTeamId ?? '')
  const { data: awayPlayers = [] } = useTeamPlayers(awayTeamId ?? '')

  const rallyStore = useRallyStore()

  const servingTeamName = servingTeamId === homeTeamId ? homeTeamName : awayTeamName
  const servingPlayers = servingTeamId === homeTeamId ? homePlayers : awayPlayers

  function handleCommit() {
    if (quality === null) return
    const action = {
      actionType: 'serve' as const,
      playerId,
      teamId: servingTeamId,
      serveQuality: quality,
    }
    rallyStore.addAction(action)
    rallyStore.goToStep(nextStepAfterAction(action, rallyStore.actions))
  }

  const nextLabel =
    quality === 4 ? 'Ace → Point Outcome'
    : quality === 0 ? 'Error → Point Outcome'
    : 'Continue to Pass →'

  return (
    <StepShell title="Serve" description={`${servingTeamName} is serving`}>
      {currentServer && (
        <div className="rounded-lg bg-blue-900/30 border border-blue-700/50 px-4 py-2.5 text-sm text-blue-300">
          Auto-detected server: {currentServer.number !== null ? `#${currentServer.number} ` : ''}{currentServer.name}
          <span className="ml-1 text-blue-400/60">({currentServer.position})</span>
        </div>
      )}

      <PlayerPicker
        players={servingPlayers as Array<{ id: string; name: string; number: number | null; position: string }>}
        selectedId={playerId}
        onSelect={setPlayerId}
        label={currentServer ? 'Confirm or change server' : 'Who served?'}
        allowNone
      />

      <QualityPicker
        options={SERVE_OPTIONS}
        selected={quality}
        onSelect={setQuality}
        label="Serve quality / outcome"
      />

      <button
        onClick={handleCommit}
        disabled={quality === null}
        className="btn-primary w-full py-3"
      >
        {nextLabel}
      </button>

      <button
        onClick={() => rallyStore.goToStep('point_outcome')}
        className="btn-ghost text-xs text-gray-500 hover:text-gray-300 w-full py-2"
      >
        Record score only (no action tracking)
      </button>
    </StepShell>
  )
}
