// Twist - a Texture by Textures | https://textures.dev/s/twist
// Install another: npx shadcn@latest add https://textures.dev/r/<slug>.json
// For agents: https://textures.md
// License: free to use
// Copyright (c) 2026 Textures (textures.dev). MIT; see ./LICENSE.
// Adapted for Curator: shared, on-demand pointer engine; static previews never animate.
import { type CSSProperties, useEffect, useRef } from 'react'
import { engine, type TextureMotionOptions } from './engine'
const W = 732
const H = 516
const COLS = 25
const ROWS = 18
const CELL_W = 27
const CELL_H = 26
const X0 = 17
const Y0 = 17
const PITCH_X = (714 - 17 - CELL_W) / (COLS - 1)
const PITCH_Y = (498 - 17 - CELL_H) / (ROWS - 1)
const T_MIN = 0.85
const T_MAX = 4.5
const BAR_LEN = 44
const CELLS: [number, number, number][] = []
for (let r = 0; r < ROWS; r++)
	for (let c = 0; c < COLS; c++)
		CELLS.push([Math.round((X0 + c * PITCH_X) * 100) / 100, Math.round((Y0 + r * PITCH_Y) * 100) / 100, CELL_W])
export type TwistProps = {
	tokens?: Partial<Record<"--texture-ink" | "--texture-field", string>>
	className?: string
	static?: boolean
	motion?: TextureMotionOptions
}
const ALIGN = 3
const REACH = 260
const TAU_NEAR = 0.035
const TAU_FAR = 0.06
const TAU_HOME = 0.16
const DEAD_A = 0.6
const DEAD_S = 0.04
const WRITE_A = 0.2
const WRITE_S = 0.01
const arc = (deg: number) => (((deg % 180) + 270) % 180) - 90
export function Twist({ tokens, className = "", static: isStatic = false, motion }: TwistProps) {
	const ref = useRef<HTMLDivElement>(null)
	const bars = useRef<(SVGRectElement | null)[]>([])
	useEffect(() => {
		const root = ref.current
		if (!root || isStatic) return
		const n = CELLS.length
		const cx = new Float32Array(n)
		const cy = new Float32Array(n)
		for (let i = 0; i < n; i++) {
			const [x, y, w] = CELLS[i]!
			cx[i] = x + w / 2
			cy[i] = y + CELL_H / 2
		}
		const angle = new Float32Array(n)
		const thick = new Float32Array(n).fill(1)
		const wa = new Float32Array(n)
		const ws = new Float32Array(n).fill(1)
		const smax = T_MAX / T_MIN
		return engine(
			root,
			({ x, y, active, reduced }, dt) => {
				let moving = false
				for (let i = 0; i < n; i++) {
					const dx = x - cx[i]!
					const dy = y - cy[i]!
					const d = Math.sqrt(dx * dx + dy * dy)
					const bearing = (Math.atan2(dy, dx) * 180) / Math.PI - 90
					const influence = active * Math.max(0, 1 - d / REACH) ** 2
					const ta = arc(bearing) * influence
					const f = d < 1 ? 1 : Math.abs(Math.cos(2 * Math.atan2(dy, dx))) ** ALIGN
					const ts = 1 + (smax - 1) * f * influence
					const a = angle[i]!
					const s = thick[i]!
					if (a === ta && s === ts) continue
					let na: number
					let ns: number
					if (reduced) {
						na = ta
						ns = ts
					} else {
						const tau = active > 0 ? TAU_NEAR + (TAU_FAR - TAU_NEAR) * Math.min(1, d / REACH) : TAU_HOME
						const k = 1 - Math.exp(-dt / tau)
						na = a + arc(ta - a) * k
						ns = s + (ts - s) * k
						if (Math.abs(arc(ta - na)) < DEAD_A) na = ta
						if (Math.abs(ts - ns) < DEAD_S) ns = ts
					}
					angle[i] = na
					thick[i] = ns
					if (na !== ta || ns !== ts) moving = true
					if (
						Math.abs(na - wa[i]!) > WRITE_A ||
						Math.abs(ns - ws[i]!) > WRITE_S ||
						(na === 0 && ns === 1 && (wa[i] !== 0 || ws[i] !== 1))
					) {
						wa[i] = na
						ws[i] = ns
						const el = bars.current[i]
						if (el)
							el.style.transform = na === 0 && ns === 1 ? "" : `rotate(${na.toFixed(2)}deg) scaleX(${ns.toFixed(3)})`
					}
				}
				return moving
			},
			[160, 112],
			motion,
		)
	}, [isStatic, motion])
	const style = {
		"--texture-ink": "var(--foreground)",
		"--texture-field": "var(--background)",
		...tokens,
		color: "var(--texture-ink)",
		background: "var(--texture-field)",
	} as CSSProperties
	return (
		<div
			ref={ref}
			style={{
				position: "relative",
				isolation: "isolate",
				height: "100%",
				width: "100%",
				overflow: "clip",
				contain: "layout paint style",
				containerType: "size",
				...style,
			}}
			data-texture="twist"
			className={className}
		>
			<svg
				viewBox={`0 0 ${W} ${H}`}
				preserveAspectRatio="xMidYMid slice"
				aria-hidden="true"
				focusable="false"
				fill="currentColor"
				style={{ position: "absolute", inset: 0, display: "block", height: "100%", width: "100%" }}
			>
				{CELLS.map(([x, y, w], i) => (
					<svg key={i} x={x} y={y} width={w} height={CELL_H} viewBox={`0 0 ${w} ${CELL_H}`} overflow="hidden">
						<rect
							ref={(el) => {
								bars.current[i] = el
							}}
							x={(w - T_MIN) / 2}
							y={(CELL_H - BAR_LEN) / 2}
							width={T_MIN}
							height={BAR_LEN}
							style={{ transformBox: "fill-box", transformOrigin: "center" }}
						/>
					</svg>
				))}
			</svg>
		</div>
	)
}
