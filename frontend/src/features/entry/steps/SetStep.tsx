import { useState } from 'react'
import { StepShell, PlayerPicker, QualityPicker, TeamToggle } from './StepShell'
import { useRallyStore, nextStepAfterAction } from '../../../store/rallyStore'
import { useTeamPlayers } from '../../../api/players'
import { SET_TYPE_LABELS, SET_QUALITY_LABELS, SET_TYPES, SET_QUALITY_OPTIONS } from '@vst/shared'
import type { SetType, SetQuality } from '@vst/shared'

const SET_TYPE_OPTIONS = SET_TYPES.map((v) => ({
  value: v,
  label: SET_TYPE_LABELS[v],
}))

const SET_QUALITY_OPT = SET_QUALITY_OPTIONS.map((v) => ({
  value: v,
  label: SET_QUALITY_LABELS[v],
  color: v === 'error' ? '#DC2626' : v === 'on_target' ? '#059669' : undefined,
}))

interface Props {
  homeTeamId: string | null
  awayTeamId: string | null
  homeTeamName: string
  awayTeamName: string
  servingTeamId: string | null
}

export function SetStep({ homeTeamId, awayTeamId, homeTeamName, awayTeamName, servingTeamId }: Props) {
  const [teamOverride, setTeamOverride] = useState<string | null | undefined>(undefined)
  const [playerId, setPlayerId] = useState<string | null>(null)
  const [setType, setSetType] = useState<SetType | null>(null)
  const [setQuality, setSetQualityState] = useState<SetQuality | null>(null)
  const rallyStore = useRallyStore()

  // The setter is on whichever team last received the ball (pass or dig).
  const lastPassOrDig = [...rallyStore.actions].reverse()
    .find(a => a.actionType === 'pass' || a.actionType === 'dig')
  const autoTeamId = lastPassOrDig !== undefined
    ? lastPassOrDig.teamId
    : (servingTeamId === homeTeamId ? awayTeamId : homeTeamId)

  const teamId = teamOverride !== undefined ? teamOverride : autoTeamId

  const { data: settingPlayers = [] } = useTeamPlayers(teamId ?? '')
  const setters = settingPlayers.filter((p) => p.position === 'S')
  const allPlayers = settingPlayers

  function handleTeamSelect(id: string | null) {
    setTeamOverride(id)
    setPlayerId(null)
  }

  function handleSkip() {
    rallyStore.goToStep('attack')
  }

  function handleCommit() {
    if (!setType) return
    const action = {
      actionType: 'set' as const,
      playerId,
      teamId,
      setType,
      setQuality: setQuality ?? undefined,
    }
    rallyStore.addAction(action)
    rallyStore.goToStep(nextStepAfterAction(action, rallyStore.actions))
  }

  return (
    <StepShell title="Set" description="Record the set">
      <TeamToggle
        homeTeamId={homeTeamId}
        awayTeamId={awayTeamId}
        homeTeamName={homeTeamName}
        awayTeamName={awayTeamName}
        selectedTeamId={teamId}
        onSelect={handleTeamSelect}
        label="Setting team"
      />

      <PlayerPicker
        players={[...setters, ...allPlayers.filter((p) => p.position !== 'S')]}
        selectedId={playerId}
        onSelect={setPlayerId}
        label="Who set?"
        allowNone
      />

      <QualityPicker
        options={SET_TYPE_OPTIONS}
        selected={setType}
        onSelect={setSetType}
        label="Set type"
      />

      <QualityPicker
        options={SET_QUALITY_OPT}
        selected={setQuality}
        onSelect={setSetQualityState}
        label="Set quality"
      />

      {!teamId ? (
        <button onClick={handleSkip} className="btn-secondary w-full py-3">
          Skip — opponent untracked
        </button>
      ) : (
        <button onClick={handleCommit} disabled={!setType} className="btn-primary w-full py-3">
          Continue to Attack →
        </button>
      )}
    </StepShell>
  )
}
