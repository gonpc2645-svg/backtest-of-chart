import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  BRAND_IDENTITY,
  DATA_SOURCES,
  FAQ_ITEMS,
  MARKET_CATEGORIES,
  PLANNED_FEATURES,
  WHY_BACKTESTING_POINTS,
  WORKFLOW_STEPS,
} from '../data/platformData';

export const HomePage: React.FC = () => {
  const [openFaqIds, setOpenFaqIds] = useState<Record<string, boolean>>({
    'faq-free': true,
    'faq-account': true,
  });

  const toggleFaq = (id: string) => {
    setOpenFaqIds((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  const scrollToFeatures = (event: React.MouseEvent<HTMLAnchorElement>) => {
    event.preventDefault();
    const target = document.getElementById('features');
    if (target) {
      window.history.pushState(null, '', '/#features');
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  return (
    <div className="home-page">
      {/* B. HERO SECTION */}
      <section className="hero-section" aria-labelledby="hero-heading">
        <div className="hero-section__grid-backdrop" aria-hidden="true" />
        <div className="container hero-section__inner">
          <div className="hero-section__content">
            <div className="hero-section__eyebrow">
              <span className="status-pill status-pill--cyan">
                {BRAND_IDENTITY.positioning}
              </span>
              <span className="hero-section__tagline-pill">
                {BRAND_IDENTITY.tagline}
              </span>
            </div>

            <h1 id="hero-heading" className="hero-section__title">
              MASTER YOUR TRADING THROUGH HISTORICAL BACKTESTING
            </h1>

            <p className="hero-section__subtitle">
              Explore historical market movements, practise your trading
              decisions, and evaluate your strategies in a dedicated
              backtesting environment. No account. No subscription. Just
              trading practice.
            </p>

            <div className="hero-section__cta-group">
              <Link to="/backtest" className="btn btn--primary btn--lg">
                <span>START BACKTEST</span>
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  aria-hidden="true"
                >
                  <path
                    d="M5 12H19M19 12L13 6M19 12L13 18"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </Link>
              <a
                href="#features"
                className="btn btn--secondary btn--lg"
                onClick={scrollToFeatures}
              >
                EXPLORE FEATURES
              </a>
            </div>

            <div className="hero-section__trust-strip" role="list">
              <div className="hero-section__trust-item" role="listitem">
                <span className="hero-section__trust-dot" aria-hidden="true" />
                <span>100% Free Access</span>
              </div>
              <div className="hero-section__trust-item" role="listitem">
                <span className="hero-section__trust-dot" aria-hidden="true" />
                <span>No Login or Signup</span>
              </div>
              <div className="hero-section__trust-item" role="listitem">
                <span className="hero-section__trust-dot" aria-hidden="true" />
                <span>Risk-Free Simulation</span>
              </div>
            </div>
          </div>

          {/* Honest Platform Architecture & Session Configuration Blueprint Card */}
          <div
            className="hero-terminal-card"
            aria-label="Backtest of Chart Platform Architecture Blueprint"
          >
            <div className="hero-terminal-card__header">
              <div className="hero-terminal-card__dots" aria-hidden="true">
                <span />
                <span />
                <span />
              </div>
              <div className="hero-terminal-card__title">
                BACKTEST OF CHART • PLATFORM ARCHITECTURE OVERVIEW
              </div>
              <span className="status-pill status-pill--cyan">Phase 1–7 Audited</span>
            </div>

            <div className="hero-terminal-card__body">
              <div className="terminal-blueprint__banner">
                <span className="terminal-blueprint__label">
                  SYSTEM STATUS
                </span>
                <p className="terminal-blueprint__text">
                  Historical Market Data, Deterministic Replay Engine, Simulated Hedging Execution, and Performance Analytics are fully operational.
                </p>
              </div>

              <div className="terminal-blueprint__modules">
                <div className="terminal-module terminal-module--active">
                  <div className="terminal-module__top">
                    <span className="terminal-module__code">PHASE 01–02</span>
                    <span className="terminal-module__badge terminal-module__badge--ready">
                      Active
                    </span>
                  </div>
                  <div className="terminal-module__name">
                    Historical Market Data &amp; Session Setup UI
                  </div>
                  <div className="terminal-module__meta">
                    Binance Spot Klines (Verified M1 Ingestion) • Dukascopy Catalog
                  </div>
                </div>

                <div className="terminal-module terminal-module--active">
                  <div className="terminal-module__top">
                    <span className="terminal-module__code">PHASE 03–05</span>
                    <span className="terminal-module__badge terminal-module__badge--ready">
                      Active
                    </span>
                  </div>
                  <div className="terminal-module__name">
                    Replay, Simulated Execution &amp; Analytics Engines
                  </div>
                  <div className="terminal-module__meta">
                    Zero Future Leakage Replay • Hedging Margin &amp; Stop-Out • Drawdown Analytics
                  </div>
                </div>

                <div className="terminal-module">
                  <div className="terminal-module__top">
                    <span className="terminal-module__code">PHASE 06–07</span>
                    <span className="terminal-module__badge terminal-module__badge--ready">
                      Lightweight Charts Active
                    </span>
                  </div>
                  <div className="terminal-module__name">
                    Charting Workspace &amp; Production Hardening
                  </div>
                  <div className="terminal-module__meta">
                    Built-in Charting Active • Advanced Charts Adapter Ready • Audited &amp; Hardened
                  </div>
                </div>
              </div>

              <div className="hero-terminal-card__footer">
                <Link to="/backtest" className="terminal-blueprint__link">
                  <span>Open Backtest Setup Interface</span>
                  <span aria-hidden="true">&rarr;</span>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* C. ABOUT SECTION */}
      <section
        id="about"
        className="section section--bordered"
        aria-labelledby="about-heading"
      >
        <div className="container">
          <div className="section-layout-split">
            <div className="section-layout-split__main">
              <div className="section-eyebrow">PLATFORM MISSION</div>
              <h2 id="about-heading" className="section-title">
                ABOUT BACKTEST OF CHART
              </h2>
              <p className="section-lead">
                Backtest of Chart is a free historical market backtesting
                platform designed to help traders understand market behaviour
                and practise trading decisions using historical price movements.
              </p>
              <p className="section-body-text">
                Our goal is to provide an accessible environment where traders
                can explore historical charts, replay market movements, and
                evaluate simulated trading performance without risking real
                money.
              </p>
            </div>

            <div className="about-pillars-grid">
              <div className="surface-card about-pillar-card">
                <div className="about-pillar-card__index">01</div>
                <h3 className="about-pillar-card__title">
                  Zero Barrier to Entry
                </h3>
                <p className="about-pillar-card__text">
                  Built as an open public utility with no user registration,
                  paywalls, or subscription tiers.
                </p>
              </div>

              <div className="surface-card about-pillar-card">
                <div className="about-pillar-card__index">02</div>
                <h3 className="about-pillar-card__title">
                  Dedicated Historical Study
                </h3>
                <p className="about-pillar-card__text">
                  Focused exclusively on historical market observation,
                  structured replay, and decision evaluation.
                </p>
              </div>

              <div className="surface-card about-pillar-card">
                <div className="about-pillar-card__index">03</div>
                <h3 className="about-pillar-card__title">
                  100% Simulated Environment
                </h3>
                <p className="about-pillar-card__text">
                  Every order and trade concept on the platform is strictly
                  simulated for educational practice without financial risk.
                </p>
              </div>

              <div className="surface-card about-pillar-card">
                <div className="about-pillar-card__index">04</div>
                <h3 className="about-pillar-card__title">
                  Transparent Development
                </h3>
                <p className="about-pillar-card__text">
                  Engineered in clear modular phases—starting with our public
                  foundation and setup interface in Phase 1.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* D. FEATURES SECTION */}
      <section
        id="features"
        className="section section--alt"
        aria-labelledby="features-heading"
      >
        <div className="container">
          <div className="section-header">
            <div className="section-eyebrow">PLANNED PLATFORM CAPABILITIES</div>
            <h2 id="features-heading" className="section-title">
              CORE BACKTESTING CAPABILITIES
            </h2>
            <p className="section-description">
              Backtest of Chart is architected around six core backtesting
              modules. In Phase 1, the website foundation and session setup UI
              are active; the underlying data, replay, trading, and analytics
              engines are scheduled for connection in upcoming phases.
            </p>
          </div>

          <div
            className="phase-notice-banner"
            role="note"
            aria-label="Development Phase Transparency Notice"
          >
            <div className="phase-notice-banner__indicator" aria-hidden="true">
              i
            </div>
            <div className="phase-notice-banner__content">
              <strong>Phase 1 Transparency Note:</strong> The capabilities
              listed below represent planned platform modules for upcoming
              development phases (Phases 2–6). They are clearly labelled so
              visitors can distinguish current Phase 1 interface elements from
              engines under development.
            </div>
          </div>

          <div className="features-grid">
            {PLANNED_FEATURES.map((feature) => (
              <article key={feature.id} className="surface-card feature-card">
                <div className="feature-card__top">
                  <span className="status-pill status-pill--blue">
                    {feature.phaseBadge}
                  </span>
                </div>
                <h3 className="feature-card__title">{feature.title}</h3>
                <p className="feature-card__description">
                  {feature.description}
                </p>
                <ul className="feature-card__list">
                  {feature.highlights.map((item) => (
                    <li key={item} className="feature-card__list-item">
                      <span
                        className="feature-card__bullet"
                        aria-hidden="true"
                      />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
                <div className="feature-card__footer">
                  <span className="feature-card__status-note">
                    {feature.statusNote}
                  </span>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* E. SUPPORTED MARKETS SECTION */}
      <section
        id="supported-markets"
        className="section section--bordered"
        aria-labelledby="markets-heading"
      >
        <div className="container">
          <div className="section-header">
            <div className="section-eyebrow">INTENDED ASSET CLASSES</div>
            <h2 id="markets-heading" className="section-title">
              SUPPORTED MARKETS (PLANNED)
            </h2>
            <p className="section-description">
              Backtest of Chart is designed to support four major market
              categories. These represent intended supported markets planned for
              historical data connection in Phase 2—not verified live data
              availability in Phase 1.
            </p>
          </div>

          <div className="markets-grid">
            {MARKET_CATEGORIES.map((market) => (
              <article key={market.id} className="surface-card market-card">
                <div className="market-card__header">
                  <span className="market-card__code">{market.code}</span>
                  <span className="status-pill status-pill--neutral">
                    {market.statusLabel}
                  </span>
                </div>
                <h3 className="market-card__title">{market.name}</h3>
                <p className="market-card__description">{market.description}</p>
                <div className="market-card__meta">
                  <div className="market-card__meta-row">
                    <span className="market-card__meta-label">
                      Intended Historical Source
                    </span>
                    <span className="market-card__meta-value">
                      {market.intendedSource}
                    </span>
                  </div>
                  <div className="market-card__meta-row">
                    <span className="market-card__meta-label">
                      Current Phase 1 Status
                    </span>
                    <span className="market-card__meta-value market-card__meta-value--muted">
                      Setup UI Ready • Feed in Phase 2
                    </span>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* F. HISTORICAL DATA SOURCES SECTION */}
      <section
        id="data-sources"
        className="section section--alt"
        aria-labelledby="data-sources-heading"
      >
        <div className="container">
          <div className="section-header">
            <div className="section-eyebrow">PLANNED DATA INFRASTRUCTURE</div>
            <h2 id="data-sources-heading" className="section-title">
              HISTORICAL DATA SOURCES
            </h2>
            <p className="section-description">
              To provide reliable historical market replay in upcoming phases,
              we plan to integrate historical datasets from established market
              data providers. Neither provider is connected in Phase 1.
            </p>
          </div>

          <div className="data-sources-grid">
            {DATA_SOURCES.map((source) => (
              <article
                key={source.id}
                className="surface-card data-source-card"
              >
                <div className="data-source-card__top">
                  <div className="data-source-card__typography">
                    {source.wordmarkStyle}
                  </div>
                  <span className="status-pill status-pill--cyan">
                    {source.statusBadge}
                  </span>
                </div>

                <h3 className="data-source-card__name">{source.name}</h3>
                <p className="data-source-card__primary-desc">
                  {source.description}
                </p>

                <div className="data-source-card__markets">
                  <span className="data-source-card__markets-label">
                    Intended Market Scope:
                  </span>
                  <div className="data-source-card__market-tags">
                    {source.intendedMarkets.map((mkt) => (
                      <span key={mkt} className="market-tag">
                        {mkt}
                      </span>
                    ))}
                  </div>
                </div>

                <p className="data-source-card__scope-note">
                  {source.technicalScope}
                </p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* G. HOW IT WORKS SECTION */}
      <section
        id="how-it-works"
        className="section section--bordered"
        aria-labelledby="how-it-works-heading"
      >
        <div className="container">
          <div className="section-header">
            <div className="section-eyebrow">PLANNED USER JOURNEY</div>
            <h2 id="how-it-works-heading" className="section-title">
              HOW IT WORKS
            </h2>
            <p className="section-description">
              The intended six-step workflow designed to take you from session
              configuration to post-session performance review as platform
              phases are completed.
            </p>
          </div>

          <div className="workflow-grid">
            {WORKFLOW_STEPS.map((step) => (
              <div key={step.stepNumber} className="surface-card workflow-card">
                <div className="workflow-card__header">
                  <span className="workflow-card__number">
                    STEP {step.stepNumber}
                  </span>
                  <span
                    className={`status-pill ${
                      step.isAvailableInPhase1
                        ? 'status-pill--cyan'
                        : 'status-pill--neutral'
                    }`}
                  >
                    {step.phaseAvailability}
                  </span>
                </div>
                <h3 className="workflow-card__title">{step.title}</h3>
                <p className="workflow-card__description">{step.description}</p>
              </div>
            ))}
          </div>

          <div className="workflow-cta-bar">
            <div className="workflow-cta-bar__text">
              <strong>Try the Phase 1 Session Setup Interface:</strong> Explore
              market, timeframe, and historical date configuration right now.
            </div>
            <Link to="/backtest" className="btn btn--primary">
              Configure Your Backtest
            </Link>
          </div>
        </div>
      </section>

      {/* H. WHY BACKTESTING SECTION */}
      <section
        id="why-backtesting"
        className="section section--alt"
        aria-labelledby="why-backtesting-heading"
      >
        <div className="container">
          <div className="section-header">
            <div className="section-eyebrow">EDUCATIONAL VALUE</div>
            <h2 id="why-backtesting-heading" className="section-title">
              WHY HISTORICAL BACKTESTING MATTERS
            </h2>
            <p className="section-description">
              Historical backtesting is an educational discipline for studying
              market structure and evaluating decision-making habits without
              putting capital at risk.
            </p>
          </div>

          <div className="why-grid">
            {WHY_BACKTESTING_POINTS.map((point, index) => (
              <div key={point.id} className="surface-card why-card">
                <div className="why-card__index">0{index + 1}</div>
                <h3 className="why-card__title">{point.title}</h3>
                <p className="why-card__description">{point.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* I. FAQ SECTION */}
      <section
        id="faq"
        className="section section--bordered"
        aria-labelledby="faq-heading"
      >
        <div className="container">
          <div className="section-header">
            <div className="section-eyebrow">COMMON QUESTIONS</div>
            <h2 id="faq-heading" className="section-title">
              FREQUENTLY ASKED QUESTIONS
            </h2>
            <p className="section-description">
              Clear answers regarding platform access, planned market coverage,
              intended data sources, and simulation scope.
            </p>
          </div>

          <div className="faq-list">
            {FAQ_ITEMS.map((item) => {
              const isOpen = Boolean(openFaqIds[item.id]);
              return (
                <div
                  key={item.id}
                  className={`surface-card faq-item ${
                    isOpen ? 'faq-item--open' : ''
                  }`}
                >
                  <h3 className="faq-item__heading">
                    <button
                      type="button"
                      className="faq-item__trigger"
                      aria-expanded={isOpen}
                      aria-controls={`${item.id}-panel`}
                      id={`${item.id}-button`}
                      onClick={() => toggleFaq(item.id)}
                    >
                      <span>{item.question}</span>
                      <span
                        className="faq-item__icon"
                        aria-hidden="true"
                      >
                        {isOpen ? '−' : '+'}
                      </span>
                    </button>
                  </h3>
                  <div
                    id={`${item.id}-panel`}
                    role="region"
                    aria-labelledby={`${item.id}-button`}
                    className="faq-item__panel"
                    hidden={!isOpen}
                  >
                    <p className="faq-item__answer">{item.answer}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* J. DISCLAIMER SECTION */}
      <section
        id="disclaimer"
        className="disclaimer-section"
        aria-labelledby="disclaimer-heading"
      >
        <div className="container">
          <div className="disclaimer-box">
            <div className="disclaimer-box__header">
              <span className="disclaimer-box__badge">
                EDUCATIONAL &amp; SIMULATION DISCLAIMER
              </span>
              <h2 id="disclaimer-heading" className="sr-only">
                Platform Disclaimer
              </h2>
            </div>
            <p className="disclaimer-box__text">{BRAND_IDENTITY.disclaimer}</p>
          </div>
        </div>
      </section>
    </div>
  );
};
