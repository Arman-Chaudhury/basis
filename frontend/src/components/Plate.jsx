import React, { useEffect, useImperativeHandle, useMemo, useRef, forwardRef } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import * as THREE from 'three'

/* Chladni plate: amplitude u(x,y) = cos(n·π·x)·cos(m·π·y) − cos(m·π·x)·cos(n·π·y), x,y ∈ [−1,1].
   Grains drift down the gradient of |u| toward nodal lines; `sharp` (0..1) scales how tightly they lock
   (jitter = (1 − sharp)). In Basis the mode numbers come from an event's probabilities and `sharp` from trust. */
export function amp(x, y, m, n) {
  const PI = Math.PI
  return Math.cos(n * PI * x) * Math.cos(m * PI * y) - Math.cos(m * PI * x) * Math.cos(n * PI * y)
}

function Grains({ api, count }) {
  const ref = useRef()
  const state = useRef({ m: 3, n: 5, sharp: 0.6, tm: 3, tn: 5, tsharp: 0.6 })
  const pos = useMemo(() => {
    const a = new Float32Array(count * 3)
    for (let i = 0; i < count; i++) { a[i * 3] = Math.random() * 2 - 1; a[i * 3 + 1] = Math.random() * 2 - 1; a[i * 3 + 2] = 0 }
    return a
  }, [count])
  useImperativeHandle(api, () => ({ set: ({ m, n, sharp }) => { const s = state.current; if (m != null) s.tm = m; if (n != null) s.tn = n; if (sharp != null) s.tsharp = sharp } }), [])
  useFrame((_, dt) => {
    const s = state.current
    const k = 1 - Math.exp(-dt * 1.8)
    s.m += (s.tm - s.m) * k; s.n += (s.tn - s.n) * k; s.sharp += (s.tsharp - s.sharp) * k
    const { m, n, sharp } = s
    const step = 0.012, h = 0.004, jitter = 0.0035 * (1.1 - sharp) + 0.0004
    const arr = ref.current.geometry.attributes.position.array
    for (let i = 0; i < count; i++) {
      let x = arr[i * 3], y = arr[i * 3 + 1]
      const u = amp(x, y, m, n)
      const gx = (Math.abs(amp(x + h, y, m, n)) - Math.abs(amp(x - h, y, m, n))) / (2 * h)
      const gy = (Math.abs(amp(x, y + h, m, n)) - Math.abs(amp(x, y - h, m, n))) / (2 * h)
      const g = Math.hypot(gx, gy) + 1e-6
      const drive = Math.min(Math.abs(u) * 2.2, 1) * step
      x -= (gx / g) * drive + (Math.random() - 0.5) * jitter
      y -= (gy / g) * drive + (Math.random() - 0.5) * jitter
      if (x < -1 || x > 1 || y < -1 || y > 1) { x = Math.random() * 2 - 1; y = Math.random() * 2 - 1 }
      arr[i * 3] = x; arr[i * 3 + 1] = y
    }
    ref.current.geometry.attributes.position.needsUpdate = true
  })
  return (
    <points ref={ref}>
      <bufferGeometry><bufferAttribute attach="attributes-position" args={[pos, 3]} /></bufferGeometry>
      <pointsMaterial size={0.0085} color="#EDE8DF" sizeAttenuation transparent opacity={0.9} depthWrite={false} />
    </points>
  )
}

// 2D canvas fallback (no WebGL): same sim, fewer grains.
function Plate2D({ api, count }) {
  const ref = useRef()
  const state = useRef({ m: 3, n: 5, sharp: 0.6, tm: 3, tn: 5, tsharp: 0.6 })
  useImperativeHandle(api, () => ({ set: ({ m, n, sharp }) => { const s = state.current; if (m != null) s.tm = m; if (n != null) s.tn = n; if (sharp != null) s.tsharp = sharp } }), [])
  useEffect(() => {
    const cv = ref.current, ctx = cv.getContext('2d')
    const P = new Float32Array(count * 2); for (let i = 0; i < count * 2; i++) P[i] = Math.random() * 2 - 1
    let raf, last = performance.now()
    const draw = now => {
      const dt = Math.min((now - last) / 1000, 0.05); last = now
      const s = state.current, k = 1 - Math.exp(-dt * 1.8)
      s.m += (s.tm - s.m) * k; s.n += (s.tn - s.n) * k; s.sharp += (s.tsharp - s.sharp) * k
      const W = cv.width = cv.clientWidth * devicePixelRatio, H = cv.height = cv.clientHeight * devicePixelRatio
      const R = Math.min(W, H) * 0.42, cx = W / 2, cy = H / 2
      ctx.clearRect(0, 0, W, H); ctx.fillStyle = 'rgba(237,232,223,0.9)'
      const step = 0.012, h = 0.004, jitter = 0.0035 * (1.1 - s.sharp) + 0.0004
      for (let i = 0; i < count; i++) {
        let x = P[i * 2], y = P[i * 2 + 1]
        const u = amp(x, y, s.m, s.n)
        const gx = (Math.abs(amp(x + h, y, s.m, s.n)) - Math.abs(amp(x - h, y, s.m, s.n))) / (2 * h)
        const gy = (Math.abs(amp(x, y + h, s.m, s.n)) - Math.abs(amp(x, y - h, s.m, s.n))) / (2 * h)
        const g = Math.hypot(gx, gy) + 1e-6, drive = Math.min(Math.abs(u) * 2.2, 1) * step
        x -= (gx / g) * drive + (Math.random() - 0.5) * jitter; y -= (gy / g) * drive + (Math.random() - 0.5) * jitter
        if (x < -1 || x > 1 || y < -1 || y > 1) { x = Math.random() * 2 - 1; y = Math.random() * 2 - 1 }
        P[i * 2] = x; P[i * 2 + 1] = y
        ctx.fillRect(cx + x * R, cy + y * R, 1.4 * devicePixelRatio, 1.4 * devicePixelRatio)
      }
      raf = requestAnimationFrame(draw)
    }
    raf = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(raf)
  }, [count])
  return <canvas ref={ref} className="absolute inset-0 w-full h-full" />
}

class Boundary extends React.Component {
  constructor(p) { super(p); this.state = { err: false } }
  static getDerivedStateFromError() { return { err: true } }
  render() { return this.state.err ? this.props.fallback : this.props.children }
}
function hasWebGL() { try { const c = document.createElement('canvas'); return !!(c.getContext('webgl2') || c.getContext('webgl')) } catch { return false } }

/* Full-screen plate. `api` ref exposes set({m,n,sharp}). */
const Plate = forwardRef(function Plate({ className = '', count }, api) {
  const gl = useMemo(hasWebGL, [])
  const n = count || (gl ? (window.innerWidth < 800 ? 9000 : 18000) : 5000)
  const fallback = <Plate2D api={api} count={Math.min(n, 6000)} />
  return (
    <div className={`absolute inset-0 ${className}`}>
      {gl ? (
        <Boundary fallback={fallback}>
          <Canvas dpr={[1, 1.5]} orthographic camera={{ position: [0, 0, 5], zoom: 1 }} gl={{ antialias: false, alpha: true }}
            onCreated={({ camera, size }) => { const s = Math.min(size.width, size.height) * 0.42; camera.zoom = s; camera.updateProjectionMatrix() }}>
            <Resize />
            <Grains api={api} count={n} />
          </Canvas>
        </Boundary>
      ) : fallback}
    </div>
  )
})
function Resize() {
  useFrame(({ camera, size }) => { const s = Math.min(size.width, size.height) * 0.42; if (Math.abs(camera.zoom - s) > 1) { camera.zoom = s; camera.updateProjectionMatrix() } })
  return null
}
export default Plate

/* Static thumbnail of a figure: draws the nodal lines analytically. */
export function Figure({ m, n, sharp = 0.7, size = 160, className = '' }) {
  const ref = useRef()
  useEffect(() => {
    const cv = ref.current, ctx = cv.getContext('2d'), S = size * devicePixelRatio
    cv.width = cv.height = S
    const img = ctx.createImageData(S, S), d = img.data
    const eps = 0.06 + (1 - sharp) * 0.16
    for (let j = 0; j < S; j++) for (let i = 0; i < S; i++) {
      const x = (i / S) * 2 - 1, y = (j / S) * 2 - 1
      const a = Math.abs(amp(x, y, m, n))
      const v = a < eps ? 1 - a / eps : 0
      const o = (j * S + i) * 4; d[o] = 237; d[o + 1] = 232; d[o + 2] = 223; d[o + 3] = Math.floor(v * (120 + 120 * sharp))
    }
    ctx.putImageData(img, 0, 0)
  }, [m, n, sharp, size])
  return <canvas ref={ref} style={{ width: size, height: size }} className={className} />
}

/* Map an event's numbers to plate parameters (documented in the Landing chapters). */
export function paramsFor(e) {
  if (!e) return { m: 3, n: 5, sharp: 0.6 }
  const p = e.p_calibrated ?? e.p_raw ?? 0.5
  const m = 1 + p * 6                       // 1..7 from calibrated probability
  const b = Math.min(Math.abs(e.basis ?? 0), 0.3) / 0.3
  const n = 2 + b * 5 + (e.id.length % 3)   // 2..9 from |basis| (plus a per-event offset so no two are identical)
  const sharp = Math.max(0.15, Math.min(1, (e.trust_score ?? 50) / 100))
  return { m: +m.toFixed(2), n: +n.toFixed(2), sharp }
}
