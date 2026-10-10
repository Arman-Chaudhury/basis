import React, { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import Plate, { Figure, paramsFor } from '../components/Plate.jsx'
import CalibrationChart from '../components/CalibrationChart.jsx'
import TrustPill from '../components/TrustPill.jsx'
import { api, pct, pp } from '../api.js'
import { gsap, ScrollTrigger } from '../lib/smooth.js'

/* Seven chapters. Each nudges the plate: m from probability, n from basis, sharp from trust. */
const CHAPTERS = [
  { k: '01', t: 'The raw odds', h: 'Sand on a plate.', p: 'A prediction market price is thousands of small bets scattered across a surface. Read it raw and you are reading sand before the plate is struck.', plate: { f: 300, gamma: 9.5, drive: [0.3, 0], camera: 'tilt' } },
  { k: '02', t: 'The bias', h: 'A 40¢ contract is not a 40% event.', p: 'Across 628 settled Kalshi markets, contracts priced 20–45¢ resolved YES about 30% of the time, and 95¢ contracts only 84%. The favorite–longshot bias is the plate\'s stiffness: it sets where the figure can form.', plate: { f: 523, gamma: 7.5, drive: [0.15, 0], camera: 'tilt' } },
  { k: '03', t: 'Calibration', h: 'The figure is the correction.', p: 'An isotonic curve fit on the price one day before close maps every raw price to how often that price actually paid. The grains stop scattering and find the nodal lines.', plate: { f: 744, gamma: 5, drive: [0, 0], camera: 'overhead' } },
  { k: '04', t: 'The proxy', h: 'The real market is already vibrating.', p: 'Fed-funds futures imply a probability of a hike. Deribit option prices imply a probability that Bitcoin clears a strike. These are the driving frequencies the prediction market should resonate with.', plate: { f: 1117, gamma: 5, drive: [0, 0], camera: 'overhead' } },
  { k: '05', t: 'The basis', h: 'Between the resonances.', p: 'Basis is the gap between the prediction market and its proxy. In September the futures sat at 90% for a hike while both venues sat near 35% for two months. That gap was the trade.', plate: { f: 1443, gamma: 4.8, drive: [0.5, 0], camera: 'detail' } },
  { k: '06', t: 'Trust', h: 'Is this a market, or a rumor?', p: 'Liquidity, spread, freshness, holder concentration and horizon, scored 0–100. One trade larger than 5% of the day\'s tape raises a flag. Low trust is a loosely driven plate: the figure never sharpens.', plate: { f: 1590, gamma: 4.5, drive: [0, 0], camera: 'tilt' } },
  { k: '07', t: 'What moves', h: 'Strike the plate, watch the room.', p: 'Event betas: the historical co-movement of TLT, XLF, the dollar and bitcoin with each event\'s probability. Co-movement, not causation, with R² and n shown. Drag the odds in the Lab and see the expected moves.', plate: { f: 1939, gamma: 4.5, drive: [0, 0], camera: 'detail' } },
]
const FAQ = [
  ['Why not just use the raw odds?', 'Because a 10¢ contract isn\'t a 10% event, and a price with $300 of daily volume and one whale holding 98% is a rumor, not a market.'],
  ['Who pays for this?', 'Macro and event-driven desks already paying for alternative data. The output is a calibrated, trust-weighted probability feed plus a basis signal.'],
  ['What\'s the hardest part?', 'Matching events across venues and to a traditional proxy. We hand-curated 16; doing it generically is the real product.'],
  ['Risk-neutral vs real-world?', 'Option-implied N(d2) has no risk premium and is a terminal, not touch, probability. We label it; it is why BTC basis skews positive.'],
  ['Are the betas causal?', 'No. Co-movement, labelled as such, with R² and n shown.'],
]

function useSound() {
  const ctx = useRef(null); const osc = useRef(null); const gain = useRef(null)
  const [on, setOn] = useState(false)
  const toggle = () => {
    if (!ctx.current) { ctx.current = new (window.AudioContext || window.webkitAudioContext)(); osc.current = ctx.current.createOscillator(); gain.current = ctx.current.createGain(); osc.current.type = 'sine'; osc.current.frequency.value = 220; gain.current.gain.value = 0; osc.current.connect(gain.current).connect(ctx.current.destination); osc.current.start() }
    const g = gain.current.gain, t = ctx.current.currentTime
    if (on) { g.linearRampToValueAtTime(0, t + 0.3); setOn(false) } else { ctx.current.resume(); g.linearRampToValueAtTime(0.04, t + 0.5); setOn(true) }
  }
  const setFreq = f => { if (osc.current) osc.current.frequency.linearRampToValueAtTime(f, ctx.current.currentTime + 0.4) }
  return { on, toggle, setFreq }
}

export default function Landing() {
  const plate = useRef()
  const [events, setEvents] = useState([])
  const [cal, setCal] = useState(null)
  const [ready, setReady] = useState(false)
  const [count, setCount] = useState(0)
  const [pNew, setPNew] = useState(null)
  const [sc, setSc] = useState(null)
  const sound = useSound()
  const isStatic = typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('static')
  const featured = events.find(e => e.id === 'fomc-2026-12') || events[0]

  useEffect(() => {
    let done = false
    Promise.all([api.events().then(setEvents).catch(() => {}), api.calibration().then(setCal).catch(() => {})]).then(() => { done = true })
    if (isStatic) { setCount(100); setReady(true); return }
    const o = { v: 0 }
    gsap.to(o, { v: 100, duration: 1.6, ease: 'power2.inOut', onUpdate: () => setCount(Math.round(o.v)), onComplete: () => setReady(true) })
    const safety = setTimeout(() => setReady(true), 3000)
    return () => clearTimeout(safety)
  }, [])
  useEffect(() => { if (featured && pNew == null) setPNew(featured.p_raw ?? 0.5) }, [featured])
  useEffect(() => {
    if (pNew == null || !featured) return
    const t = setTimeout(() => api.scenario(featured.id, pNew).then(setSc).catch(() => {}), 120)
    const q = paramsFor({ ...featured, p_calibrated: pNew })
    plate.current?.set(q); sound.setFreq(q.f * 0.25)
    return () => clearTimeout(t)
  }, [pNew, featured?.id])

  useEffect(() => {
    if (!ready) return
    if (isStatic) { gsap.set('.reveal', { autoAlpha: 1 }); return }
    const ctx = gsap.context(() => {
      gsap.utils.toArray('.chapter').forEach((el, i) => {
        ScrollTrigger.create({ trigger: el, start: 'top 55%', end: 'bottom 45%', onEnter: () => plate.current?.set(CHAPTERS[i].plate), onEnterBack: () => plate.current?.set(CHAPTERS[i].plate) })
      })
      ScrollTrigger.create({ trigger: '#hero', start: 'top top', end: 'bottom 40%', onEnter: () => plate.current?.set({ ...paramsFor(featured), camera: 'tilt' }), onEnterBack: () => plate.current?.set({ ...paramsFor(featured), camera: 'tilt' }) })
      ScrollTrigger.create({ trigger: '#lab', start: 'top 60%', onEnter: () => plate.current?.set(paramsFor({ ...featured, p_calibrated: pNew ?? featured?.p_raw })), onEnterBack: () => plate.current?.set(paramsFor({ ...featured, p_calibrated: pNew ?? featured?.p_raw })) })
      gsap.utils.toArray('.reveal').forEach(el => gsap.fromTo(el, { autoAlpha: 0, y: 24 }, { autoAlpha: 1, y: 0, duration: 1, ease: 'power3.out', scrollTrigger: { trigger: el, start: 'top 85%' } }))
      gsap.to('#hero .hero-copy', { autoAlpha: 0, y: -40, ease: 'none', scrollTrigger: { trigger: '#hero', start: 'top top', end: 'bottom top', scrub: true } })
    })
    return () => ctx.revert()
  }, [ready, events.length])

  const fig = featured ? paramsFor(featured) : null
  return (
    <div className={`-mt-14 relative ${isStatic ? "static-shot" : ""}`}>
      {/* fixed plate behind everything */}
      <div className="plate-fixed"><Plate ref={plate} className={`transition-opacity duration-1000 ${ready ? "opacity-100" : "opacity-0"}`} /></div>

      {/* preloader */}
      {!ready && (
        <div className="fixed inset-0 z-40 bg-ink px-14 py-32 flex flex-col justify-between">
          <div className="eyebrow">Loading the plate</div>
          <div><div className="numeral text-[9rem] text-bone">{String(count).padStart(3, '0')}</div><div className="rule mt-6 max-w-3xl" /></div>
          <div className="eyebrow">Basis · a geometry of odds</div>
        </div>
      )}

      {/* HERO */}
      <section id="hero" className="relative z-10 h-[100svh]">
        <div className="hero-copy absolute inset-x-0 bottom-0 px-6 md:px-14 pb-14 grid md:grid-cols-[1fr_auto] items-end gap-8">
          <div>
            <div className="eyebrow mb-5">Kalshi · Polymarket · fed-funds futures · Deribit</div>
            <h1 className="h1 max-w-4xl">A geometry<br />of odds.</h1>
            <p className="mt-6 max-w-lg text-grey-300">Prediction-market prices are sand on a plate. Basis strikes the plate: a calibrated probability, the basis to the real market, and a 0–100 trust score for every event.</p>
            <div className="mt-8 flex items-center gap-8">
              <a href="#story" className="btn-text">Scroll</a>
              <a href="#lab" className="btn-text">Skip to the Lab</a>
              <Link to="/app" className="btn-text">Open the desk</Link>
              <button onClick={sound.toggle} className="btn-text">{sound.on ? 'Mute' : 'Begin with sound'}</button>
            </div>
          </div>
          {featured && (
            <div className="text-right">
              <div className="eyebrow mb-2">{featured.title}</div>
              <div className="numeral text-[7rem] md:text-[9rem] text-bone">{(featured.p_calibrated * 100).toFixed(0)}</div>
              <div className="eyebrow">calibrated · raw {pct(featured.p_raw)} · trust {featured.trust_score} · {paramsFor(featured).f} Hz</div>
            </div>
          )}
        </div>
      </section>

      {/* STORY */}
      <section id="story" className="relative z-10">
        {CHAPTERS.map((c, i) => (
          <div key={c.k} className={`chapter px-6 md:px-14 ${i % 2 ? 'md:pl-[52%]' : ''}`}>
            <div className="max-w-xl bg-ink/55 backdrop-blur-[2px] rounded-2xl p-6 -m-6">
              <div className="eyebrow mb-4">{c.k}/07 · {c.t}</div>
              <h2 className="h2">{c.h}</h2>
              <p className="mt-5 text-grey-300">{c.p}</p>
            </div>
          </div>
        ))}
      </section>

      {/* LAB */}
      <section id="lab" className="relative z-10 min-h-[100svh] px-6 md:px-14 py-28 grid md:grid-cols-[1fr_1fr] gap-12 items-end">
        <div className="reveal max-w-xl bg-ink/55 backdrop-blur-[2px] rounded-2xl p-6 -m-6">
          <div className="eyebrow mb-4">The Lab · scenario</div>
          <h2 className="h2">Drive the odds.<br />Watch the room move.</h2>
          <p className="mt-5 text-grey-300">{featured?.title}. Drag the probability; the plate re-forms and the expected co-movements update from the event betas.</p>
          <div className="mt-8 flex items-center gap-4">
            <span className="eyebrow w-16">p_new</span>
            <input type="range" min="0" max="1" step="0.01" value={pNew ?? 0.5} onChange={e => setPNew(parseFloat(e.target.value))} className="flex-1" />
            <span className="numeral text-5xl w-24 text-right">{Math.round((pNew ?? 0.5) * 100)}</span>
          </div>
          <div className="eyebrow mt-2">now {pct(featured?.p_raw, 1)} → {pct(pNew)} · {pp((pNew ?? 0) - (featured?.p_raw ?? 0))} · drive {fig ? `${paramsFor({ ...featured, p_calibrated: pNew }).f} Hz · Γ ${paramsFor({ ...featured, p_calibrated: pNew }).gamma} g` : ''}</div>
        </div>
        <div className="reveal bg-ink/55 backdrop-blur-[2px] rounded-2xl p-6">
          <table className="w-full text-sm">
            <thead><tr className="eyebrow"><th className="text-left py-2 font-normal">asset</th><th className="text-right font-normal">β / pp</th><th className="text-right font-normal">R²</th><th className="text-right font-normal">n</th><th className="text-right font-normal">expected move</th></tr></thead>
            <tbody>{(sc?.moves || []).map(b => (
              <tr key={b.ticker} className="border-t border-grey-700/60">
                <td className="py-2.5 text-bone">{b.ticker}</td>
                <td className="text-right mono text-grey-300">{b.beta_per_pp == null ? '—' : b.beta_per_pp.toFixed(3)}</td>
                <td className="text-right mono text-grey-500">{b.r2 == null ? '—' : b.r2.toFixed(2)}</td>
                <td className="text-right mono text-grey-500">{b.n_obs}</td>
                <td className="text-right numeral text-2xl">{b.expected_move_pct == null ? '—' : `${b.expected_move_pct > 0 ? '+' : ''}${b.expected_move_pct.toFixed(2)}%`}</td>
              </tr>))}</tbody>
          </table>
          <div className="eyebrow mt-4">co-movement, not causation</div>
          {featured && <Link to={`/events/${featured.id}`} className="btn-text mt-6 inline-block">Full event page</Link>}
        </div>
      </section>

      {/* FIGURES */}
      <section id="figures" className="relative z-10 bg-ink px-6 md:px-14 py-28">
        <div className="reveal flex items-end justify-between gap-8 flex-wrap">
          <div><div className="eyebrow mb-3">Figures · {events.length} events</div><h2 className="h2">Every event has a figure.</h2></div>
          <p className="max-w-md text-grey-300">Drive frequency from the calibrated probability, drive point from the basis, drive strength Γ from trust: a low-trust market is a hard-shaken plate whose sand never settles.</p>
        </div>
        <div className="mt-14 grid grid-cols-2 md:grid-cols-4 gap-x-6 gap-y-12">
          {events.map(e => { const q = paramsFor(e); return (
            <Link to={`/events/${e.id}`} key={e.id} className="reveal group">
              <div className="aspect-square rounded-xl border border-grey-700/60 bg-ink-2 grid place-items-center overflow-hidden group-hover:border-grey-300 transition-colors"><Figure f={q.f} gamma={q.gamma} drive={q.drive} size={220} /></div>
              <div className="mt-4 flex items-start justify-between gap-3">
                <div><div className="text-bone leading-snug">{e.title}</div><div className="eyebrow mt-1">{e.category} · {pct(e.p_calibrated)} · {e.p_proxy == null ? 'no proxy' : pp(e.basis)}</div></div>
                <TrustPill score={e.trust_score} leak={e.leakage_flag} />
              </div>
            </Link>) })}
        </div>
      </section>

      {/* CALIBRATION */}
      <section className="relative z-10 bg-ink px-6 md:px-14 py-24">
        <div className="reveal grid md:grid-cols-[1fr_2fr] gap-10 items-end">
          <div><div className="eyebrow mb-3">Chladni's law, for odds</div><h2 className="h2">Where the figure can form.</h2></div>
          <p className="text-grey-300 max-w-lg">Price about a day before close against how often YES actually happened, across {cal?.n_markets ?? 628} settled Kalshi markets. Below the line, buyers of YES overpaid. The isotonic fit is the correction applied to every live price.</p>
        </div>
        <div className="mt-10 rounded-2xl border border-grey-700/60 bg-ink-2 p-4 md:p-6">{cal ? <CalibrationChart c={cal} height={460} /> : <div className="h-[460px]" />}</div>
      </section>

      {/* ABOUT / FAQ */}
      <section id="about" className="relative z-10 bg-ink px-6 md:px-14 py-24">
        <div className="max-w-3xl">
          <div className="eyebrow mb-3 reveal">About · likely questions</div>
          <h2 className="h2 reveal">The figure is the solution.</h2>
          <div className="mt-10 accordion divide-y divide-grey-700/60 border-y border-grey-700/60">
            {FAQ.map(([q, a]) => (
              <details key={q} className="group py-5 reveal"><summary className="flex items-center justify-between gap-6"><span className="text-lg">{q}</span><span className="text-grey-500 text-2xl group-open:rotate-45 transition-transform">+</span></summary><p className="mt-3 text-grey-300">{a}</p></details>
            ))}
          </div>
          <div className="mt-16 flex items-center justify-between"><div className="h3">Basis</div><Link to="/app" className="btn-text">Open the desk</Link></div>
          <div className="mt-6 eyebrow max-w-2xl leading-relaxed">After Chladni (1787), Rayleigh and Leissa. Plate figures are a metaphor; every number behind them is real: Kalshi and Polymarket public data, CME fed-funds futures, Deribit options. Risk-neutral probabilities. Co-movement, not causation. The simulation runs in your browser.</div>
        </div>
      </section>
    </div>
  )
}
