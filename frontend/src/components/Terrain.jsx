import React, { useEffect, useImperativeHandle, useMemo, useRef, forwardRef } from 'react'
import * as THREE from 'three'
import { Canvas, useFrame, useThree } from '@react-three/fiber'

/* A stepped contour landscape of the event map, in one fragment shader.
   Height = Σ_i h_i · exp(−|q − c_i|² / σ_i²): one peak per event, placed by (basis, trust),
   height from raw / calibrated / |basis| (uMorph blends between them), width from trust
   (a high-trust market is a sharp peak; a rumor is a smear). Contours at 1/N height steps,
   each step casts a soft shadow and carries a faint spectral fringe, like stacked layers. */
const MAX_EV = 24
const FRAG = /* glsl */`
precision highp float;
uniform vec2 uCenter[${MAX_EV}];
uniform vec3 uHeight[${MAX_EV}];   // raw, calibrated, |basis|
uniform float uSigma[${MAX_EV}];
uniform int uCount;
uniform float uMorph;      // 0 raw → 1 calibrated → 2 basis
uniform float uTime;
uniform float uSteps;      // contours per unit height
uniform float uFringe;     // iridescence strength
uniform float uGrain;
uniform vec2 uMouse;       // plane coords
uniform float uMouseStrength;
uniform vec3 uBase;
in vec2 vPlane;
in vec3 vViewPos;
out vec4 fragColor;

vec3 mod289(vec3 x){return x-floor(x*(1.0/289.0))*289.0;}
vec2 mod289(vec2 x){return x-floor(x*(1.0/289.0))*289.0;}
vec3 permute(vec3 x){return mod289(((x*34.0)+1.0)*x);}
float snoise(vec2 v){const vec4 C=vec4(0.211324865405187,0.366025403784439,-0.577350269189626,0.024390243902439);vec2 i=floor(v+dot(v,C.yy));vec2 x0=v-i+dot(i,C.xx);vec2 i1=(x0.x>x0.y)?vec2(1.0,0.0):vec2(0.0,1.0);vec4 x12=x0.xyxy+C.xxzz;x12.xy-=i1;i=mod289(i);vec3 p=permute(permute(i.y+vec3(0.0,i1.y,1.0))+i.x+vec3(0.0,i1.x,1.0));vec3 m=max(0.5-vec3(dot(x0,x0),dot(x12.xy,x12.xy),dot(x12.zw,x12.zw)),0.0);m=m*m;m=m*m;vec3 x=2.0*fract(p*C.www)-1.0;vec3 h=abs(x)-0.5;vec3 ox=floor(x+0.5);vec3 a0=x-ox;m*=1.79284291400159-0.85373472095314*(a0*a0+h*h);vec3 g;g.x=a0.x*x0.x+h.x*x0.y;g.yz=a0.yz*x12.xz+h.yz*x12.yw;return 130.0*dot(m,g);}
float hash(vec2 p){return fract(sin(dot(p,vec2(12.9898,78.233)))*43758.5453);}

float height(vec2 q) {
  float h = 0.0;
  for (int i = 0; i < ${MAX_EV}; i++) {
    if (i >= uCount) break;
    vec3 hh = uHeight[i];
    float a = uMorph < 1.0 ? mix(hh.x, hh.y, uMorph) : mix(hh.y, hh.z, clamp(uMorph - 1.0, 0.0, 1.0));
    vec2 d = q - uCenter[i];
    float s = uSigma[i];
    h += a * exp(-dot(d, d) / (s * s));
  }
  h += 0.06 * snoise(q * 0.9 + uTime * 0.02) + 0.025 * snoise(q * 2.3 - uTime * 0.03);
  vec2 dm = q - uMouse;
  h += uMouseStrength * 0.25 * exp(-dot(dm, dm) / 0.08);
  return h;
}
vec3 spectral(float t) { // soft rainbow
  return 0.5 + 0.5 * cos(6.28318 * (t + vec3(0.0, 0.33, 0.67)));
}
void main() {
  vec2 q = vPlane;
  float e = 0.012;
  float h = height(q);
  float hx = height(q + vec2(e, 0.0)) - height(q - vec2(e, 0.0));
  float hy = height(q + vec2(0.0, e)) - height(q - vec2(0.0, e));
  vec3 n = normalize(vec3(-hx / (2.0 * e) * 0.35, -hy / (2.0 * e) * 0.35, 1.0));
  vec3 L = normalize(vec3(-0.5, -0.35, 0.8));
  float diffuse = 0.75 + 0.25 * max(dot(n, L), 0.0);

  float level = h * uSteps + uTime * 0.25;   // rings rise slowly
  float f = fract(level);
  float slope = length(vec2(hx, hy)) / (2.0 * e) * uSteps;
  float aa = clamp(slope * 0.02, 0.004, 0.08);
  // riser shadow: just above each step edge the next layer shades the one below
  float shadow = 1.0 - 0.7 * (1.0 - smoothstep(0.0, 0.26, f)) * smoothstep(0.02, 0.4, slope * 0.05 + 0.02);
  // top-edge highlight
  float edge = 1.0 - smoothstep(0.0, aa * 2.0, abs(f - 0.98));
  vec3 base = uBase * diffuse * shadow;
  // iridescent fringe keyed to the layer index, strongest at the riser
  float k = floor(level);
  float fr = (1.0 - smoothstep(0.0, 0.3, f)) * smoothstep(0.03, 0.4, slope * 0.05);
  vec3 col = mix(base, spectral(k * 0.07 + 0.1 * uTime * 0.0 + h * 0.5), uFringe * fr);
  col += edge * 0.12;
  // atmosphere: fade with distance, lift to white at the horizon
  float dist = clamp((-vViewPos.z - 1.5) / 6.0, 0.0, 1.0);
  col = mix(col, vec3(0.96), dist * 0.65);
  col += (hash(gl_FragCoord.xy + fract(uTime)) - 0.5) * uGrain;
  fragColor = vec4(col, 1.0);
}`
const VERT = /* glsl */`
precision highp float;
uniform mat4 modelViewMatrix, projectionMatrix;
in vec3 position; in vec2 uv;
out vec2 vPlane; out vec3 vViewPos;
void main() {
  vPlane = (uv - 0.5) * 7.0;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vViewPos = mv.xyz;
  gl_Position = projectionMatrix * mv;
}`

const CAMS = {
  hero: { pos: [0.0, -3.6, 2.5], target: [0, 0.6, 0] },
  high: { pos: [0.0, -2.2, 4.2], target: [0, 0.2, 0] },
  low: { pos: [1.2, -4.2, 1.6], target: [0.2, 0.4, 0] },
}

function Field({ api }) {
  const { camera } = useThree()
  const st = useRef({ morph: 0, tMorph: 0, cam: 'hero', mouse: [0, 0], mouseS: 0, mouseT: 0 })
  const mat = useMemo(() => new THREE.RawShaderMaterial({ glslVersion: THREE.GLSL3, vertexShader: VERT, fragmentShader: FRAG,
    uniforms: { uCenter: { value: Array.from({ length: MAX_EV }, () => new THREE.Vector2()) }, uHeight: { value: Array.from({ length: MAX_EV }, () => new THREE.Vector3()) }, uSigma: { value: new Float32Array(MAX_EV).fill(0.5) }, uCount: { value: 0 }, uMorph: { value: 0 }, uTime: { value: 0 }, uSteps: { value: 14 }, uFringe: { value: 0.45 }, uGrain: { value: 0.06 }, uMouse: { value: new THREE.Vector2(99, 99) }, uMouseStrength: { value: 0 }, uBase: { value: new THREE.Color('#E9E9E7') } } }), [])
  const tmp = useMemo(() => ({ v: new THREE.Vector3(), t: new THREE.Vector3() }), [])
  useImperativeHandle(api, () => ({
    setEvents: evs => {
      const u = mat.uniforms; const n = Math.min(evs.length, MAX_EV)
      evs.slice(0, n).forEach((e, i) => {
        const trust = Math.min(Math.max((e.trust_score ?? 50) / 100, 0.05), 1)
        const b = Math.max(-0.25, Math.min(0.25, e.basis ?? 0))
        // place: x by basis (centre = no proxy / zero basis), y by trust; jitter by index so no two overlap
        const ang = (i / n) * Math.PI * 2
        u.uCenter.value[i].set(b * 7 + Math.cos(ang) * 1.3, (trust - 0.5) * 3.2 + Math.sin(ang) * 0.9)
        u.uHeight.value[i].set((e.p_raw ?? 0.5) * 1.0, (e.p_calibrated ?? 0.5) * 1.0, Math.abs(e.basis ?? 0) * 3.5 + 0.1)
        u.uSigma.value[i] = 0.35 + (1 - trust) * 1.1
      })
      u.uCount.value = n
    },
    set: ({ morph, camera: c, mouse }) => { const s = st.current; if (morph != null) s.tMorph = morph; if (c) s.cam = c; if (mouse) { s.mouse = mouse; s.mouseS = 1; s.mouseT = 0 } },
  }), [mat])
  useEffect(() => { camera.up.set(0, 0, 1); camera.position.set(...CAMS.hero.pos); camera.lookAt(...CAMS.hero.target) }, [])
  useFrame((_, delta) => {
    const dt = Math.min(delta, 1 / 30), s = st.current, u = mat.uniforms
    s.morph += (s.tMorph - s.morph) * (1 - Math.exp(-dt * 1.6))
    u.uMorph.value = s.morph; u.uTime.value += dt
    s.mouseT += dt; u.uMouseStrength.value = s.mouseS * Math.exp(-s.mouseT * 1.2); u.uMouse.value.set(s.mouse[0], s.mouse[1])
    const c = CAMS[s.cam] || CAMS.hero
    tmp.v.set(...c.pos); camera.position.lerp(tmp.v, 1 - Math.exp(-dt * 1.2)); tmp.t.set(...c.target); camera.lookAt(tmp.t)
  })
  return <mesh material={mat}><planeGeometry args={[14, 14, 1, 1]} /></mesh>
}

function Pointer({ api }) {
  const { gl, camera } = useThree()
  useEffect(() => {
    const ray = new THREE.Raycaster(), plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0), p = new THREE.Vector3(), m = new THREE.Vector2()
    const onMove = e => {
      const r = gl.domElement.getBoundingClientRect(); m.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1)
      ray.setFromCamera(m, camera); if (ray.ray.intersectPlane(plane, p)) api.current?.set({ mouse: [p.x / 2, p.y / 2] })
    }
    window.addEventListener('pointermove', onMove); return () => window.removeEventListener('pointermove', onMove)
  }, [])
  return null
}

const Terrain = forwardRef(function Terrain({ className = '' }, api) {
  return (
    <div className={`absolute inset-0 ${className}`}>
      <Canvas dpr={[1, 1.5]} camera={{ fov: 40, near: 0.1, far: 30, position: CAMS.hero.pos }} gl={{ antialias: true, alpha: false }} onCreated={({ gl }) => gl.setClearColor('#F2F2F0', 1)}>
        <Field api={api} /><Pointer api={api} />
      </Canvas>
    </div>
  )
})
export default Terrain

/* 2D contour thumbnail for one event: its own peak, stepped. */
export function ContourCard({ e, size = 200 }) {
  const ref = useRef()
  useEffect(() => {
    const cv = ref.current, ctx = cv.getContext('2d'), S = size * devicePixelRatio; cv.width = cv.height = S
    const trust = Math.min(Math.max((e.trust_score ?? 50) / 100, 0.05), 1), s = 0.35 + (1 - trust) * 0.6, a = 0.35 + (e.p_calibrated ?? 0.5) * 0.8
    const img = ctx.createImageData(S, S), d = img.data, N = 12
    for (let j = 0; j < S; j++) for (let i = 0; i < S; i++) {
      const x = (i / S) * 2 - 1, y = (j / S) * 2 - 1
      const h = 0.08 + a * Math.exp(-(x * x + y * y * 1.3) / (s * s)) + 0.02 * Math.sin(x * 4 + y * 2.5) + 0.02 * Math.cos(x * 2 - y * 3)
      const lv = Math.max(h, 0) * N, f = lv - Math.floor(lv)
      const g = Math.hypot(a * 2 * x / (s * s), a * 2.6 * y / (s * s)) * Math.exp(-(x * x + y * y * 1.3) / (s * s)) * N
      const shade = 1 - 0.55 * Math.max(0, 1 - f / 0.25) * Math.min(1, g * 0.6 + 0.25)
      const v = Math.floor(236 * shade); const o = (j * S + i) * 4
      d[o] = v; d[o + 1] = v; d[o + 2] = v - 2; d[o + 3] = 255
    }
    ctx.putImageData(img, 0, 0)
  }, [e.id, size])
  return <canvas ref={ref} style={{ width: size, height: size }} />
}
