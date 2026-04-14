import { useState, useMemo } from 'react'
import type { TeamStats } from '@vst/shared'

interface TeamsTabProps {
  teams: TeamStats[]
  seasonId: string
}

type SortKey = keyof TeamStats

interface ColumnDef {
  key: SortKey
  label: string
  decimals?: number
  pct?: boolean
}

const COLUMNS: ColumnDef[] = [
  { key: 'attackEfficiency', label: 'Atk Eff', decimals: 3 },
  { key: 'attackKills', label: 'Kills' },
  { key: 'attackAttempts', label: 'Atk Atts' },
  { key: 'serveAces', label: 'Aces' },
  { key: 'serveQualityAvg', label: 'Srv Qual', decimals: 2 },
  { key: 'sideoutPct', label: 'SO%', decimals: 1, pct: true },
  { key: 'digAttempts', label: 'Digs' },
  { key: 'soloBlocks', label: 'Blks' },
  { key: 'passQualityAvg', label: 'Rcv Avg', decimals: 2 },
]

function fmtVal(val: number, col: ColumnDef): string {
  if (col.pct) return `${(val * 100).toFixed(col.decimals ?? 1)}%`
  if (col.decimals !== undefined) return val.toFixed(col.decimals)
  return String(val)
}

export function TeamsTab({ teams, seasonId }: TeamsTabProps) {
  const [sortKey, setSortKey] = useState<SortKey>('attackEfficiency')
  const [sortDesc, setSortDesc] = useState(true)

  const sorted = useMemo(() => {
    return [...teams].sort((a, b) => {
      const av = a[sortKey]
      const bv = b[sortKey]
      if (typeof av === 'number' && typeof bv === 'number') {
        return sortDesc ? bv - av : av - bv
      }
      if (typeof av === 'string' && typeof bv === 'string') {
        return sortDesc ? bv.localeCompare(av) : av.localeCompare(bv)
      }
      return 0
    })
  }, [teams, sortKey, sortDesc])

  function handleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDesc(d => !d)
    } else {
      setSortKey(key)
      setSortDesc(true)
    }
  }

  if (!seasonId) {
    return (
      <div className="bg-gray-900 rounded-xl p-8 text-center text-gray-500">
        Select a season to compare teams.
      </div>
    )
  }

  if (teams.length === 0) {
    return (
      <div className="bg-gray-900 rounded-xl p-8 text-center text-gray-500">
        No team data found for this season.
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <p className="text-xs text-gray-500">{teams.length} team{teams.length !== 1 ? 's' : ''} in season</p>

      <div className="bg-gray-900 rounded-xl overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-800">
              <th
                className="px-4 py-2 text-left text-xs font-semibold text-gray-400 cursor-pointer hover:text-white select-none"
                onClick={() => handleSort('teamName')}
              >
                Team{sortKey === 'teamName' && <span className="ml-1 text-blue-400">{sortDesc ? '↓' : '↑'}</span>}
              </th>
              {COLUMNS.map(col => (
                <th
                  key={col.key}
                  className="px-3 py-2 text-right text-xs font-semibold text-gray-400 cursor-pointer hover:text-white select-none"
                  onClick={() => handleSort(col.key)}
                >
                  {col.label}
                  {sortKey === col.key && (
                    <span className="ml-1 text-blue-400">{sortDesc ? '↓' : '↑'}</span>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.map((team, i) => (
              <tr
                key={team.teamId}
                className={`border-b border-gray-800/50 hover:bg-gray-800/40 transition-colors ${
                  i % 2 === 0 ? '' : 'bg-gray-800/20'
                }`}
              >
                <td className="px-4 py-2.5">
                  <div className="flex items-center gap-2">
                    <div
                      className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                      style={{ backgroundColor: team.teamColor || '#6B7280' }}
                    />
                    <span className="font-medium text-gray-100">{team.teamName}</span>
                  </div>
                </td>
                {COLUMNS.map(col => {
                  const raw = team[col.key]
                  const num = typeof raw === 'number' ? raw : 0
                  return (
                    <td key={col.key} className="px-3 py-2.5 text-right tabular-nums text-gray-200">
                      {fmtVal(num, col)}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
