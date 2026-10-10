import React, { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import Globe from '../components/Globe.jsx'
import CalibrationChart from '../components/CalibrationChart.jsx'
import TrustPill from '../components/TrustPill.jsx'
import { api, pct, pp } from '../api.js'
import { gsap } from '../lib/smooth.js'

const BEATS = [
  { k: '01', t: 'CALIBRATE', h: 'A 40¢ CONTRACT IS NOT A 40% EVENT.', p: 'We fit an isotonic curve on 628 settled Kalshi markets using the price a day before close, and correct every live price with it.' },
  { k: '02', t: 'BASIS', h: 'WHAT DOES THE REAL MARKET ALREADY SAY?', p: 'Fed-funds futures and BTC options imply their own probabilities. The gap to the prediction market is the basis. In September it was 55 points for two months.' },
  { k: '03', t: 'TRUST', h: 'IS THIS A MARKET, OR A RUMOR?', p: 'Liquidity, spread, freshness, holder concentration and horizon, scored 0–100. One trade bigger than 5% of the tape raises a flag.' },
]
const FAQ = [
  ['Why not just use the raw odds?', 'Because a 10¢ contract isn\'t a 10% event, and a price with $300 of daily volume and one whale holding 98% is a rumor, not a market.'],
  ['Who pays for this?', 'Macro and event-driven desks already paying for alternative data. The output is a calibrated, trust-weighted probability feed plus a basis signal they can put in a model.'],
  ['What\'s the hardest part?', 'Matching events across venues and to a traditional proxy. We hand-curated 16; doing it generically is the real product.'],
  ['Is the basis tradable?', 'Sometimes. The Sept FOMC gap was. Fees and half-spreads eat small gaps; the fee-adjusted cross-venue check is usually negative.'],
  ['Risk-neutral vs real-world?', 'Option-implied N(d2) has no risk premium and is a terminal, not touch, probability. We label it, and it is why BTC basis skews positive.'],
  ['Are the betas causal?', 'No. Co-movement, labelled as such, with R² and n shown.'],
]

function Counter({ to, decimals = 0, prefix = '', suffix = '' }) {
  const ref = useRef()
  useEffect(() => {
    const o = { v: 0 }
    const st = gsap.to(o, { v: to, duration: 1.6, ease: 'power3.out', onUpdate: () => { if (ref.current) ref.current.textContent = prefix + o.v.toFixed(decimals) + suffix },
      scrollTrigger: { trigger: ref.current, start: 'top 85%', toggleActions: 'play none none none' } })
    return () => st.kill()
  }, [to])
  return <span ref={ref} className="mono">{prefix}0{suffix}</span>
}

export default function Landing() {
  const progress = useRef(0)
  const storyRef = useRef(); const heroRef = useRef(); const cardRef = useRef(); const colsRef = useRef(); const cardWrap = useRef()
  const [events, setEvents] = useState([])
  const [cal, setCal] = useState(null)
  useEffect(() => { api.events().then(setEvents).catch(() => {}); api.calibration().then(setCal).catch(() => {}) }, [])
  const featured = events.find(e => e.id === 'fomc-2026-12') || events[0]
  const chips = events.filter(e => e.p_proxy != null || e.trust_score >= 75).slice(0, 5)

  // ?static=1 renders every section unpinned (used by scripts/export_charts.py for a full-page PNG)
  const isStatic = typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('static')
  useEffect(() => {
    if (isStatic) { gsap.set('.beat, .reveal', { autoAlpha: 1 }); return }
    const ctx = gsap.context(() => {
      // hero fades/scales out as you scroll, like Moto's hero video
      gsap.to('.hero-copy', { yPercent: -30, autoAlpha: 0, ease: 'none', scrollTrigger: { trigger: heroRef.current, start: 'top top', end: 'bottom top', scrub: true } })
      // pinned story: 2.5 viewports, scrub drives globe + beats
      const beats = gsap.utils.toArray('.beat')
      const tl = gsap.timeline({ scrollTrigger: { trigger: storyRef.current, start: 'top top', end: () => '+=' + 2.5 * window.innerHeight, pin: true, scrub: 1, invalidateOnRefresh: true,
        onUpdate: self => { progress.current = self.progress } } })
      beats.forEach((b, i) => {
        tl.fromTo(b, { autoAlpha: 0, y: 40 }, { autoAlpha: 1, y: 0, duration: 0.6 }, i * 1.0)
        if (i < beats.length - 1) tl.to(b, { autoAlpha: 0, y: -40, duration: 0.5 }, i * 1.0 + 0.8)
      })
      gsap.utils.toArray('.chip-float').forEach((c, i) => {
        gsap.to(c, { y: '+=' + (8 + i * 3), duration: 2.4 + i * 0.3, yoyo: true, repeat: -1, ease: 'sine.inOut' })
      })
      // 3D signal card scrubbed like Moto's card section
      gsap.fromTo(cardRef.current, { rotateY: -32, rotateX: 14, y: 60 }, { rotateY: 22, rotateX: -6, y: -60, ease: 'none', scrollTrigger: { trigger: cardWrap.current, start: 'top 85%', end: 'bottom 15%', scrub: 1 } })
      // opposing columns like the concierge section
      gsap.to('.col-l', { yPercent: -22, ease: 'none', scrollTrigger: { trigger: colsRef.current, start: 'top bottom', end: 'bottom top', scrub: true } })
      gsap.to('.col-r', { yPercent: 22, ease: 'none', scrollTrigger: { trigger: colsRef.current, start: 'top bottom', end: 'bottom top', scrub: true } })
      gsap.utils.toArray('.reveal').forEach(el => gsap.fromTo(el, { autoAlpha: 0, y: 30 }, { autoAlpha: 1, y: 0, duration: 0.9, ease: 'power3.out', scrollTrigger: { trigger: el, start: 'top 88%' } }))
    })
    return () => ctx.revert()
  }, [events.length])

  return (
    <div className="-mt-14">
      {/* HERO */}
      <section ref={heroRef} className={`relative overflow-hidden grain ${isStatic ? "h-[900px]" : "h-[100svh]"}`}>
        <Globe progress={progress} y={-2.05} radius={2.6} />
        <div className="hero-copy relative z-10 h-full flex flex-col items-center justify-center text-center px-6 pt-10">
          <div className="eyebrow mb-6">Kalshi · Polymarket · fed funds futures · deribit</div>
          <h1 className="h1 max-w-5xl">A trust layer for<br />prediction markets</h1>
          <p className="mt-6 max-w-2xl text-grey-300 text-base md:text-lg">Which odds are a signal, which are a rumor, and what moves if they flip.</p>
          <div className="mt-8 flex gap-3">
            <Link to="/app" className="pill">Open the desk</Link>
            <a href="#story" className="pill-ghost">How it works</a>
          </div>
        </div>
        <div className="absolute inset-x-0 bottom-0 z-10 h-[34vh] pointer-events-none">
          {chips.map((e, i) => (
            <Link to={`/events/${e.id}`} key={e.id} className="chip chip-float pointer-events-auto absolute" style={{ left: `${[10, 27, 50, 73, 90][i]}%`, top: `${[30, 8, 62, 12, 36][i]}%`, transform: 'translateX(-50%)' }}>
              <span className="dot" /><span className="max-w-[180px] truncate">{e.title}</span><span className="mono text-grey-300">{pct(e.p_calibrated)}</span>
            </Link>
          ))}
        </div>
        <div className="absolute bottom-6 inset-x-0 z-10 text-center eyebrow">scroll</div>
      </section>

      {/* PINNED STORY */}
      <section id="story" ref={storyRef} className={`relative overflow-hidden ${isStatic ? "min-h-[900px]" : "h-[100svh]"}`}>
        <Globe progress={progress} y={-0.2} radius={2.0} className="opacity-70" />
        <div className="relative z-10 h-full mx-auto max-w-6xl px-6 grid md:grid-cols-2 items-center">
          <div className={isStatic ? 'space-y-10 py-16' : 'relative h-72'}>
            {BEATS.map(b => (
              <div key={b.k} className={isStatic ? 'beat' : 'beat absolute inset-0'}>
                <div className="eyebrow mb-4">{b.k} — {b.t}</div>
                <h2 className="h2">{b.h}</h2>
                <p className="mt-5 text-grey-300 max-w-md">{b.p}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* SIGNAL CARD */}
      <section ref={cardWrap} className="relative py-32 md:py-44 overflow-hidden">
        <div className="mx-auto max-w-6xl px-6 grid md:grid-cols-2 gap-12 items-center">
          <div className="reveal">
            <div className="eyebrow mb-4">The signal card</div>
            <h2 className="h2">Every event,<br />one honest number.</h2>
            <p className="mt-5 text-grey-300 max-w-md">Raw price from each venue, the calibrated probability, the basis to the traditional proxy, and a trust score with its breakdown. Click through to the betas and the scenario slider.</p>
            {featured && <Link to={`/events/${featured.id}`} className="pill mt-8">Open {featured.id}</Link>}
          </div>
          <div style={{ perspective: '1400px' }} className="flex justify-center">
            <div ref={cardRef} className="w-[360px] md:w-[420px] rounded-3xl border border-grey-700/70 bg-gradient-to-br from-ink-3 to-ink p-7 shadow-[0_40px_120px_rgba(0,0,0,0.6)]" style={{ transformStyle: 'preserve-3d' }}>
              <div className="flex items-center justify-between"><span className="display text-sm tracking-[0.08em]">Basis</span>{featured && <TrustPill score={featured.trust_score} leak={featured.leakage_flag} />}</div>
              <div className="mt-10 text-grey-300 text-sm min-h-10">{featured?.title || 'Loading…'}</div>
              <div className="mt-6 grid grid-cols-3 gap-3">
                <div><div className="eyebrow">raw</div><div className="mono text-2xl">{pct(featured?.p_raw, 1)}</div></div>
                <div><div className="eyebrow">calibrated</div><div className="mono text-2xl">{pct(featured?.p_calibrated, 1)}</div></div>
                <div><div className="eyebrow">proxy</div><div className="mono text-2xl">{featured?.p_proxy == null ? '—' : pct(featured.p_proxy, 1)}</div></div>
              </div>
              <div className="mt-6 flex items-end justify-between border-t border-grey-700/60 pt-4">
                <div><div className="eyebrow">basis</div><div className={`mono text-3xl ${featured?.basis > 0 ? 'text-emerald-200' : 'text-rose-200'}`}>{featured?.p_proxy == null ? '—' : pp(featured.basis)}</div></div>
                <div className="text-right"><div className="eyebrow">resolves</div><div className="mono text-sm text-grey-300">{featured?.resolution_date}</div></div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* NUMBERS (theme-invert) */}
      <section className="theme-invert py-28">
        <div className="mx-auto max-w-6xl px-6">
          <h2 className="h2 reveal">Real settled markets.<br />Real futures. No vibes.</h2>
          <div className="mt-14 grid grid-cols-2 md:grid-cols-4 gap-8">
            {[[cal?.n_markets ?? 628, 'settled Kalshi markets in the calibration'], [events.length || 16, 'events across both venues'], [events.filter(e => e.p_proxy != null).length || 7, 'with a traditional-market proxy'], [55, 'point basis on the Sept FOMC for two months', '', 'pp']].map(([n, l, pre, suf], i) => (
              <div key={i} className="reveal border-t border-ink/20 pt-4">
                <div className="display text-5xl md:text-6xl"><Counter to={n} prefix={pre || ''} suffix={suf || ''} /></div>
                <div className="mt-2 text-sm text-grey-500 max-w-[16ch]">{l}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* OPPOSING COLUMNS */}
      <section ref={colsRef} className="relative py-28 overflow-hidden">
        <div className="mx-auto max-w-6xl px-6 grid md:grid-cols-[1fr_auto_1fr] gap-10 items-center">
          <div className="col-l space-y-5">
            {events.slice(0, 8).map(e => <Link key={e.id} to={`/events/${e.id}`} className="block text-right"><div className="h3 text-grey-300 hover:text-bone transition-colors">{e.title}</div><div className="eyebrow mt-1">{e.category} · {pct(e.p_calibrated)}</div></Link>)}
          </div>
          <div className="text-center"><div className="eyebrow">the desk</div><Link to="/app" className="pill mt-3">Open</Link></div>
          <div className="col-r space-y-5">
            {['Liquidity ×0.35', 'Spread ×0.25', 'Freshness ×0.20', 'Concentration ×0.20', 'Horizon multiplier', 'Leakage flag', 'Isotonic calibration', 'Fed-funds basis', 'Option-implied basis', 'Event betas'].map(t => <div key={t} className="h3 text-grey-500">{t}</div>)}
          </div>
        </div>
      </section>

      {/* CALIBRATION */}
      <section className="theme-invert py-24">
        <div className="mx-auto max-w-6xl px-6">
          <div className="grid md:grid-cols-[1fr_2fr] gap-10 items-end reveal">
            <div><div className="eyebrow mb-3">Money chart 01</div><h2 className="h2">Are the odds calibrated?</h2></div>
            <p className="text-grey-500 max-w-lg">Price about a day before close against how often YES actually happened. Below the line, buyers of YES overpaid. The isotonic fit is the correction we apply to every live price.</p>
          </div>
          <div className="mt-10 rounded-3xl bg-white/60 border border-ink/10 p-4 md:p-6">
            {cal ? <CalibrationChart c={cal} invert height={460} /> : <div className="h-[460px] flex items-center justify-center text-grey-500">Loading…</div>}
          </div>
          <div className="mt-4 flex justify-end"><Link to="/calibration" className="pill-ghost !text-ink !border-ink/30">Full calibration page</Link></div>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-28">
        <div className="mx-auto max-w-4xl px-6">
          <div className="eyebrow mb-3 reveal">Likely judge questions</div>
          <h2 className="h2 reveal">Frequently asked.</h2>
          <div className="mt-10 accordion divide-y divide-grey-700/60 border-y border-grey-700/60">
            {FAQ.map(([q, a]) => (
              <details key={q} className="group py-5 reveal">
                <summary className="flex items-center justify-between gap-6"><span className="text-lg md:text-xl">{q}</span><span className="text-grey-500 text-2xl group-open:rotate-45 transition-transform">+</span></summary>
                <p className="mt-3 text-grey-300 max-w-2xl">{a}</p>
              </details>
            ))}
          </div>
          <div className="mt-16 flex items-center justify-between"><div className="display text-2xl">Basis</div><Link to="/app" className="pill">Open the desk</Link></div>
          <div className="mt-6 eyebrow">Built in 24h · Kalshi + Polymarket public data · risk-neutral probabilities · co-movement, not causation</div>
        </div>
      </section>
    </div>
  )
}
