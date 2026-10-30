// Sphere - a Texture by Textures | https://textures.dev/s/sphere
// Install another: npx shadcn@latest add https://textures.dev/r/<slug>.json
// For agents: https://textures.md
// License: free to use
// Copyright (c) 2026 Textures (textures.dev). MIT; see ./LICENSE.
// Adapted for Curator: shared, on-demand pointer engine; static previews never animate.
import { type CSSProperties, useEffect, useRef } from 'react'
import { engine, type TextureMotionOptions } from './engine'
const W = 732
const H = 516
const COLS = 34
const ROWS = 24
const PITCH = W / (COLS - 1)
const Y0 = (H - (ROWS - 1) * PITCH) / 2
const RADIUS = 2.2
const BALL = 135
const SHADE_REACH = 0.45
const HILL = 0.47
const MAX_SCALE = 1.3
const SHADE_MIN = 0.08
const LIGHT_Z = 0.55
const LIGHT_REST_X = -0.5
const LIGHT_REST_Y = -0.4
const LAG = 0.9
const LAG_SPEED = 900
const LAG_OMEGA = 28
const OMEGA = 30
const ZETA = 1
export type SphereProps = {
	tokens?: Partial<Record<"--texture-ink" | "--texture-field", string>>
	className?: string
	static?: boolean
	motion?: TextureMotionOptions
}
const N = COLS * ROWS
const smooth = (t: number) => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t))
export function Sphere({ tokens, className = "", static: isStatic = false, motion }: SphereProps) {
	const ref = useRef<HTMLDivElement>(null)
	const dots = useRef<(SVGCircleElement | null)[]>([])
	useEffect(() => {
		const root = ref.current
		if (!root || isStatic) return
		const writtenR = new Float32Array(N).fill(1)
		const writtenT = new Float32Array(N).fill(1)
		let bx = W / 2
		let by = H / 2
		let vx = 0
		let vy = 0
		let press = 0
		let vPress = 0
		const spring = (v: number, from: number, to: number, dt: number, w = OMEGA, z = ZETA) =>
			v + (w * w * (to - from) - 2 * z * w * v) * dt
		let lx = LIGHT_REST_X
		let ly = LIGHT_REST_Y
		let vlx = 0
		let vly = 0
		const writtenX = new Float32Array(N)
		const writtenY = new Float32Array(N)
		return engine(
			root,
			({ x, y, active, reduced }, dt) => {
				if (reduced) return false
				vx = spring(vx, bx, x, dt)
				bx += vx * dt
				vy = spring(vy, by, y, dt)
				by += vy * dt
				vPress = spring(vPress, press, active, dt)
				press += vPress * dt
				const speed = Math.hypot(vx, vy)
				const swing = Math.min(1, speed / LAG_SPEED)
				const tx = LIGHT_REST_X + ((speed > 1 ? (vx / speed) * LAG : 0) - LIGHT_REST_X) * swing
				const ty = LIGHT_REST_Y + ((speed > 1 ? (vy / speed) * LAG : 0) - LIGHT_REST_Y) * swing
				vlx = spring(vlx, lx, tx, dt, LAG_OMEGA, 1)
				lx += vlx * dt
				vly = spring(vly, ly, ty, dt, LAG_OMEGA, 1)
				ly += vly * dt
				const settled =
					Math.abs(bx - x) < 0.05 &&
					Math.abs(by - y) < 0.05 &&
					Math.abs(vx) + Math.abs(vy) < 0.5 &&
					Math.abs(press - active) < 0.001 &&
					Math.abs(vPress) < 0.01 &&
					Math.abs(lx - LIGHT_REST_X) + Math.abs(ly - LIGHT_REST_Y) < 0.002 &&
					Math.abs(vlx) + Math.abs(vly) < 0.02
				if (settled) {
					bx = x
					by = y
					press = active
					lx = LIGHT_REST_X
					ly = LIGHT_REST_Y
					vx = vy = vPress = vlx = vly = 0
				}
				const ln = Math.hypot(lx, ly, LIGHT_Z)
				const Lx = lx / ln
				const Ly = ly / ln
				const Lz = LIGHT_Z / ln
				for (let i = 0; i < N; i++) {
					const cx = (i % COLS) * PITCH
					const cy = Y0 + Math.floor(i / COLS) * PITCH
					const dx = cx - bx
					const dy = cy - by
					let sr = 1
					let st = 1
					let mx = 0
					let my = 0
					if (press > 0.001) {
						const d = Math.hypot(dx, dy)
						if (d > 0.001 && d < BALL * (1 + SHADE_REACH)) {
							const rho = Math.min(1, d / BALL)
							const ux = dx / d
							const uy = dy / d
							const q = 1 - rho * rho
							const lift = HILL * q * q
							const radial = Math.max(0.3, 1 + lift - 4 * HILL * rho * rho * q)
							const tangential = 1 + lift
							const nz = Math.sqrt(q)
							const lit = rho * (ux * Lx + uy * Ly) + nz * Lz
							const beyond = d > BALL ? smooth((d - BALL) / (BALL * SHADE_REACH)) : 0
							const shade = 1 - (1 - (SHADE_MIN + (1 - SHADE_MIN) * smooth((lit + 0.25) / 1.05))) * (1 - beyond)
							const w = press
							mx = lift * d * ux * w
							my = lift * d * uy * w
							sr = 1 + (Math.min(MAX_SCALE, radial) * shade - 1) * w
							st = 1 + (Math.min(MAX_SCALE, tangential) * shade - 1) * w
						}
					}
					const atRest = press <= 0.001
					if (
						settled ||
						(atRest && (writtenR[i] !== 1 || writtenT[i] !== 1 || writtenX[i] !== 0 || writtenY[i] !== 0)) ||
						Math.abs(sr - writtenR[i]!) > 0.004 ||
						Math.abs(st - writtenT[i]!) > 0.004 ||
						Math.abs(mx - writtenX[i]!) > 0.15 ||
						Math.abs(my - writtenY[i]!) > 0.15
					) {
						writtenR[i] = sr
						writtenT[i] = st
						writtenX[i] = mx
						writtenY[i] = my
						const el = dots.current[i]
						if (el) {
							if (sr === 1 && st === 1 && mx === 0 && my === 0) el.style.transform = ""
							else {
								const angle = (Math.atan2(dy, dx) * 180) / Math.PI
								el.style.transform = `translate(${mx.toFixed(1)}px, ${my.toFixed(1)}px) rotate(${angle.toFixed(1)}deg) scale(${sr.toFixed(3)}, ${st.toFixed(3)})`
							}
						}
					}
				}
				return !settled
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
			data-texture="sphere"
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
					<circle
						key={i}
						ref={(el) => {
							dots.current[i] = el
						}}
						cx={((i % COLS) * PITCH).toFixed(2)}
						cy={(Y0 + Math.floor(i / COLS) * PITCH).toFixed(2)}
						r={RADIUS}
						style={{ transformBox: "fill-box", transformOrigin: "center" }}
					/>
				))}
			</svg>
		</div>
	)
}
