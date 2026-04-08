import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Check, X, AlertTriangle } from 'lucide-react'
import { api } from '../../api/client'
import { useReviewProposal } from '../../api/auth'
import { AdminGuard } from '../../components/AdminGuard'
import type { Proposal, ProposalStatus } from '@vst/shared'

const STATUS_TABS: { value: ProposalStatus; label: string }[] = [
  { value: 'pending', label: 'Pending' },
  { value: 'approved', label: 'Approved' },
  { value: 'applied', label: 'Applied' },
  { value: 'rejected', label: 'Rejected' },
]

const ENTITY_LABELS: Record<string, string> = {
  team: 'Team', player: 'Player', match: 'Match',
  score_correction: 'Score/Rally', suggestion: 'Suggestion',
}

const ACTION_LABELS: Record<string, string> = {
  create: 'Add', update: 'Edit', delete: 'Remove',
  correct: 'Correct', general: 'Suggestion',
}

function ProposalCard({ proposal, onReviewed }: { proposal: Proposal; onReviewed: () => void }) {
  const review = useReviewProposal()
  const [rejectReason, setRejectReason] = useState('')
  const [showReject, setShowReject] = useState(false)

  const isManual = proposal.manual_review === 1
  const isPending = proposal.status === 'pending'

  let parsedPayload: Record<string, unknown> | null = null
  try {
    const p = JSON.parse(proposal.payload)
    if (typeof p === 'object' && p !== null) parsedPayload = p as Record<string, unknown>
  } catch {
    // plain text payload — shown as-is
  }

  async function handleApprove() {
    await review.mutateAsync({ id: proposal.id, status: isManual ? 'applied' : 'approved' })
    toast.success(isManual ? 'Marked as applied' : 'Proposal approved and applied')
    onReviewed()
  }

  async function handleReject() {
    if (!rejectReason.trim()) { toast.error('Please provide a reason'); return }
    await review.mutateAsync({ id: proposal.id, status: 'rejected', rejectReason })
    toast.success('Proposal rejected')
    onReviewed()
  }

  return (
    <div className="card p-4 space-y-3">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs bg-blue-900/40 text-blue-300 px-2 py-0.5 rounded-full">
              {ENTITY_LABELS[proposal.entity_type] ?? proposal.entity_type}
            </span>
            <span className="text-xs bg-gray-800 text-gray-300 px-2 py-0.5 rounded-full">
              {ACTION_LABELS[proposal.action_type] ?? proposal.action_type}
            </span>
            {isManual && (
              <span className="text-xs bg-yellow-900/40 text-yellow-400 px-2 py-0.5 rounded-full flex items-center gap-1">
                <AlertTriangle className="w-3 h-3" /> Manual review
              </span>
            )}
          </div>
          <p className="text-sm text-gray-400 mt-1">
            From <span className="text-white">{proposal.proposer_name}</span>
            {proposal.proposer_email && ` · ${proposal.proposer_email}`}
          </p>
        </div>
        <p className="text-xs text-gray-500 shrink-0">
          {new Date(proposal.created_at).toLocaleDateString()}
        </p>
      </div>

      {/* Payload */}
      {parsedPayload ? (
        <pre className="text-xs bg-gray-800/60 rounded-lg p-3 text-gray-300 overflow-auto max-h-48">
          {JSON.stringify(parsedPayload, null, 2)}
        </pre>
      ) : (
        <p className="text-sm text-gray-300 bg-gray-800/60 rounded-lg p-3 whitespace-pre-wrap">
          {proposal.payload}
        </p>
      )}

      {/* Manual review note */}
      {isManual && isPending && (
        <p className="text-xs text-yellow-400/80">
          This proposal requires manual action. After you have made the change, click "Mark Applied".
        </p>
      )}

      {/* Actions */}
      {isPending && (
        <div className="space-y-2">
          {!showReject ? (
            <div className="flex gap-2">
              <button
                onClick={handleApprove}
                disabled={review.isPending}
                className="btn-primary flex-1 gap-2 text-sm py-2"
              >
                <Check className="w-4 h-4" />
                {isManual ? 'Mark Applied' : 'Approve & Apply'}
              </button>
              <button
                onClick={() => setShowReject(true)}
                className="btn-secondary flex-1 gap-2 text-sm py-2 text-red-400 hover:text-red-300 hover:border-red-700"
              >
                <X className="w-4 h-4" /> Reject
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              <input
                className="input text-sm"
                placeholder="Reason for rejection..."
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                autoFocus
              />
              <div className="flex gap-2">
                <button
                  onClick={handleReject}
                  disabled={review.isPending}
                  className="btn-primary flex-1 text-sm py-2 bg-red-700 border-red-600 hover:bg-red-600"
                >
                  Confirm Reject
                </button>
                <button onClick={() => setShowReject(false)} className="btn-secondary flex-1 text-sm py-2">
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Reviewed status */}
      {!isPending && (
        <p className="text-xs text-gray-500">
          {proposal.status === 'rejected'
            ? `Rejected: ${proposal.reject_reason ?? '—'}`
            : proposal.status === 'approved'
            ? 'Auto-applied'
            : 'Manually applied'}
        </p>
      )}
    </div>
  )
}

function ProposalsList() {
  const [status, setStatus] = useState<ProposalStatus>('pending')
  const qc = useQueryClient()

  const { data: proposals = [], isLoading } = useQuery({
    queryKey: ['proposals', status],
    queryFn: () => api.get<Proposal[]>(`/proposals?status=${status}`),
  })

  function handleReviewed() {
    qc.invalidateQueries({ queryKey: ['proposals'] })
    qc.invalidateQueries({ queryKey: ['proposals-count'] })
  }

  return (
    <div className="p-6 max-w-2xl">
      <h1 className="text-2xl font-bold text-white mb-6">Proposals</h1>

      {/* Status tabs */}
      <div className="flex gap-1 mb-6 bg-gray-900 rounded-xl p-1">
        {STATUS_TABS.map((tab) => (
          <button
            key={tab.value}
            onClick={() => setStatus(tab.value)}
            className={`flex-1 py-2 text-sm rounded-lg transition-colors ${
              status === tab.value
                ? 'bg-blue-600 text-white'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {isLoading && <p className="text-gray-400">Loading...</p>}

      {!isLoading && proposals.length === 0 && (
        <div className="card p-8 text-center text-gray-400">
          No {status} proposals.
        </div>
      )}

      <div className="space-y-3">
        {(proposals as unknown as Proposal[]).map((p) => (
          <ProposalCard key={p.id} proposal={p} onReviewed={handleReviewed} />
        ))}
      </div>
    </div>
  )
}

export function ProposalsPage() {
  return (
    <AdminGuard redirect>
      <ProposalsList />
    </AdminGuard>
  )
}
