// Watch - a Texture by Textures | https://textures.dev/s/watch
// Install another: npx shadcn@latest add https://textures.dev/r/<slug>.json
// For agents: https://textures.md
// License: free to use
// Copyright (c) 2026 Textures (textures.dev). MIT; see ./LICENSE.
// Adapted for Curator: shared, on-demand pointer engine; static previews never animate.
import { type CSSProperties, useEffect, useRef, useId } from 'react'
import { engine, type TextureMotionOptions } from './engine'
const W = 732
const H = 516
const COLS = 27
const ROWS = 19
const CELL = 23.58
const PITCH = 26.08
const X0 = 15
const Y0 = 11.49
const DIM = 0.065
const SIZES: number[] = [14, 13, 12, 10.8, 9.1, 7.5, 6.3, 5.2, 4.4, 3.77]
const S_MIN = 3.77
const EYE = 0.85
const EYE_REACH = 14
const TAU_NEAR = 0.045
const TAU_FAR = 0.14
export type WatchProps = {
	tokens?: Partial<Record<"--texture-ink" | "--texture-field", string>>
	className?: string
	static?: boolean
	motion?: TextureMotionOptions
}
const N = COLS * ROWS
const REST = S_MIN / CELL
const sizeAt = (d: number) => {
	const i = Math.min(SIZES.length - 1, d)
	const k = Math.floor(i)
	const f = i - k
	return k >= SIZES.length - 1 ? SIZES[SIZES.length - 1]! : SIZES[k]! * (1 - f) + SIZES[k + 1]! * f
}
export function Watch({ tokens, className = "", static: isStatic = false, motion }: WatchProps) {
	const ref = useRef<HTMLDivElement>(null)
	const squares = useRef<(SVGRectElement | null)[]>([])
	const uid = useId().replace(/[^a-zA-Z0-9]/g, "")
	const patternId = `watch-cells-${uid}`
	useEffect(() => {
		const root = ref.current
		if (!root || isStatic) return
		const size = new Float32Array(N).fill(S_MIN)
		const ox = new Float32Array(N)
		const oy = new Float32Array(N)
		const written = new Float32Array(N * 3).fill(Infinity)
		return engine(
			root,
			({ x, y, active, reduced }, dt) => {
				let moving = false
				const cx = (x - X0 - CELL / 2) / PITCH
				const cy = (y - Y0 - CELL / 2) / PITCH
				for (let i = 0; i < N; i++) {
					const c = i % COLS
					const r = Math.floor(i / COLS)
					const dx = cx - c
					const dy = cy - r
					const d = Math.hypot(dx, dy)
					const wantSize = S_MIN + (sizeAt(d) - S_MIN) * active
					const room =
						((CELL - wantSize) / 2) * EYE * active * (d < EYE_REACH ? 1 : Math.max(0, 1 - (d - EYE_REACH) / 3))
					const wantX = d > 0.001 ? (dx / d) * room : 0
					const wantY = d > 0.001 ? (dy / d) * room : 0
					let s = size[i]!
					let px = ox[i]!
					let py = oy[i]!
					if (reduced) {
						s = wantSize
						px = wantX
						py = wantY
					} else {
						const tau = TAU_NEAR + (TAU_FAR - TAU_NEAR) * Math.min(1, d / EYE_REACH)
						const k = 1 - Math.exp(-dt / tau)
						s += (wantSize - s) * k
						px += (wantX - px) * k
						py += (wantY - py) * k
						if (Math.abs(s - wantSize) < 0.02 && Math.abs(px - wantX) < 0.02 && Math.abs(py - wantY) < 0.02) {
							s = wantSize
							px = wantX
							py = wantY
						} else moving = true
					}
					size[i] = s
					ox[i] = px
					oy[i] = py
					const j = i * 3
					const restNow = s === S_MIN && px === 0 && py === 0
					if (
						(restNow && (written[j] !== S_MIN || written[j + 1] !== 0 || written[j + 2] !== 0)) ||
						Math.abs(s - written[j]!) > 0.03 ||
						Math.abs(px - written[j + 1]!) > 0.1 ||
						Math.abs(py - written[j + 2]!) > 0.1
					) {
						written[j] = s
						written[j + 1] = px
						written[j + 2] = py
						const el = squares.current[i]
						if (el) {
							const sc = s / CELL
							el.style.transform =
								s === S_MIN && px === 0 && py === 0
									? `scale(${REST.toFixed(4)})`
									: `translate(${px.toFixed(2)}px, ${py.toFixed(2)}px) scale(${sc.toFixed(4)})`
						}
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
			data-texture="watch"
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
				<defs>
					<pattern id={patternId} x={X0} y={Y0} width={PITCH} height={PITCH} patternUnits="userSpaceOnUse">
						<rect width={CELL} height={CELL} rx={CELL / 2} fillOpacity={DIM} />
					</pattern>
				</defs>
				<rect x={X0} y={Y0} width={COLS * PITCH} height={ROWS * PITCH} fill={`url(#${patternId})`} />
				{Array.from({ length: N }, (_, i) => (
					<rect
						key={i}
						ref={(el) => {
							squares.current[i] = el
						}}
						x={(X0 + (i % COLS) * PITCH).toFixed(2)}
						y={(Y0 + Math.floor(i / COLS) * PITCH).toFixed(2)}
						width={CELL}
						height={CELL}
						rx={CELL / 2}
						style={{ transformBox: "fill-box", transformOrigin: "center", transform: `scale(${REST.toFixed(4)})` }}
					/>
				))}
			</svg>
		</div>
	)
}
