import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { useMatchStore } from '../../store/matchStore'
import { useRallyStore } from '../../store/rallyStore'
import { useMatch, useMatchSets, matchKeys } from '../../api/matches'
import { api } from '../../api/client'
import { useSetLineup, useUpdateSet } from '../../api/sets'
import { useCreateRally, useSubmitRally, useDeleteRally, useSetRallies } from '../../api/rallies'
import type { SubmittedRally } from '../../api/rallies'
import { EntryHeader } from './EntryHeader'
import { ServeStep } from './steps/ServeStep'
import { ReceiveStep } from './steps/ReceiveStep'
import { PassStep } from './steps/PassStep'
import { SetStep } from './steps/SetStep'
import { AttackStep } from './steps/AttackStep'
import { BlockStep } from './steps/BlockStep'
import { PointOutcomeStep } from './PointOutcomeStep'
import { RallyTimeline } from './RallyTimeline'
import { SubstitutionModal } from './SubstitutionModal'
import { isSetComplete } from '@vst/shared'
import type { SubmitRallyPayload, LineupSlot } from '@vst/shared'

export function EntryPage() {
  const { matchId, setId } = useParams<{ matchId: string; setId: string }>()
  const navigate = useNavigate()

  const { data: match } = useMatch(matchId!)
  const { data: sets } = useMatchSets(matchId!)
  const { data: lineupData } = useSetLineup(setId!)

  const matchStore = useMatchStore()
  const rallyStore = useRallyStore()

  const qc = useQueryClient()
  const createRally = useCreateRally(setId!)
  const submitRally = useSubmitRally(setId!)
  const deleteRally = useDeleteRally(setId!)
  const updateSet = useUpdateSet(setId!)
  const { data: submittedRallies = [] } = useSetRallies(setId!)

  const [showSubModal, setShowSubModal] = useState(false)

  // Initialize match context
  useEffect(() => {
    if (match && setId && sets) {
      const m = match as unknown as Record<string, unknown>
      const currentSet = (sets as unknown as Record<string, unknown>[]).find((s) => s.id === setId)
      const homeTeamId = m.home_team_id as string | null
      if (currentSet && homeTeamId) {
        matchStore.setActiveMatch(matchId!, homeTeamId, m.away_team_id as string | null)
        // Read current setId imperatively to avoid stale-closure: the store
        // may have been updated by a previous render that isn't in deps.
        const storedSetId = useMatchStore.getState().setId
        // Only re-initialize rotation/serving state when entering a different set.
        // Re-entering the same set preserves the current rotation and serving team
        // built up from submitted rallies.
        if (storedSetId !== setId) {
          matchStore.setActiveSet(
            setId,
            currentSet.set_number as number,
            (currentSet.home_starting_rotation as number | null) ?? 1,
            (currentSet.away_starting_rotation as number | null) ?? 1,
            (currentSet.first_serving_team_id as string | null) ?? homeTeamId,
            currentSet.home_score as number,
            currentSet.away_score as number,
          )
        } else {
          // Always sync scores from DB on re-entry so navigation away/back can't desync them
          matchStore.syncScores(currentSet.home_score as number, currentSet.away_score as number)
        }
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [match, sets, setId, matchId])

  // Sync lineup from API into matchStore
  useEffect(() => {
    if (lineupData && matchStore.homeTeamId) {
      const slots = lineupData as LineupSlot[]
      matchStore.setHomeLineup(slots.filter((s) => s.team_id === matchStore.homeTeamId))
      matchStore.setAwayLineup(slots.filter((s) => s.team_id === matchStore.awayTeamId))
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lineupData, matchStore.homeTeamId, matchStore.awayTeamId])

  async function handleStartRally() {
    const rally = await createRally.mutateAsync({
      servingTeamId: matchStore.servingTeamId,
      homeScoreBefore: matchStore.homeScore,
      awayScoreBefore: matchStore.awayScore,
      homeRotation: matchStore.homeRotation,
      awayRotation: matchStore.awayRotation,
    })
    rallyStore.startRally(rally.id)
  }

  async function handleSubmitRally(winningTeamId: string | null, pointType: SubmitRallyPayload['pointType']) {
    if (!rallyStore.rallyId) return
    try {
      const result = await submitRally.mutateAsync({
        rallyId: rallyStore.rallyId,
        payload: {
          winningTeamId,
          pointType,
          actions: rallyStore.actions,
        },
      })
      matchStore.applyRallyResult(result)
      rallyStore.resetRally()
    } catch {
      // Error already shown via toast. Reset to idle so the user can start a fresh rally.
      rallyStore.resetRally()
    }
  }

  async function handleDeleteRally(rallyId: string) {
    if (!window.confirm('Delete this rally? Set scores will be adjusted.')) return
    await deleteRally.mutateAsync(rallyId)
    // Fetch fresh set data to sync scores after deletion (staleTime:0 forces a real fetch)
    const freshSets = await qc.fetchQuery({
      queryKey: matchKeys.sets(matchId!),
      queryFn: () => api.get<unknown[]>(`/matches/${matchId!}/sets`),
      staleTime: 0,
    })
    const currentSet = (freshSets as Record<string, unknown>[]).find((s) => s.id === setId)
    if (currentSet) {
      matchStore.syncScores(currentSet.home_score as number, currentSet.away_score as number)
    }
  }

  const step = rallyStore.step
  const hasReception = rallyStore.actions.some((a) => a.actionType === 'reception')

  const matchRaw = match as unknown as Record<string, unknown> | undefined
  const homeTeamName = (matchRaw?.['home_team_name'] as string | null) ?? 'Home'
  const awayTeamName = (matchRaw?.['away_team_name'] as string | null) ?? (matchRaw?.['opponent_name'] as string | null) ?? 'Away'

  // Derive the current server from the serving team's lineup + rotation
  const servingLineup =
    matchStore.servingTeamId === matchStore.homeTeamId
      ? matchStore.homeLineup
      : matchStore.awayLineup
  const currentRotation =
    matchStore.servingTeamId === matchStore.homeTeamId
      ? matchStore.homeRotation
      : matchStore.awayRotation
  const currentServer = servingLineup.find((s) => s.rotation_slot === currentRotation) ?? null
  const setComplete = isSetComplete(matchStore.homeScore, matchStore.awayScore, matchStore.setNumber)

  async function handleFinishSet() {
    await updateSet.mutateAsync({ status: 'complete' })
    navigate(`/matches/${matchId}`)
  }

  return (
    <div className="flex flex-col h-screen bg-gray-950">
      <EntryHeader
        homeTeamName={homeTeamName}
        awayTeamName={awayTeamName}
        homeScore={matchStore.homeScore}
        awayScore={matchStore.awayScore}
        homeRotation={matchStore.homeRotation}
        awayRotation={matchStore.awayRotation}
        setNumber={matchStore.setNumber}
        onBack={() => navigate(`/matches/${matchId}`)}
      />

      <div className="flex flex-1 overflow-hidden">
        {/* Left panel: step entry */}
        <div className="flex-1 overflow-auto p-4">
          {step !== 'idle' && step !== 'serve' && step !== 'point_outcome' && (
            <div className="flex items-center gap-1 mb-3">
              {(['receive', 'set', 'attack', 'pass', 'block'] as const).map((t) => {
                const isDisabled = t === 'receive' && hasReception
                return (
                  <button
                    key={t}
                    onClick={() => rallyStore.switchStep(t)}
                    disabled={isDisabled}
                    className={`flex-1 py-1.5 text-xs rounded-lg border transition-colors capitalize ${
                      isDisabled
                        ? 'bg-gray-800 border-gray-700 text-gray-600 opacity-40 cursor-not-allowed'
                        : step === t
                          ? 'bg-blue-600 border-blue-500 text-white'
                          : 'bg-gray-800 border-gray-700 text-gray-400 hover:text-white'
                    }`}
                  >
                    {t === 'receive' ? 'Receive' : t === 'attack' ? 'Attack' : t.charAt(0).toUpperCase() + t.slice(1)}
                  </button>
                )
              })}
              <button
                onClick={() => rallyStore.goToStep('point_outcome')}
                className="btn-ghost text-xs px-2 py-1.5 text-gray-400 hover:text-white border border-gray-700 rounded-lg whitespace-nowrap"
              >
                Skip →
              </button>
            </div>
          )}

          {step === 'idle' && (
            <div className="flex flex-col items-center justify-center h-full gap-4">
              {setComplete ? (
                <div className="text-center space-y-4">
                  <div className="text-center">
                    <h2 className="text-xl font-bold text-green-400 mb-1">Set Over!</h2>
                    <p className="text-gray-300 text-lg font-semibold tabular-nums">
                      {matchStore.homeScore} – {matchStore.awayScore}
                    </p>
                  </div>
                  <button
                    onClick={handleFinishSet}
                    disabled={updateSet.isPending}
                    className="btn-primary text-lg px-8 py-3 bg-green-600 hover:bg-green-500 border-green-500"
                  >
                    {updateSet.isPending ? 'Saving...' : 'Finish Set'}
                  </button>
                </div>
              ) : (
                <>
                  <div className="text-center">
                    <h2 className="text-xl font-bold text-white mb-1">Ready for next rally</h2>
                    <p className="text-gray-400 text-sm">
                      {matchStore.servingTeamId === matchStore.homeTeamId ? homeTeamName : awayTeamName} is serving
                    </p>
                    {currentServer && (
                      <p className="text-blue-400 text-sm mt-1">
                        Server: {currentServer.number !== null ? `#${currentServer.number} ` : ''}{currentServer.name}
                      </p>
                    )}
                  </div>
                  <button
                    onClick={handleStartRally}
                    disabled={createRally.isPending}
                    className="btn-primary text-lg px-8 py-3"
                  >
                    {createRally.isPending ? 'Starting...' : 'Start Rally'}
                  </button>
                  <button
                    onClick={() => setShowSubModal(true)}
                    className="btn-secondary px-6 py-2 text-sm"
                  >
                    Sub
                  </button>
                </>
              )}
            </div>
          )}

          {step === 'serve' && (
            <ServeStep
              homeTeamId={matchStore.homeTeamId}
              awayTeamId={matchStore.awayTeamId}
              servingTeamId={matchStore.servingTeamId}
              homeTeamName={homeTeamName}
              awayTeamName={awayTeamName}
              currentServer={currentServer}
            />
          )}
          {step === 'receive' && (
            <ReceiveStep
              homeTeamId={matchStore.homeTeamId}
              awayTeamId={matchStore.awayTeamId}
              homeTeamName={homeTeamName}
              awayTeamName={awayTeamName}
              servingTeamId={matchStore.servingTeamId}
            />
          )}
          {step === 'pass' && (
            <PassStep
              homeTeamId={matchStore.homeTeamId}
              awayTeamId={matchStore.awayTeamId}
              homeTeamName={homeTeamName}
              awayTeamName={awayTeamName}
              servingTeamId={matchStore.servingTeamId}
            />
          )}
          {step === 'set' && (
            <SetStep
              homeTeamId={matchStore.homeTeamId}
              awayTeamId={matchStore.awayTeamId}
              homeTeamName={homeTeamName}
              awayTeamName={awayTeamName}
              servingTeamId={matchStore.servingTeamId}
            />
          )}
          {step === 'attack' && (
            <AttackStep
              homeTeamId={matchStore.homeTeamId}
              awayTeamId={matchStore.awayTeamId}
              homeTeamName={homeTeamName}
              awayTeamName={awayTeamName}
              servingTeamId={matchStore.servingTeamId}
            />
          )}
          {step === 'block' && (
            <BlockStep
              homeTeamId={matchStore.homeTeamId}
              awayTeamId={matchStore.awayTeamId}
              homeTeamName={homeTeamName}
              awayTeamName={awayTeamName}
              servingTeamId={matchStore.servingTeamId}
            />
          )}
          {step === 'point_outcome' && (
            <PointOutcomeStep
              homeTeamId={matchStore.homeTeamId}
              awayTeamId={matchStore.awayTeamId}
              homeTeamName={homeTeamName}
              awayTeamName={awayTeamName}
              actions={rallyStore.actions}
              onSubmit={handleSubmitRally}
              isSubmitting={submitRally.isPending}
            />
          )}
        </div>

        {/* Right panel: rally timeline */}
        <div className="w-72 border-l border-gray-800 overflow-auto">
          <RallyTimeline
            actions={rallyStore.actions}
            step={step}
            onBack={step !== 'idle' ? () => rallyStore.goBack() : undefined}
            submittedRallies={
              (submittedRallies as unknown as SubmittedRally[])
                .filter(r => r.point_type !== null && r.id !== rallyStore.rallyId)
            }
            homeTeamId={matchStore.homeTeamId}
            awayTeamId={matchStore.awayTeamId}
            homeTeamName={homeTeamName}
            awayTeamName={awayTeamName}
            onDeleteRally={handleDeleteRally}
          />
        </div>
      </div>

      {showSubModal && (
        <SubstitutionModal
          setId={setId!}
          homeTeamId={matchStore.homeTeamId}
          awayTeamId={matchStore.awayTeamId}
          homeTeamName={homeTeamName}
          awayTeamName={awayTeamName}
          homeLineup={matchStore.homeLineup}
          awayLineup={matchStore.awayLineup}
          onClose={() => setShowSubModal(false)}
        />
      )}
    </div>
  )
}
