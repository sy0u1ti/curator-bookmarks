// Curtain - a Texture by Textures | https://textures.dev/s/curtain
// Install another: npx shadcn@latest add https://textures.dev/r/<slug>.json
// For agents: https://textures.md
// License: free to use
// Copyright (c) 2026 Textures (textures.dev). MIT; see ./LICENSE.
// Adapted for Curator: shared, on-demand pointer engine; static previews never animate.
import { type CSSProperties, useEffect, useRef } from 'react'
import { engine, type TextureMotionOptions } from './engine'
const W = 732
const H = 516
const N = 55
const X0 = 8
const PITCH = 13
const STRIPE = 2
const Y0 = 0
const Y1 = 516
const TWIST_MAX = 80
const REACH = 11
const SIGMA = 170
const W_MIN = 0.2
const SAMPLES = 40
export type CurtainProps = {
	tokens?: Partial<Record<"--texture-ink" | "--texture-field", string>>
	className?: string
	static?: boolean
	motion?: TextureMotionOptions
}
const TAU_NEAR = 0.03
const TAU_FAR = 0.14
const TAU_HOME = 0.2
const DEAD = 0.003
const rest = (i: number) => `M${X0 + i * PITCH} ${Y0}H${X0 + i * PITCH + STRIPE}V${Y1}H${X0 + i * PITCH}Z`
const share = (u: number) => {
	if (u >= REACH) return 0
	const v = 1 - u / REACH
	return v * v * (3 - 2 * v)
}
const SPAN = 3 * SIGMA
const RAD = Math.PI / 180
export function Curtain({ tokens, className = "", static: isStatic = false, motion }: CurtainProps) {
	const ref = useRef<HTMLDivElement>(null)
	const paths = useRef<(SVGPathElement | null)[]>([])
	useEffect(() => {
		const root = ref.current
		if (!root || isStatic) return
		const open = new Float32Array(N)
		const drawnOpen = new Float32Array(N)
		const drawnY = new Float32Array(N)
		const drawnX = new Float32Array(N)
		return engine(
			root,
			({ x, y, active, reduced }, dt) => {
				let moving = false
				for (let i = 0; i < N; i++) {
					const left = X0 + i * PITCH
					const mid = left + STRIPE / 2
					const u = Math.abs(mid - x) / PITCH
					const target = share(u) * active
					const o = open[i]!
					let next: number
					if (reduced) next = target
					else {
						const tau = active > 0 ? TAU_NEAR + (TAU_FAR - TAU_NEAR) * Math.min(1, u / REACH) : TAU_HOME
						next = o + (target - o) * (1 - Math.exp(-dt / tau))
						if (Math.abs(next - target) < DEAD) next = target
					}
					open[i] = next
					if (next !== target) moving = true
					const el = paths.current[i]
					if (!el) continue
					if (next === 0) {
						if (drawnOpen[i] !== 0) {
							drawnOpen[i] = 0
							el.setAttribute("d", rest(i))
						}
						continue
					}
					if (
						Math.abs(next - drawnOpen[i]!) < 0.002 &&
						Math.abs(y - drawnY[i]!) < 0.25 &&
						Math.abs(x - drawnX[i]!) < 0.25
					)
						continue
					drawnOpen[i] = next
					drawnY[i] = y
					drawnX[i] = x
					const top = Math.max(Y0, y - SPAN)
					const bottom = Math.min(Y1, y + SPAN)
					const at = (yy: number, which: -1 | 1) => {
						const dy = (yy - y) / SIGMA
						const theta = next * TWIST_MAX * Math.exp(-dy * dy) * RAD
						const w = Math.max(W_MIN, STRIPE * Math.abs(Math.cos(theta)))
						return (mid + (which * w) / 2).toFixed(2)
					}
					let d = `M${at(Y0, -1)} ${Y0}`
					if (top > Y0) d += `L${at(top, -1)} ${top.toFixed(2)}`
					for (let k = 1; k <= SAMPLES; k++) {
						const yy = top + ((bottom - top) * k) / SAMPLES
						d += `L${at(yy, -1)} ${yy.toFixed(2)}`
					}
					if (bottom < Y1) d += `L${at(Y1, -1)} ${Y1}`
					d += `L${at(Y1, 1)} ${Y1}`
					if (bottom < Y1) d += `L${at(bottom, 1)} ${bottom.toFixed(2)}`
					for (let k = SAMPLES - 1; k >= 0; k--) {
						const yy = top + ((bottom - top) * k) / SAMPLES
						d += `L${at(yy, 1)} ${yy.toFixed(2)}`
					}
					if (top > Y0) d += `L${at(Y0, 1)} ${Y0}`
					d += "Z"
					el.setAttribute("d", d)
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
			data-texture="curtain"
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
				{Array.from({ length: N }, (_, i) => (
					<path
						key={i}
						ref={(el) => {
							paths.current[i] = el
						}}
						d={rest(i)}
					/>
				))}
			</svg>
		</div>
	)
}
