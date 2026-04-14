import { useRef, useState, useCallback } from 'react'
import { COURT, NET_ZONE_LABELS, BACK_ROW_ZONES } from '@vst/shared'
import type { HeatMapPoint } from '@vst/shared'

// Court is 900×540 SVG units (18m × 9m @ 50px/m)
// Bottom half (y=270-540) = our side, top half (y=0-270) = opponent's side
// Net at y=270

export type CourtMode =
  | 'view'
  | 'select_net_zone'      // Click a front-row net zone (1-9)
  | 'select_back_zone'     // Click a back-row zone (5, 6, 1)
  | 'pick_dest'            // Click anywhere on opponent's half for attack destination
  | 'pick_dig_pos'         // Click anywhere on our half for dig position
  | 'heatmap'              // Read-only with heat map overlay

interface Props {
  mode: CourtMode
  selectedZone?: number | null
  onNetZoneSelect?: (zone: number) => void
  onBackZoneSelect?: (zone: number) => void
  onCoordPick?: (x: number, y: number) => void
  heatMapPoints?: HeatMapPoint[]
  /** Persistent marker shown at a previously chosen coordinate */
  markedCoord?: { normX: number; normY: number }
  /** If true, flip perspective (opponent side is bottom) */
  flipped?: boolean
  className?: string
  /** Called when a heatmap point is hovered / un-hovered */
  onPointHover?: (point: HeatMapPoint | null) => void
  /** Player name lookup for hover tooltip (playerId → name) */
  playerNames?: Map<string, string>
}

const W = COURT.WIDTH   // 900
const H = COURT.HEIGHT  // 540
const NET_Y = COURT.NET_Y // 270

// Net zone columns (1-9) across the net band width
// Zones are equally spaced across width 0-900
const ZONE_WIDTH = W / 9 // 100 per zone

// Front row attack approach band on our side: y=270 to y=330 (60px deep)
const APPROACH_Y = NET_Y
const APPROACH_H = 60

// Back row zones cover y=330 to y=540 (210px)
const BACK_ROW_Y = NET_Y + APPROACH_H

// Zone colors
const ZONE_COLORS: Record<number, string> = {
  1: '#3B82F6', // blue - outside left
  2: '#60A5FA',
  3: '#A78BFA', // purple - gap
  4: '#8B5CF6',
  5: '#EF4444', // red - middle
  6: '#F97316',
  7: '#FBBF24', // yellow - right
  8: '#FCD34D',
  9: '#10B981', // green - right side
}

const BACK_ZONE_COLORS: Record<number, string> = {
  5: '#3B82F6',
  6: '#EF4444',
  1: '#10B981',
}

export function CourtSVG({
  mode,
  selectedZone,
  onNetZoneSelect,
  onBackZoneSelect,
  onCoordPick,
  heatMapPoints = [],
  markedCoord,
  flipped = false,
  className = '',
  onPointHover,
}: Props) {
  const svgRef = useRef<SVGSVGElement>(null)
  const [hoverZone, setHoverZone] = useState<number | null>(null)
  const [previewCoord, setPreviewCoord] = useState<{ x: number; y: number } | null>(null)

  const getSVGCoord = useCallback((e: React.PointerEvent) => {
    const svg = svgRef.current
    if (!svg) return null
    const rect = svg.getBoundingClientRect()
    const rawX = ((e.clientX - rect.left) / rect.width) * W
    const rawY = ((e.clientY - rect.top) / rect.height) * H
    return { svgX: rawX, svgY: rawY, normX: rawX / W, normY: rawY / H }
  }, [])

  const isValidHalf = useCallback((normY: number) => {
    if (mode === 'pick_dest') return normY < 0.5    // opponent's half (top)
    if (mode === 'pick_dig_pos') return normY >= 0.5 // our half (bottom)
    return true
  }, [mode])

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (mode === 'pick_dest' || mode === 'pick_dig_pos') {
      const coord = getSVGCoord(e)
      if (coord && isValidHalf(coord.normY)) {
        setPreviewCoord({ x: coord.svgX, y: coord.svgY })
      } else {
        setPreviewCoord(null)
      }
    }
  }, [mode, getSVGCoord, isValidHalf])

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    if (mode === 'pick_dest' || mode === 'pick_dig_pos') {
      const coord = getSVGCoord(e)
      if (coord && isValidHalf(coord.normY)) onCoordPick?.(coord.normX, coord.normY)
    }
  }, [mode, getSVGCoord, onCoordPick, isValidHalf])

  const isCoordPickMode = mode === 'pick_dest' || mode === 'pick_dig_pos'

  return (
    <svg
      ref={svgRef}
      viewBox={`0 0 ${W} ${H}`}
      className={`w-full select-none ${isCoordPickMode ? 'cursor-crosshair' : ''} ${className}`}
      onPointerMove={handlePointerMove}
      onPointerDown={handlePointerDown}
      style={{ transform: flipped ? 'scaleY(-1)' : undefined }}
    >
      {/* ── Court surface ── */}
      <rect x={0} y={0} width={W} height={H} fill="#2d5a3d" rx={4} />

      {/* ── Court boundary ── */}
      <rect x={0} y={0} width={W} height={H} fill="none" stroke="white" strokeWidth={3} />

      {/* ── 3m attack line (our side) ── */}
      <line x1={0} y1={NET_Y + 150} x2={W} y2={NET_Y + 150} stroke="white" strokeWidth={2} strokeDasharray="10 5" opacity={0.6} />

      {/* ── 3m attack line (opponent side) ── */}
      <line x1={0} y1={NET_Y - 150} x2={W} y2={NET_Y - 150} stroke="white" strokeWidth={2} strokeDasharray="10 5" opacity={0.6} />

      {/* ── Center line (net) ── */}
      <rect x={0} y={NET_Y - 6} width={W} height={12} fill="#1a1a2e" />
      <line x1={0} y1={NET_Y} x2={W} y2={NET_Y} stroke="#d1d5db" strokeWidth={4} />

      {/* ── Net zone overlays (front row: 1-9) ── */}
      {(mode === 'select_net_zone') && (
        <g>
          {Array.from({ length: 9 }, (_, i) => {
            const zone = i + 1
            const x = i * ZONE_WIDTH
            const isSelected = selectedZone === zone
            const isHovered = hoverZone === zone
            const color = ZONE_COLORS[zone]
            return (
              <g key={zone}>
                <rect
                  x={x}
                  y={APPROACH_Y - APPROACH_H}
                  width={ZONE_WIDTH}
                  height={APPROACH_H * 2}
                  fill={color}
                  opacity={isSelected ? 0.8 : isHovered ? 0.5 : 0.25}
                  className="cursor-pointer transition-opacity"
                  onPointerEnter={() => setHoverZone(zone)}
                  onPointerLeave={() => setHoverZone(null)}
                  onClick={() => onNetZoneSelect?.(zone)}
                />
                {/* Zone number */}
                <text
                  x={x + ZONE_WIDTH / 2}
                  y={NET_Y + 24}
                  textAnchor="middle"
                  fontSize={16}
                  fontWeight="bold"
                  fill={isSelected || isHovered ? 'white' : 'rgba(255,255,255,0.6)'}
                  pointerEvents="none"
                >
                  {zone}
                </text>
                {/* Zone label on hover */}
                {isHovered && (
                  <text
                    x={x + ZONE_WIDTH / 2}
                    y={NET_Y - 12}
                    textAnchor="middle"
                    fontSize={10}
                    fill="white"
                    pointerEvents="none"
                  >
                    {NET_ZONE_LABELS[zone]?.split('(')[0]?.trim()}
                  </text>
                )}
              </g>
            )
          })}
          {/* Divider lines between zones */}
          {Array.from({ length: 8 }, (_, i) => (
            <line
              key={i}
              x1={(i + 1) * ZONE_WIDTH}
              y1={APPROACH_Y - APPROACH_H}
              x2={(i + 1) * ZONE_WIDTH}
              y2={APPROACH_Y + APPROACH_H}
              stroke="rgba(255,255,255,0.3)"
              strokeWidth={1}
              pointerEvents="none"
            />
          ))}
        </g>
      )}

      {/* ── Back row zone overlays ── */}
      {mode === 'select_back_zone' && (
        <g>
          {BACK_ROW_ZONES.map(({ zone, label }, idx) => {
            const x = idx * (W / 3)
            const isSelected = selectedZone === zone
            const isHovered = hoverZone === zone
            const color = BACK_ZONE_COLORS[zone]
            return (
              <g key={zone}>
                <rect
                  x={x}
                  y={BACK_ROW_Y}
                  width={W / 3}
                  height={H - BACK_ROW_Y}
                  fill={color}
                  opacity={isSelected ? 0.7 : isHovered ? 0.4 : 0.2}
                  className="cursor-pointer transition-opacity"
                  onPointerEnter={() => setHoverZone(zone)}
                  onPointerLeave={() => setHoverZone(null)}
                  onClick={() => onBackZoneSelect?.(zone)}
                />
                <text
                  x={x + W / 6}
                  y={BACK_ROW_Y + (H - BACK_ROW_Y) / 2}
                  textAnchor="middle"
                  fontSize={14}
                  fontWeight="bold"
                  fill="white"
                  opacity={isSelected || isHovered ? 1 : 0.6}
                  pointerEvents="none"
                >
                  {zone}
                </text>
                <text
                  x={x + W / 6}
                  y={BACK_ROW_Y + (H - BACK_ROW_Y) / 2 + 18}
                  textAnchor="middle"
                  fontSize={10}
                  fill="white"
                  opacity={0.7}
                  pointerEvents="none"
                >
                  {label.split('(')[0].trim()}
                </text>
              </g>
            )
          })}
        </g>
      )}

      {/* ── pick_dest: dim our half, highlight + label opponent's half ── */}
      {mode === 'pick_dest' && (
        <g pointerEvents="none">
          {/* Dim the non-clickable bottom half */}
          <rect x={0} y={NET_Y} width={W} height={H - NET_Y} fill="rgba(0,0,0,0.45)" />
          {/* Active half outline */}
          <rect x={0} y={0} width={W} height={NET_Y}
            fill="rgba(59,130,246,0.08)"
            stroke="rgba(59,130,246,0.6)" strokeWidth={2} strokeDasharray="8 4"
          />
          {/* Label */}
          <text x={W / 2} y={NET_Y / 2 - 10} textAnchor="middle" fontSize={15} fontWeight="bold" fill="rgba(147,197,253,0.9)">
            OPPONENT&apos;S COURT
          </text>
          <text x={W / 2} y={NET_Y / 2 + 12} textAnchor="middle" fontSize={11} fill="rgba(255,255,255,0.45)">
            tap to mark landing spot
          </text>
        </g>
      )}

      {/* ── pick_dig_pos: dim opponent's half, highlight + label our half ── */}
      {mode === 'pick_dig_pos' && (
        <g pointerEvents="none">
          {/* Dim the non-clickable top half */}
          <rect x={0} y={0} width={W} height={NET_Y} fill="rgba(0,0,0,0.45)" />
          {/* Active half outline */}
          <rect x={0} y={NET_Y} width={W} height={H - NET_Y}
            fill="rgba(16,185,129,0.08)"
            stroke="rgba(16,185,129,0.6)" strokeWidth={2} strokeDasharray="8 4"
          />
          {/* Label */}
          <text x={W / 2} y={NET_Y + (H - NET_Y) / 2 - 10} textAnchor="middle" fontSize={15} fontWeight="bold" fill="rgba(110,231,183,0.9)">
            YOUR COURT
          </text>
          <text x={W / 2} y={NET_Y + (H - NET_Y) / 2 + 12} textAnchor="middle" fontSize={11} fill="rgba(255,255,255,0.45)">
            tap to mark dig position
          </text>
        </g>
      )}

      {/* ── Persistent marked coordinate ── */}
      {markedCoord && (
        <g pointerEvents="none">
          <circle
            cx={markedCoord.normX * W} cy={markedCoord.normY * H}
            r={10} fill="none"
            stroke={mode === 'pick_dest' ? '#93C5FD' : '#6EE7B7'}
            strokeWidth={2.5}
          />
          <circle
            cx={markedCoord.normX * W} cy={markedCoord.normY * H}
            r={4}
            fill={mode === 'pick_dest' ? '#3B82F6' : '#10B981'}
            opacity={0.95}
          />
        </g>
      )}

      {/* ── Preview crosshair (follows pointer, only in valid half) ── */}
      {isCoordPickMode && previewCoord && (
        <g pointerEvents="none">
          <line x1={previewCoord.x - 12} y1={previewCoord.y} x2={previewCoord.x + 12} y2={previewCoord.y} stroke="white" strokeWidth={1.5} opacity={0.7} />
          <line x1={previewCoord.x} y1={previewCoord.y - 12} x2={previewCoord.x} y2={previewCoord.y + 12} stroke="white" strokeWidth={1.5} opacity={0.7} />
          <circle cx={previewCoord.x} cy={previewCoord.y} r={3} fill="white" opacity={0.5} />
        </g>
      )}

      {/* ── Heat map dots ── */}
      {mode === 'heatmap' && heatMapPoints.map((pt, i) => {
        const cx = pt.x * W
        const cy = pt.y * H
        const color = pt.result === 'kill' || pt.result === 'good_dig' ? '#10B981'
          : pt.result === 'error' || pt.result === 'no_dig' ? '#EF4444'
          : '#FBBF24'
        return (
          <circle
            key={i}
            cx={cx}
            cy={cy}
            r={5}
            fill={color}
            opacity={0.6}
            style={onPointHover ? { cursor: 'pointer' } : undefined}
            onMouseEnter={onPointHover ? () => onPointHover(pt) : undefined}
            onMouseLeave={onPointHover ? () => onPointHover(null) : undefined}
          />
        )
      })}

      {/* ── Zone labels (always visible in view mode) ── */}
      {mode === 'view' && (
        <g opacity={0.4} fontSize={11} fill="white" textAnchor="middle">
          {/* Our court zones */}
          <text x={W * 0.17} y={H - 20}>5</text>
          <text x={W * 0.5} y={H - 20}>6</text>
          <text x={W * 0.83} y={H - 20}>1</text>
          <text x={W * 0.17} y={NET_Y + 60}>4</text>
          <text x={W * 0.5} y={NET_Y + 60}>3</text>
          <text x={W * 0.83} y={NET_Y + 60}>2</text>
        </g>
      )}

      {/* ── NET label ── */}
      <text x={10} y={NET_Y - 8} fontSize={10} fill="rgba(255,255,255,0.4)" fontWeight="bold">NET</text>
    </svg>
  )
}
