import { Trash2, Undo2 } from 'lucide-react'
import type { RallyActionDraft } from '@vst/shared'
import { SERVE_QUALITY_LABELS, RECEPTION_QUALITY_LABELS, PASS_QUALITY_LABELS, SET_TYPE_LABELS, ATTACK_RESULT_LABELS, BLOCK_RESULT_LABELS, DIG_RESULT_LABELS } from '@vst/shared'
import type { EntryStep } from '../../store/rallyStore'
import type { SubmittedRally } from '../../api/rallies'

function actionSummary(action: RallyActionDraft, idx: number): string {
  switch (action.actionType) {
    case 'serve':
      return `Serve: ${SERVE_QUALITY_LABELS[action.serveQuality ?? 0]}`
    case 'reception':
      return `Serve Receive: ${RECEPTION_QUALITY_LABELS[action.passQuality ?? 0]}`
    case 'pass':
      return `Pass: ${PASS_QUALITY_LABELS[action.passQuality ?? 0]}`
    case 'set':
      return `Set: ${SET_TYPE_LABELS[action.setType ?? 'other']}${action.setQuality ? ` (${action.setQuality})` : ''}`
    case 'attack':
      return `Attack: Zone ${action.attackZone} → ${ATTACK_RESULT_LABELS[action.attackResult ?? 'error']}`
    case 'block':
      return `Block: ${BLOCK_RESULT_LABELS[action.blockResult ?? 'block_error']}`
    case 'dig':
      return `Dig: ${DIG_RESULT_LABELS[action.digResult ?? 'no_dig']}`
    case 'overpass':
      return action.freeballResult === 'error' ? 'Freeball: Error (net/out)' : 'Freeball: Over'
    default:
      return `Action ${idx + 1}`
  }
}

const ACTION_ICONS: Record<string, string> = {
  serve: '🏐',
  reception: '✋',
  pass: '✋',
  set: '🤚',
  attack: '💥',
  block: '🧱',
  dig: '🤸',
  overpass: '↩️',
}

interface Props {
  actions: RallyActionDraft[]
  step: EntryStep
  onBack?: () => void
  submittedRallies?: SubmittedRally[]
  homeTeamId?: string | null
  awayTeamId?: string | null
  homeTeamName?: string
  awayTeamName?: string
  onDeleteRally?: (rallyId: string) => void
}

export function RallyTimeline({
  actions,
  step,
  onBack,
  submittedRallies = [],
  homeTeamId,
  awayTeamId,
  homeTeamName = 'Home',
  awayTeamName = 'Away',
  onDeleteRally,
}: Props) {
  function rallyWinnerName(r: SubmittedRally): string {
    if (r.winning_team_id === homeTeamId) return homeTeamName
    if (r.winning_team_id === awayTeamId) return awayTeamName
    if (r.winning_team_id === null) return awayTeamName
    return '?'
  }

  return (
    <div className="flex flex-col h-full">
      <div className="p-3 border-b border-gray-800 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-300">Rally Actions</h3>
        {onBack && step !== 'idle' && (
          <button onClick={onBack} className="btn-ghost text-xs gap-1 py-1 px-2">
            <Undo2 className="w-3 h-3" />
            Undo
          </button>
        )}
      </div>

      {/* Current rally draft actions */}
      <div className="p-3 space-y-2">
        {actions.length === 0 && step === 'idle' && (
          <p className="text-xs text-gray-600 text-center pt-2">No active rally</p>
        )}
        {actions.map((action, idx) => (
          <div
            key={idx}
            className="flex items-start gap-2 p-2 rounded-lg bg-gray-800/50 text-sm"
          >
            <span className="text-base leading-none mt-0.5">{ACTION_ICONS[action.actionType]}</span>
            <div>
              <p className="text-gray-200 text-xs font-medium">{actionSummary(action, idx)}</p>
              {action.playerId === null && (
                <p className="text-gray-600 text-xs">Unknown player</p>
              )}
            </div>
          </div>
        ))}

        {step !== 'idle' && (
          <div className="flex items-center gap-2 p-2 rounded-lg border border-blue-700/50 bg-blue-900/20 text-sm animate-pulse">
            <span className="text-base">{ACTION_ICONS[step] ?? '▶'}</span>
            <p className="text-blue-300 text-xs font-medium capitalize">{step.replace('_', ' ')}...</p>
          </div>
        )}

        {actions.length > 0 && (
          <p className="text-xs text-gray-500 pt-1">{actions.length} action{actions.length !== 1 ? 's' : ''} in rally</p>
        )}
      </div>

      {/* Submitted rally history */}
      {submittedRallies.length > 0 && (
        <div className="border-t border-gray-800 flex-1 overflow-auto">
          <p className="text-xs text-gray-500 px-3 pt-3 pb-1">Set history ({submittedRallies.length})</p>
          <div className="px-3 pb-3 space-y-1">
            {[...submittedRallies].reverse().map((r) => (
              <div
                key={r.id}
                className="flex items-center justify-between gap-2 py-1.5 px-2 rounded bg-gray-800/40 text-xs"
              >
                <div className="min-w-0">
                  <span className="text-gray-500 mr-1">#{r.rally_number}</span>
                  <span className="text-gray-400 tabular-nums">{r.home_score_before}–{r.away_score_before}</span>
                  {r.winning_team_id !== undefined && r.point_type && (
                    <span className="text-gray-300 ml-1 truncate">
                      → {rallyWinnerName(r)} ({r.point_type})
                    </span>
                  )}
                </div>
                {onDeleteRally && (
                  <button
                    onClick={() => onDeleteRally(r.id)}
                    className="shrink-0 text-gray-600 hover:text-red-400 transition-colors p-0.5"
                    title="Delete rally"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
