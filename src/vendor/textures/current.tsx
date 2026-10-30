// Current - a Texture by Textures | https://textures.dev/s/current
// Install another: npx shadcn@latest add https://textures.dev/r/<slug>.json
// For agents: https://textures.md
// License: free to use
// Copyright (c) 2026 Textures (textures.dev). MIT; see ./LICENSE.
// Adapted for Curator: shared, on-demand pointer engine; static previews never animate.
import { type CSSProperties, useEffect, useRef } from 'react'
import { engine, type TextureMotionOptions } from './engine'
const W = 732
const H = 516
const DASH_H = 1.2
const XS: number[] = Array.from({ length: 37 }, (_, i) => 12 + i * 708 / 36)
const WIDTHS: number[] = XS.map(() => 7.5)
const ROWS = 27
const Y0 = 6
const DY = 504 / (ROWS - 1)
const COLS = XS.length
const DASHES: [number, number, number][] = []
for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) DASHES.push([XS[c]!, Y0 + r * DY, WIDTHS[c]!])
export type CurrentProps = {
	tokens?: Partial<Record<"--texture-ink" | "--texture-field", string>>
	className?: string
	static?: boolean
	motion?: TextureMotionOptions
}
const STEP = 45
const SPAN = 2
const RADIUS = 2.5
const TAU_SNAP = 0.03
const TAU_RING = 0.04
const TAU_CORNER = 0.025
const TAU_HOME = 0.045
const TAU_HOME_RING = 0.03
const DIR_EASE = 0.5
const STILL = 0.4
const HYSTERESIS = 8
const DEAD = 0.05
const arc = (deg: number) => (((deg % 180) + 270) % 180) - 90
export function Current({ tokens, className = "", static: isStatic = false, motion }: CurrentProps) {
	const ref = useRef<HTMLDivElement>(null)
	const rects = useRef<(SVGRectElement | null)[]>([])
	useEffect(() => {
		const root = ref.current
		if (!root || isStatic) return
		const n = DASHES.length
		const angle = new Float32Array(n)
		const target = new Float32Array(n)
		const tau = new Float32Array(n).fill(TAU_HOME)
		const home = new Float32Array(n).fill(TAU_HOME)
		const written = new Float32Array(n)
		const centres = XS.map((x, i) => x + DASHES[i]![2] / 2)
		let lx = NaN
		let ly = NaN
		let dx = 1
		let dy = 0
		let step = 0
		let lastActive = 0
		return engine(
			root,
			({ x, y, active, reduced }, dt) => {
				if (!Number.isNaN(lx)) {
					const sx = x - lx
					const sy = y - ly
					const len = Math.hypot(sx, sy)
					if (len > STILL) {
						const k = reduced ? 1 : 1 - (1 - DIR_EASE) ** (dt * 60)
						dx += (sx / len - dx) * k
						dy += (sy / len - dy) * k
						const m = Math.hypot(dx, dy) || 1
						dx /= m
						dy /= m
						const deg = ((((Math.atan2(dy, dx) * 180) / Math.PI) % 180) + 180) % 180
						const away = Math.abs(arc(deg - step))
						if (away > STEP / 2 + HYSTERESIS) step = (Math.round(deg / STEP) * STEP) % 180
					}
				}
				lx = x
				ly = y
				target.fill(0)
				const on = active > 0.5 || active > lastActive
				lastActive = active
				if (on) {
					let c0 = 0
					for (let c = 1; c < COLS; c++) if (Math.abs(centres[c]! - x) < Math.abs(centres[c0]! - x)) c0 = c
					const r0 = Math.min(ROWS - 1, Math.max(0, Math.round((y - Y0 - DASH_H / 2) / DY)))
					const reach = Math.floor(RADIUS)
					for (let j = -reach; j <= reach; j++)
						for (let k = -reach; k <= reach; k++) {
							if (j * j + k * k > RADIUS * RADIUS) continue
							const c = c0 + k * SPAN
							const r = r0 + j * SPAN
							if (c < 0 || c >= COLS || r < 0 || r >= ROWS) continue
							const i = r * COLS + c
							const ring = Math.max(Math.abs(j), Math.abs(k))
							const corner = j !== 0 && k !== 0
							target[i] = arc(corner ? step + STEP : step)
							tau[i] = TAU_SNAP + ring * TAU_RING + (corner ? TAU_CORNER : 0)
							home[i] = TAU_HOME + ring * TAU_HOME_RING
						}
				}
				let moving = false
				for (let i = 0; i < n; i++) {
					const a = angle[i]!
					const t = target[i]!
					if (a === t) {
						if (t === 0) tau[i] = home[i]!
						continue
					}
					let next: number
					if (reduced) next = t
					else {
						const way = arc(t - a)
						next = a + way * (1 - Math.exp(-dt / tau[i]!))
						if (Math.abs(arc(t - next)) < DEAD) next = t
					}
					angle[i] = next
					if (next !== t) moving = true
					else if (t === 0) tau[i] = home[i]!
					if (Math.abs(next - written[i]!) > 0.05 || (next === 0 && written[i] !== 0)) {
						written[i] = next
						const el = rects.current[i]
						if (el) el.style.transform = next === 0 ? "" : `rotate(${next.toFixed(2)}deg)`
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
			data-texture="current"
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
				{DASHES.map(([x, y, w], i) => (
					<rect
						key={i}
						ref={(el) => {
							rects.current[i] = el
						}}
						x={x}
						y={y}
						width={w}
						height={DASH_H}
						style={{ transformBox: "fill-box", transformOrigin: "center" }}
					/>
				))}
			</svg>
		</div>
	)
}
