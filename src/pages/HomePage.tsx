import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { FAQ_ITEMS } from '../data/platformData';

type HeroMockupTab = 'replay' | 'sphere' | 'emblem';

const MARQUEE_ROW_1 = [
  {
    handle: '@marcus_fx',
    role: 'XAUUSD Scalper',
    quote:
      'Bar-by-bar M1 replay on XAUUSD London Killzone showed me I was moving my stops too early. Fixed it in two evenings.',
    stat: '+3.8R Avg Winner',
  },
  {
    handle: '@amina_smc',
    role: 'ICT / FVG Trader',
    quote:
      'Having an FVG box + Long/Short R:R tool that plugs straight into the order panel saves so much clicking during replay.',
    stat: '64.2% Win Rate',
  },
  {
    handle: '@lucas_quant',
    role: 'NAS100 & US30',
    quote:
      'Typed 2025-01-14 to 2025-01-17 into the From → To bar and got genuine CPI week volatility immediately with zero signup.',
    stat: '2.48 Profit Factor',
  },
  {
    handle: '@tanjim_trades',
    role: 'Funded Prop Trader',
    quote:
      'The Prop Firm 5%/10% Drawdown tracker + Daily P&L Calendar keeps my FTMO challenge risk under total control.',
    stat: 'Max DD 2.1%',
  },
  {
    handle: '@elena_crypto',
    role: 'BTCUSDT Intraday',
    quote:
      'Switching seamlessly between M15 and M5 without any future candle leak makes my weekend BTC backtests feel identical to live.',
    stat: '142 Setups Logged',
  },
];

const MARQUEE_ROW_2 = [
  {
    handle: '@kaito_macro',
    role: 'USDJPY Swing',
    quote:
      'Skip to Next Session jumps right to Tokyo, London, or New York Open in one click—no wasted time waiting through dead hours.',
    stat: 'London +68% WR',
  },
  {
    handle: '@devon_risk',
    role: 'Risk Manager',
    quote:
      'Auto Risk % Lot Sizer calculates exact lot sizes against my SL distance automatically. Zero mental math mistakes.',
    stat: '0.5% Fixed Risk',
  },
  {
    handle: '@sara_priceaction',
    role: 'EURUSD & GBPUSD',
    quote:
      'Trade Execution Review Modal lets me inspect entry, SL, TP, and MAE/MFE candles after closing every backtest position.',
    stat: '+$14,820 Sim Equity',
  },
  {
    handle: '@rafiq_trades',
    role: 'Gold Breakout',
    quote:
      'Free forever without hitting paywalls after 5 sessions. Everything works right inside the browser on any market pair.',
    stat: '$0 / Month Forever',
  },
  {
    handle: '@noah_system',
    role: 'Systematic Trader',
    quote:
      '1-click Break-Even and 50% Partial Close mid-replay mirrors how I actually scale out on live prop accounts.',
    stat: '3.91 Sharpe Ratio',
  },
];

const WireframeSphereCanvas: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId = 0;
    let angle = 0;

    const points: Array<{ lat: number; lon: number }> = [];
    for (let i = -5; i <= 5; i++) {
      const lat = (i / 6) * (Math.PI / 2);
      const numLon = Math.max(6, Math.round(Math.cos(lat) * 16));
      for (let j = 0; j < numLon; j++) {
        points.push({ lat, lon: (j / numLon) * Math.PI * 2 });
      }
    }

    const render = () => {
      const w = canvas.width;
      const h = canvas.height;
      ctx.clearRect(0, 0, w, h);

      const cx = w / 2;
      const cy = h / 2;
      const radius = Math.min(w, h) * 0.34;
      angle += 0.008;

      const grad = ctx.createRadialGradient(cx, cy, 10, cx, cy, radius * 1.4);
      grad.addColorStop(0, 'rgba(46, 230, 242, 0.22)');
      grad.addColorStop(1, 'rgba(2, 50, 79, 0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(cx, cy, radius * 1.4, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = 'rgba(46, 230, 242, 0.24)';
      ctx.lineWidth = 1;
      for (let ring = -2; ring <= 2; ring++) {
        const yOff = (ring / 3) * radius;
        const rRing = Math.sqrt(Math.max(0, radius * radius - yOff * yOff));
        ctx.beginPath();
        ctx.ellipse(cx, cy + yOff, rRing, rRing * 0.28, 0, 0, Math.PI * 2);
        ctx.stroke();
      }

      for (const pt of points) {
        const x3d = radius * Math.cos(pt.lat) * Math.sin(pt.lon + angle);
        const y3d = radius * Math.sin(pt.lat);
        const z3d = radius * Math.cos(pt.lat) * Math.cos(pt.lon + angle);
        const scale = 0.65 + ((z3d + radius) / (2 * radius)) * 0.6;
        const px = cx + x3d;
        const py = cy + y3d * 0.92 + z3d * 0.14;
        const alpha = z3d >= 0 ? 0.92 : 0.25;

        ctx.fillStyle = `rgba(46, 230, 242, ${alpha})`;
        ctx.beginPath();
        ctx.arc(px, py, 2.2 * scale, 0, Math.PI * 2);
        ctx.fill();
      }

      animId = window.requestAnimationFrame(render);
    };

    render();
    return () => window.cancelAnimationFrame(animId);
  }, []);

  return (
    <canvas
      ref={canvasRef}
      width={520}
      height={290}
      style={{ width: '100%', height: '100%', display: 'block' }}
      aria-label="Global Trading Activity Wireframe Globe"
    />
  );
};

const StarfieldCanvas: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId = 0;
    const stars = Array.from({ length: 75 }, () => ({
      x: Math.random(),
      y: Math.random(),
      r: 0.6 + Math.random() * 1.4,
      phase: Math.random() * Math.PI * 2,
      speed: 0.015 + Math.random() * 0.02,
      cyan: Math.random() > 0.72,
    }));

    const render = () => {
      const w = (canvas.width = canvas.offsetWidth || 1200);
      const h = (canvas.height = canvas.offsetHeight || 540);
      ctx.clearRect(0, 0, w, h);

      for (const s of stars) {
        s.phase += s.speed;
        const a = 0.2 + 0.55 * (0.5 + 0.5 * Math.sin(s.phase));
        ctx.fillStyle = s.cyan ? `rgba(46, 230, 242, ${a})` : `rgba(255, 255, 255, ${a * 0.6})`;
        ctx.beginPath();
        ctx.arc(s.x * w, s.y * h, s.r, 0, Math.PI * 2);
        ctx.fill();
      }
      animId = window.requestAnimationFrame(render);
    };

    render();
    return () => window.cancelAnimationFrame(animId);
  }, []);

  return <canvas ref={canvasRef} className="tc-starfield-canvas" aria-hidden="true" />;
};

export const HomePage: React.FC = () => {
  const [heroTab, setHeroTab] = useState<HeroMockupTab>('replay');
  const [featurePair, setFeaturePair] = useState<'XAUUSD' | 'EURUSD' | 'BTCUSDT'>('XAUUSD');
  const [openFaqIds, setOpenFaqIds] = useState<Record<string, boolean>>({
    'faq-free': true,
    'faq-account': false,
  });

  const toggleFaq = (id: string) => {
    setOpenFaqIds((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  return (
    <div className="tc-home">
      {/* ===================================================================
          SECTION 0: OCEANIC HERO SECTION (Traders Casa Visual System)
         =================================================================== */}
      <section className="tc-hero" aria-labelledby="hero-heading">
        <div className="tc-dot-grid" aria-hidden="true" />
        <div className="tc-aurora tc-aurora--cyan" aria-hidden="true" />
        <div className="tc-aurora tc-aurora--blue" aria-hidden="true" />

        <div className="container tc-hero__inner">
          <div className="tc-hero__copy">
            <div className="tc-hero__pill-row">
              <span className="tc-glass-pill tc-glass-pill--glow">
                <span className="tc-live-dot" />
                Zero Paywalls • Real M1 Historical Feeds
              </span>
            </div>

            <h1 id="hero-heading" className="tc-hero__title">
              Free Backtesting.
              <br />
              <span className="tc-serif-accent tc-hero__serif-word">Forever.</span>
            </h1>

            <p className="tc-hero__subtitle">
              Free institutional-grade backtesting software built on interactive candlestick
              charts. Replay the market bar by bar across any date range, test your strategy with
              automated SL/TP execution, and improve with deep analytics.
            </p>

            <div className="tc-hero__actions">
              <Link to="/backtest" className="tc-cta-pill tc-cta-pill--lg">
                <span>Start backtesting (it&apos;s free)</span>
                <span aria-hidden="true">&rarr;</span>
              </Link>
              <Link to="/backtest/replay" className="tc-ghost-pill tc-ghost-pill--lg">
                <span>Launch Replay Terminal</span>
              </Link>
            </div>

            <div className="tc-hero__social-proof">
              <div className="tc-avatar-stack" aria-hidden="true">
                <span className="tc-avatar tc-avatar--1">M</span>
                <span className="tc-avatar tc-avatar--2">A</span>
                <span className="tc-avatar tc-avatar--3">K</span>
              </div>
              <span className="tc-hero__proof-text">
                Built for <strong>Forex, Gold (XAUUSD), Indices &amp; Crypto</strong> traders
              </span>
            </div>
          </div>

          {/* 3D PERSPECTIVE BROWSER CHROME SHOWCASE */}
          <div className="tc-hero__stage">
            <div className="tc-chrome-frame tc-hero-browser-3d">
              <div className="tc-browser-window">
                <div className="tc-browser-chrome">
                  <div className="tc-mac-dots" aria-hidden="true">
                    <span className="tc-dot-red" />
                    <span className="tc-dot-yellow" />
                    <span className="tc-dot-green" />
                  </div>

                  <div className="tc-browser-url">
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                      <rect x="3" y="11" width="18" height="11" rx="2" />
                      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                    </svg>
                    <span>app.backtestofchart.io/backtest/session</span>
                  </div>

                  <div className="tc-browser-tabs-mini">
                    <button
                      type="button"
                      className={`tc-mini-tab ${heroTab === 'replay' ? 'active' : ''}`}
                      onClick={() => setHeroTab('replay')}
                    >
                      Chart Replay
                    </button>
                    <button
                      type="button"
                      className={`tc-mini-tab ${heroTab === 'sphere' ? 'active' : ''}`}
                      onClick={() => setHeroTab('sphere')}
                    >
                      3D Scale
                    </button>
                    <button
                      type="button"
                      className={`tc-mini-tab ${heroTab === 'emblem' ? 'active' : ''}`}
                      onClick={() => setHeroTab('emblem')}
                    >
                      Engine
                    </button>
                  </div>
                </div>

                {/* Browser Window Body */}
                <div className="tc-browser-body">
                  {heroTab === 'replay' && (
                    <div className="tc-light-chart-mock">
                      <div className="tc-light-chart-mock__topbar">
                        <div className="tc-chart-pair-badge">
                          <span className="tc-pair-dot" />
                          <strong>XAU / USD · 15m · REPLAY</strong>
                          <span className="tc-replay-tag">PAUSED @ 2025-01-15 13:45 UTC</span>
                        </div>
                        <div className="tc-chart-price-live">$2,684.50</div>
                      </div>

                      {/* Signature Traders Casa High-Contrast Light Chart with Cyan TP & Crimson SL */}
                      <div className="tc-light-chart-canvas">
                        <svg viewBox="0 0 600 220" className="tc-mock-candles-svg" role="img" aria-label="XAUUSD Backtest Replay Preview">
                          {/* Subtle gridlines */}
                          <line x1="0" y1="45" x2="600" y2="45" stroke="#E5E7EB" strokeDasharray="3 3" />
                          <line x1="0" y1="100" x2="600" y2="100" stroke="#E5E7EB" strokeDasharray="3 3" />
                          <line x1="0" y1="155" x2="600" y2="155" stroke="#E5E7EB" strokeDasharray="3 3" />

                          {/* Take Profit Cyan Zone */}
                          <rect x="260" y="28" width="280" height="72" fill="rgba(23, 208, 228, 0.14)" stroke="#17D0E4" strokeDasharray="4 4" />
                          {/* Stop Loss Crimson Zone */}
                          <rect x="260" y="100" width="280" height="42" fill="rgba(244, 63, 94, 0.14)" stroke="#F43F5E" strokeDasharray="4 4" />

                          {/* Candlesticks */}
                          {[
                            { x: 40, o: 170, h: 155, l: 185, c: 162, up: true },
                            { x: 64, o: 162, h: 145, l: 170, c: 150, up: true },
                            { x: 88, o: 150, h: 144, l: 164, c: 158, up: false },
                            { x: 112, o: 158, h: 138, l: 165, c: 142, up: true },
                            { x: 136, o: 142, h: 120, l: 148, c: 128, up: true },
                            { x: 160, o: 128, h: 118, l: 138, c: 134, up: false },
                            { x: 184, o: 134, h: 110, l: 142, c: 118, up: true },
                            { x: 208, o: 118, h: 108, l: 128, c: 122, up: false },
                            { x: 232, o: 122, h: 100, l: 132, c: 106, up: true },
                            { x: 256, o: 106, h: 92, l: 115, c: 100, up: true },
                            { x: 280, o: 100, h: 80, l: 108, c: 84, up: true },
                            { x: 304, o: 84, h: 68, l: 92, c: 72, up: true },
                            { x: 328, o: 72, h: 64, l: 82, c: 78, up: false },
                            { x: 352, o: 78, h: 52, l: 82, c: 56, up: true },
                            { x: 376, o: 56, h: 36, l: 64, c: 42, up: true },
                            { x: 400, o: 42, h: 28, l: 52, c: 32, up: true },
                          ].map((b, idx) => {
                            const top = Math.min(b.o, b.c);
                            const ht = Math.max(4, Math.abs(b.o - b.c));
                            const color = b.up ? '#0AA3D4' : '#E11D48';
                            return (
                              <g key={idx}>
                                <line x1={b.x} y1={b.h} x2={b.x} y2={b.l} stroke={color} strokeWidth="1.8" />
                                <rect x={b.x - 5} y={top} width="10" height={ht} rx="1.5" fill={color} />
                              </g>
                            );
                          })}
                        </svg>

                        {/* Floating Luminous TP & SL Pills (Exact Traders Casa Aesthetic) */}
                        <div className="tc-chart-order-pill tc-chart-order-pill--tp">
                          Take profit &nbsp;<strong>+3.8R ($1,140)</strong>
                        </div>
                        <div className="tc-chart-order-pill tc-chart-order-pill--entry">
                          Buy 0.30 Lots @ <strong>2,684.50</strong>
                        </div>
                        <div className="tc-chart-order-pill tc-chart-order-pill--sl">
                          Stop loss &nbsp;<strong>-1.0R (-$300)</strong>
                        </div>
                      </div>

                      <div className="tc-light-chart-mock__toolbar">
                        <span className="tc-tb-btn tc-tb-btn--play">&#9654; Play 5x</span>
                        <span className="tc-tb-btn">Step Next &rarr;|</span>
                        <span className="tc-tb-btn">Rewind &laquo;</span>
                        <span className="tc-tb-btn tc-tb-btn--accent">Quick Place Long/Short</span>
                      </div>
                    </div>
                  )}

                  {heroTab === 'sphere' && (
                    <div className="tc-dark-stage-mock">
                      <WireframeSphereCanvas />
                      <div className="tc-dark-stage-overlay">
                        <span className="tc-serif-accent tc-stage-stat-num">20,000,000+</span>
                        <p>Historical M1 Candles Ready Across Global Markets</p>
                      </div>
                    </div>
                  )}

                  {heroTab === 'emblem' && (
                    <div className="tc-dark-stage-mock tc-emblem-showcase">
                      <div className="tc-emblem-orbit">
                        <div className="tc-emblem-core">
                          <svg width="74" height="74" viewBox="0 0 64 64" fill="none">
                            <path d="M15 20C18 26 24 29 32 29C40 29 46 26 49 20C48 28 42 34 32 34C22 34 16 28 15 20Z" fill="#2EE6F2" />
                            <rect x="18" y="34" width="6" height="12" rx="1.5" fill="#0AA3D4" />
                            <rect x="29" y="28" width="6" height="16" rx="1.5" fill="#2EE6F2" />
                            <rect x="40" y="21" width="6" height="18" rx="1.5" fill="#ECFEFF" />
                          </svg>
                        </div>
                      </div>
                      <p className="tc-emblem-caption">
                        Zero Future Data Leakage • Sub-Millisecond Hedging Engine
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Bottom Floating Media Control Pills matching Traders Casa */}
            <div className="tc-hero-stage-controls">
              <button
                type="button"
                className="tc-media-pill"
                onClick={() =>
                  setHeroTab(heroTab === 'replay' ? 'sphere' : heroTab === 'sphere' ? 'emblem' : 'replay')
                }
              >
                <span>&#8635; Switch Preview View</span>
              </button>
              <Link to="/backtest/replay" className="tc-media-pill">
                <span>&#9974; Full Screen Workspace</span>
              </Link>
            </div>
          </div>
        </div>
      </section>

      <div className="tc-section-divider" />

      {/* ===================================================================
          SECTION 1: PURE CHARCOAL STATS & INFINITE MARQUEE TESTIMONIALS (#171717)
         =================================================================== */}
      <section className="tc-charcoal-section" aria-labelledby="stats-heading">
        <StarfieldCanvas />
        <div className="container tc-charcoal-section__inner">
          {/* 3-Column Massive Metrics */}
          <div className="tc-stats-bar">
            <div className="tc-stat-block">
              <div className="tc-stat-block__num">20+</div>
              <div className="tc-stat-block__label">Global Markets (FX, Gold, Indices, Crypto)</div>
            </div>
            <div className="tc-stat-block">
              <div className="tc-stat-block__num">20,000,000+</div>
              <div className="tc-stat-block__label">Verified M1 Bars Available</div>
            </div>
            <div className="tc-stat-block">
              <div className="tc-stat-block__num">100% Free</div>
              <div className="tc-stat-block__label">Unlimited Replay Sessions</div>
            </div>
          </div>

          <div className="tc-section-heading-center">
            <p className="tc-eyebrow-muted">
              There is no place better than{' '}
              <span className="tc-serif-accent tc-serif-inline">Backtest of Chart.</span>
            </p>
            <h2 id="stats-heading" className="tc-h2-editorial">
              Built for Serious <span className="tc-serif-accent">Price Action.</span>
            </h2>
          </div>
        </div>

        {/* Dual-Row Marquee Carousel */}
        <div className="tc-marquee-wrapper" aria-label="Trader Workflows">
          <div className="tc-marquee-track">
            {[...MARQUEE_ROW_1, ...MARQUEE_ROW_1].map((item, idx) => (
              <div key={idx} className="tc-testimonial-card-wrap">
                <article className="tc-testimonial-card">
                  <div className="tc-testimonial-card__top">
                    <div>
                      <div className="tc-testimonial-handle">{item.handle}</div>
                      <div className="tc-testimonial-role">{item.role}</div>
                    </div>
                    <span className="tc-testimonial-stat">{item.stat}</span>
                  </div>
                  <p className="tc-testimonial-quote">&ldquo;{item.quote}&rdquo;</p>
                </article>
              </div>
            ))}
          </div>

          <div className="tc-marquee-track tc-marquee-track--reverse">
            {[...MARQUEE_ROW_2, ...MARQUEE_ROW_2].map((item, idx) => (
              <div key={idx} className="tc-testimonial-card-wrap">
                <article className="tc-testimonial-card">
                  <div className="tc-testimonial-card__top">
                    <div>
                      <div className="tc-testimonial-handle">{item.handle}</div>
                      <div className="tc-testimonial-role">{item.role}</div>
                    </div>
                    <span className="tc-testimonial-stat">{item.stat}</span>
                  </div>
                  <p className="tc-testimonial-quote">&ldquo;{item.quote}&rdquo;</p>
                </article>
              </div>
            ))}
          </div>
        </div>

        <div className="container tc-charcoal-cta">
          <Link to="/backtest" className="tc-cta-pill tc-cta-pill--lg">
            <span>Get Started Now (it&apos;s free)</span>
            <span aria-hidden="true">&rarr;</span>
          </Link>
        </div>
      </section>

      <div className="tc-section-divider" />

      {/* ===================================================================
          SECTION 2: OCEANIC GRADIENT FEATURES SHOWCASE (#features)
         =================================================================== */}
      <section id="features" className="tc-features-ocean" aria-labelledby="features-heading">
        <div className="tc-dot-grid" aria-hidden="true" />
        <div className="tc-features-watermark" aria-hidden="true">
          Features
        </div>

        <div className="container tc-features-ocean__inner">
          <div className="tc-features-intro">
            <span className="tc-glass-pill">ALL-IN-ONE REPLAY &amp; ANALYTICS SUITE</span>
            <h2 id="features-heading" className="tc-h2-editorial">
              Everything you need to build a{' '}
              <span className="tc-serif-accent">profitable edge.</span>
            </h2>
          </div>

          {/* MODULE 01: EASY TO USE BAR REPLAY */}
          <div className="tc-feature-showcase">
            <div className="tc-feature-showcase__copy">
              <div className="tc-feature-num">01 / BAR REPLAY</div>
              <h3 className="tc-feature-title">
                Easy to use. <span className="tc-serif-accent">Backtesting made fast.</span>
              </h3>
              <p className="tc-feature-desc">
                Select any market pair and historical <strong>From &rarr; To</strong> date range,
                advance candle by candle with full M1 resolution, draw ICT/SMC zones directly on the
                chart, and execute simulated market or limit orders in one click.
              </p>
              <ul className="tc-feature-bullets">
                <li>Zero future candle leakage up to millisecond cursor</li>
                <li>1-click Break-Even, 50% Partial Close &amp; Skip-to-Session</li>
                <li>Auto Risk % Lot Size Calculator built right into the panel</li>
              </ul>
              <Link to="/backtest" className="tc-ghost-pill">
                Launch Bar Replay &rarr;
              </Link>
            </div>

            <div className="tc-chrome-frame">
              <div className="tc-browser-window">
                <div className="tc-browser-chrome">
                  <div className="tc-mac-dots">
                    <span className="tc-dot-red" />
                    <span className="tc-dot-yellow" />
                    <span className="tc-dot-green" />
                  </div>
                  <div className="tc-browser-url">app.backtestofchart.io/backtest/session</div>
                  <div className="tc-browser-tabs-mini">
                    {(['XAUUSD', 'EURUSD', 'BTCUSDT'] as const).map((sym) => (
                      <button
                        key={sym}
                        type="button"
                        className={`tc-mini-tab ${featurePair === sym ? 'active' : ''}`}
                        onClick={() => setFeaturePair(sym)}
                      >
                        {sym}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="tc-browser-body tc-browser-body--padded">
                  <div className="tc-light-chart-mock tc-light-chart-mock--compact">
                    <div className="tc-light-chart-mock__topbar">
                      <strong>
                        DUKASCOPY · {featurePair} · M15
                      </strong>
                      <span className="tc-replay-tag">FVG + Long R:R Active</span>
                    </div>
                    <div className="tc-light-chart-canvas tc-light-chart-canvas--short">
                      <svg viewBox="0 0 500 150" className="tc-mock-candles-svg">
                        <rect x="190" y="62" width="160" height="22" fill="rgba(56,189,248,0.18)" stroke="#0AA3D4" strokeDasharray="3 3" />
                        <line x1="190" y1="30" x2="460" y2="30" stroke="#17D0E4" strokeWidth="1.5" strokeDasharray="4 3" />
                        <line x1="190" y1="115" x2="460" y2="115" stroke="#F43F5E" strokeWidth="1.5" strokeDasharray="4 3" />
                        {[
                          { x: 50, o: 120, c: 108, up: true },
                          { x: 80, o: 108, c: 95, up: true },
                          { x: 110, o: 95, c: 104, up: false },
                          { x: 140, o: 104, c: 88, up: true },
                          { x: 170, o: 88, c: 96, up: false },
                          { x: 200, o: 96, c: 76, up: true },
                          { x: 230, o: 76, c: 62, up: true },
                          { x: 260, o: 62, c: 48, up: true },
                          { x: 290, o: 48, c: 34, up: true },
                          { x: 320, o: 34, c: 40, up: false },
                          { x: 350, o: 40, c: 28, up: true },
                        ].map((b, i) => (
                          <g key={i}>
                            <line x1={b.x} y1={Math.min(b.o, b.c) - 10} x2={b.x} y2={Math.max(b.o, b.c) + 10} stroke={b.up ? '#0AA3D4' : '#E11D48'} strokeWidth="2" />
                            <rect x={b.x - 6} y={Math.min(b.o, b.c)} width="12" height={Math.abs(b.o - b.c)} rx="2" fill={b.up ? '#0AA3D4' : '#E11D48'} />
                          </g>
                        ))}
                      </svg>
                      <div className="tc-chart-order-pill tc-chart-order-pill--tp">
                        Target +4.1R Hit
                      </div>
                      <div className="tc-chart-order-pill tc-chart-order-pill--sl">
                        SL Protected
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* MODULE 02: IN-DEPTH ANALYTICS */}
          <div className="tc-feature-showcase tc-feature-showcase--reverse">
            <div className="tc-feature-showcase__copy">
              <div className="tc-feature-num">02 / ANALYTICS THAT PAY</div>
              <h3 className="tc-feature-title">
                In-depth metrics. <span className="tc-serif-accent">See what works.</span>
              </h3>
              <p className="tc-feature-desc">
                Pinpoint exactly which sessions (London, New York, Asian) generate your highest
                expectancy, inspect MAE/MFE trade review charts, and track Prop-Firm 5% Daily /
                10% Max drawdown compliance live.
              </p>
              <ul className="tc-feature-bullets">
                <li>Win Rate, Profit Factor, Expectancy, Sharpe &amp; Recovery Factor</li>
                <li>Killzone Session P&amp;L Breakdown &amp; Daily P&amp;L Heatmap Calendar</li>
                <li>One-click Trade Execution Review Modal with setup tagging</li>
              </ul>
              <Link to="/backtest/analytics" className="tc-ghost-pill">
                Inspect Analytics Suite &rarr;
              </Link>
            </div>

            <div className="tc-chrome-frame">
              <div className="tc-browser-window">
                <div className="tc-browser-chrome">
                  <div className="tc-mac-dots">
                    <span className="tc-dot-red" />
                    <span className="tc-dot-yellow" />
                    <span className="tc-dot-green" />
                  </div>
                  <div className="tc-browser-url">app.backtestofchart.io/analytics</div>
                </div>
                <div className="tc-browser-body tc-analytics-preview-dark">
                  <div className="tc-kpi-mini-grid">
                    <div className="tc-kpi-mini">
                      <span>Account Balance</span>
                      <strong className="tc-cyan-text">$14,820.50</strong>
                    </div>
                    <div className="tc-kpi-mini">
                      <span>Win Rate</span>
                      <strong>64.2%</strong>
                    </div>
                    <div className="tc-kpi-mini">
                      <span>Profit Factor</span>
                      <strong className="tc-cyan-text">2.48</strong>
                    </div>
                    <div className="tc-kpi-mini">
                      <span>Max Drawdown</span>
                      <strong style={{ color: '#fb7185' }}>2.10%</strong>
                    </div>
                  </div>
                  <div className="tc-equity-spark">
                    <svg viewBox="0 0 420 90" width="100%" height="90">
                      <defs>
                        <linearGradient id="tcEqFill" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#2EE6F2" stopOpacity="0.4" />
                          <stop offset="100%" stopColor="#2EE6F2" stopOpacity="0" />
                        </linearGradient>
                      </defs>
                      <path
                        d="M0 78 L45 68 L85 72 L130 50 L175 56 L220 34 L270 38 L325 18 L375 22 L420 8 L420 90 L0 90 Z"
                        fill="url(#tcEqFill)"
                      />
                      <path
                        d="M0 78 L45 68 L85 72 L130 50 L175 56 L220 34 L270 38 L325 18 L375 22 L420 8"
                        fill="none"
                        stroke="#2EE6F2"
                        strokeWidth="2.4"
                      />
                    </svg>
                  </div>
                  <div className="tc-ai-callout">
                    <span className="tc-ai-badge">EDGE INSIGHT</span>
                    <span>
                      London Open setups outperform Asian Range entries by <strong>+$1,840 net P&amp;L</strong>.
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* MODULE 03 & 04 BENTO SPLIT */}
          <div id="supported-markets" className="tc-bento-two-col">
            <div className="tc-chrome-frame">
              <div className="tc-browser-window tc-browser-window--full">
                <div className="tc-browser-chrome">
                  <div className="tc-mac-dots">
                    <span className="tc-dot-red" />
                    <span className="tc-dot-yellow" />
                    <span className="tc-dot-green" />
                  </div>
                  <div className="tc-browser-url">app.backtestofchart.io/journal</div>
                </div>
                <div className="tc-browser-body tc-bento-card-body">
                  <div className="tc-feature-num">03 / TRADE REVIEW &amp; NOTES</div>
                  <h3 className="tc-feature-title tc-feature-title--sm">
                    Every closed trade reviewed <span className="tc-serif-accent">automatically.</span>
                  </h3>
                  <div className="tc-fanned-notes">
                    <div className="tc-note-card tc-note-card--back">
                      <span>NY Silver Bullet • Loss Lesson</span>
                      <p>Avoid counter-trend short inside HTF FVG zone.</p>
                    </div>
                    <div className="tc-note-card tc-note-card--front">
                      <span className="tc-note-badge">A+ SETUP • +3.4R</span>
                      <strong>XAUUSD London Open Sweep</strong>
                      <p>Entry at 2,674.20 after liquidity sweep • Partial 50% at +2R • Runner TP hit.</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="tc-chrome-frame">
              <div className="tc-browser-window tc-browser-window--full">
                <div className="tc-browser-chrome">
                  <div className="tc-mac-dots">
                    <span className="tc-dot-red" />
                    <span className="tc-dot-yellow" />
                    <span className="tc-dot-green" />
                  </div>
                  <div className="tc-browser-url">app.backtestofchart.io/markets</div>
                </div>
                <div className="tc-browser-body tc-bento-card-body">
                  <div className="tc-feature-num">04 / MULTI-MARKET &amp; DATE PICKER</div>
                  <h3 className="tc-feature-title tc-feature-title--sm">
                    Pick any <span className="tc-serif-accent">From &rarr; To</span> historical window.
                  </h3>
                  <div className="tc-market-pills-grid">
                    {[
                      { sym: 'XAUUSD', label: 'Spot Gold', src: 'Binance PAXG / Yahoo GC=F' },
                      { sym: 'EURUSD', label: 'Euro / USD', src: 'Binance EUR / Yahoo' },
                      { sym: 'GBPUSD', label: 'Pound / USD', src: 'Yahoo Institutional' },
                      { sym: 'USDJPY', label: 'USD / Yen', src: 'Yahoo / Cross M1' },
                      { sym: 'NAS100', label: 'US Tech 100', src: 'NQ=F Historical' },
                      { sym: 'BTCUSDT', label: 'Bitcoin Spot', src: 'Binance Vision M1' },
                    ].map((m) => (
                      <Link key={m.sym} to="/backtest" className="tc-market-pill-card">
                        <strong>{m.sym}</strong>
                        <span>{m.label}</span>
                        <small>{m.src}</small>
                      </Link>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <p className="tc-tv-attribution">
            Interactive charts rendered via lightweight institutional financial Canvas + native
            TradingView&reg; Datafeed UDF compatibility &amp; Live Embed toggle.
          </p>
        </div>
      </section>

      <div className="tc-section-divider" />

      {/* ===================================================================
          SECTION 4: PURE CHARCOAL FAQ SECTION (#171717)
         =================================================================== */}
      <section id="faq" className="tc-faq-section" aria-labelledby="faq-heading">
        <StarfieldCanvas />
        <div className="container tc-faq-grid">
          <div className="tc-faq-left">
            <div className="tc-eyebrow-muted">Questions, answered.</div>
            <h2 id="faq-heading" className="tc-h2-editorial">
              Everything you
              <br />
              need to <span className="tc-serif-accent">know.</span>
            </h2>
            <p className="tc-section-sub-muted">
              A quick guide to starting your first historical replay, picking date ranges, and
              building consistency without spending a cent.
            </p>
            <div className="tc-faq-support-line">
              Still have a question?{' '}
              <Link to="/contact" className="tc-cyan-underline-link">
                Contact support
              </Link>
            </div>
          </div>

          <div className="tc-faq-accordion">
            {FAQ_ITEMS.map((item) => {
              const isOpen = Boolean(openFaqIds[item.id]);
              return (
                <div
                  key={item.id}
                  className={`tc-faq-row ${isOpen ? 'tc-faq-row--open' : ''}`}
                >
                  <button
                    type="button"
                    className="tc-faq-trigger"
                    aria-expanded={isOpen}
                    onClick={() => toggleFaq(item.id)}
                  >
                    <span>{item.question}</span>
                    <svg
                      width="18"
                      height="18"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="#2EE6F2"
                      strokeWidth="2.2"
                      className={`tc-faq-chevron ${isOpen ? 'rotated' : ''}`}
                    >
                      <polyline points="6 9 12 15 18 9" />
                    </svg>
                  </button>
                  {isOpen && (
                    <div className="tc-faq-answer">
                      <p>{item.answer}</p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ===================================================================
          SECTION 5: FINAL OCEANIC AURORA CTA SECTION
         =================================================================== */}
      <section className="tc-final-cta" aria-labelledby="final-cta-heading">
        <div className="tc-dot-grid" aria-hidden="true" />
        <div className="tc-aurora tc-aurora--bottom-center" aria-hidden="true" />

        <div className="container tc-final-cta__inner">
          <div className="tc-final-emblem" aria-hidden="true">
            <svg width="56" height="56" viewBox="0 0 64 64" fill="none">
              <path
                d="M15 20C18 26 24 29 32 29C40 29 46 26 49 20C48 28 42 34 32 34C22 34 16 28 15 20Z"
                fill="#ECFEFF"
              />
              <rect x="18" y="34" width="6" height="12" rx="1.5" fill="#2EE6F2" />
              <rect x="29" y="28" width="6" height="16" rx="1.5" fill="#86F6FB" />
              <rect x="40" y="21" width="6" height="18" rx="1.5" fill="#ECFEFF" />
            </svg>
          </div>

          <h2 id="final-cta-heading" className="tc-final-cta__title">
            Ready to <span className="tc-serif-accent">accelerate</span> your profits?
          </h2>

          <p className="tc-final-cta__sub">
            Pick your pair, set your historical date range, and execute your first simulated trade
            in under 15 seconds.
          </p>

          <Link to="/backtest" className="tc-cta-pill tc-cta-pill--lg">
            <span>Get Started Now</span>
            <span aria-hidden="true">&rarr;</span>
          </Link>
        </div>
      </section>
    </div>
  );
};
