import { useState } from 'react'
import type { ProposalEntityType, ProposalActionType } from '@vst/shared'
import { useCreateProposal } from '../../api/auth'

interface Props {
  /** Pre-set values — omit to show full free-form proposal */
  entityType?: ProposalEntityType
  actionType?: ProposalActionType
  entityId?: string
  /** Human-readable label for what is being proposed, e.g. "player #12 Jane Doe" */
  entityLabel?: string
  /** Pre-fill the payload for structured proposals */
  initialPayload?: Record<string, unknown>
  onClose: () => void
}

const ENTITY_TYPE_LABELS: Record<ProposalEntityType, string> = {
  team: 'Team',
  player: 'Player',
  match: 'Match',
  score_correction: 'Score / Rally Correction',
  suggestion: 'General Suggestion',
}

const ACTION_TYPE_LABELS: Record<ProposalActionType, string> = {
  create: 'Add new',
  update: 'Edit',
  delete: 'Remove',
  correct: 'Correct',
  general: 'Suggestion',
}

export function ProposeModal({ entityType, actionType, entityId, entityLabel, initialPayload, onClose }: Props) {
  const createProposal = useCreateProposal()
  const [proposerName, setProposerName] = useState('')
  const [proposerEmail, setProposerEmail] = useState('')
  const [selectedEntityType, setSelectedEntityType] = useState<ProposalEntityType>(entityType ?? 'suggestion')
  const [selectedActionType, setSelectedActionType] = useState<ProposalActionType>(actionType ?? 'general')
  const [description, setDescription] = useState('')

  // Whether this is a free-text proposal (not auto-applicable)
  const isFreeText = !entityType || ['score_correction', 'suggestion'].includes(selectedEntityType)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!proposerName.trim()) return

    let payload: Record<string, unknown> | string
    if (isFreeText) {
      payload = description
    } else {
      payload = { ...initialPayload, description: description || undefined }
    }

    await createProposal.mutateAsync({
      proposerName: proposerName.trim(),
      proposerEmail: proposerEmail.trim() || undefined,
      entityType: selectedEntityType,
      actionType: selectedActionType,
      entityId,
      payload,
    })
    onClose()
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="card p-6 w-full max-w-lg">
        <h2 className="text-lg font-bold text-white mb-1">Submit a Proposal</h2>
        {entityLabel && (
          <p className="text-sm text-gray-400 mb-4">
            {entityType && actionType
              ? `${ACTION_TYPE_LABELS[actionType]}: ${entityLabel}`
              : entityLabel}
          </p>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Proposer info */}
          <div>
            <label className="label">Your name *</label>
            <input
              className="input"
              value={proposerName}
              onChange={(e) => setProposerName(e.target.value)}
              placeholder="Jane Doe"
              required
            />
          </div>
          <div>
            <label className="label">Email (optional — for follow-up)</label>
            <input
              className="input"
              type="email"
              value={proposerEmail}
              onChange={(e) => setProposerEmail(e.target.value)}
              placeholder="jane@example.com"
            />
          </div>

          {/* Type selectors — only shown if no pre-set type */}
          {!entityType && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Type</label>
                <select
                  className="input"
                  value={selectedEntityType}
                  onChange={(e) => setSelectedEntityType(e.target.value as ProposalEntityType)}
                >
                  {(Object.entries(ENTITY_TYPE_LABELS) as [ProposalEntityType, string][]).map(([v, l]) => (
                    <option key={v} value={v}>{l}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">Action</label>
                <select
                  className="input"
                  value={selectedActionType}
                  onChange={(e) => setSelectedActionType(e.target.value as ProposalActionType)}
                >
                  {(Object.entries(ACTION_TYPE_LABELS) as [ProposalActionType, string][]).map(([v, l]) => (
                    <option key={v} value={v}>{l}</option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {/* Payload display for structured proposals */}
          {!isFreeText && initialPayload && Object.keys(initialPayload).length > 0 && (
            <div>
              <label className="label">Proposed values</label>
              <pre className="text-xs bg-gray-800 rounded-lg p-3 text-gray-300 overflow-auto max-h-40">
                {JSON.stringify(initialPayload, null, 2)}
              </pre>
            </div>
          )}

          {/* Description / reason */}
          <div>
            <label className="label">
              {isFreeText ? 'Description *' : 'Additional context (optional)'}
            </label>
            <textarea
              className="input min-h-[80px] resize-y"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={
                isFreeText
                  ? 'Describe the change you would like to see...'
                  : 'Any additional context or reason for this change...'
              }
              required={isFreeText}
            />
          </div>

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="btn-secondary flex-1">Cancel</button>
            <button
              type="submit"
              disabled={createProposal.isPending}
              className="btn-primary flex-1"
            >
              {createProposal.isPending ? 'Submitting...' : 'Submit Proposal'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
