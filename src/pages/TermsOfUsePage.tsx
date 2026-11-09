import React from 'react';
import { Link } from 'react-router-dom';
import { BRAND_IDENTITY } from '../data/platformData';

export const TermsOfUsePage: React.FC = () => {
  return (
    <div className="legal-page">
      <div className="container legal-page__container">
        <div className="legal-page__topbar">
          <Link to="/" className="back-home-link">
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              aria-hidden="true"
            >
              <path
                d="M19 12H5M5 12L11 18M5 12L11 6"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            <span>Back to Home</span>
          </Link>
          <span className="status-pill status-pill--neutral">
            Starter Document • Owner Review Required
          </span>
        </div>

        <article className="surface-card legal-card">
          <header className="legal-card__header">
            <div className="section-eyebrow">LEGAL &amp; TERMS</div>
            <h1 className="legal-card__title">TERMS OF USE</h1>
            <p className="legal-card__meta">
              Platform: <strong>{BRAND_IDENTITY.name}</strong> • Status: Starter
              Template (Requires Owner Legal Review)
            </p>
          </header>

          <div className="owner-review-callout" role="note">
            <strong>[OWNER REVIEW REQUIRED]:</strong> These Terms of Use are a
            starter template prepared for Phase 1 of{' '}
            <strong>{BRAND_IDENTITY.name}</strong>. Please review and insert
            your governing law, jurisdiction, operator identity, and official
            contact information before public legal reliance.
          </div>

          <div className="legal-card__content">
            <section className="legal-section">
              <h2>1. Educational &amp; Simulation Purpose Only</h2>
              <p>{BRAND_IDENTITY.disclaimer}</p>
              <p>
                <strong>{BRAND_IDENTITY.name}</strong> is designed strictly for research, practice, and skill-building. All trading metrics, balances, equities, margin levels, and P/L figures generated on this platform are simulated mathematical calculations.
              </p>
            </section>

            <section className="legal-section">
              <h2>2. No Financial Advice &amp; No Broker Connection</h2>
              <p>
                Nothing on <strong>{BRAND_IDENTITY.name}</strong> constitutes investment advice, trading recommendations, or financial counsel. The platform does not hold custody of user funds, does not connect to live trading accounts, and cannot execute real orders in any financial marketplace.
              </p>
            </section>

            <section className="legal-section">
              <h2>3. Historical Market Data Sources &amp; Coverage Limitations</h2>
              <p>
                Market data presented within the platform originates from identified third-party providers (Binance public Spot REST endpoints for digital assets, and Dukascopy historical data archives for Forex, Metals, and Indices).
              </p>
              <p>
                Historical market archives may inherently contain provider-side gaps, missing minutes, weekend closures, or liquidity anomalies. While our Ingestion Engine normalizes and validates timestamps strictly in UTC, historical candle data is provided on an &ldquo;as-is&rdquo; basis without warranty of continuous perfection.
              </p>
            </section>

            <section className="legal-section">
              <h2>4. Simulated Execution Model &amp; M1 Granularity Bounds</h2>
              <p>
                Simulated orders are executed according to our documented execution engine. Visitors should note that 1-minute (M1) OHLC candles cannot reproduce sub-minute intra-bar tick trajectories. When both Stop Loss (SL) and Take Profit (TP) are touched within the extreme bounds of the same historical candle, the engine conservatively resolves the Stop Loss first to prevent optimistic performance overestimation.
              </p>
            </section>

            <section className="legal-section">
              <h2>5. Client-Side Session Storage &amp; Data Responsibility</h2>
              <p>
                To safeguard visitor privacy, <strong>{BRAND_IDENTITY.name}</strong> requires no login or account creation. Backtesting states, simulated trade logs, and chart drawings are saved directly in your browser&rsquo;s IndexedDB local storage. Local sessions are isolated to your specific browser profile and do not automatically sync across different devices or browsers. Users are encouraged to utilize the built-in CSV and JSON export tools to preserve permanent session archives.
              </p>
            </section>

            <section className="legal-section">
              <h2>6. No Guarantee of Future Returns</h2>
              <p>
                Hypothetical or simulated backtesting performance has inherent limitations. Unlike real market trading, simulated results do not represent actual trading risk, slippage in illiquid conditions, broker commissions, or emotional and behavioral stress. Past historical performance is never an indicator or guarantee of future trading performance.
              </p>
            </section>

            <section className="legal-section">
              <h2>7. Acceptable Use &amp; Platform Availability</h2>
              <p>
                The platform is provided free of charge on an &ldquo;as-is&rdquo; and &ldquo;as-available&rdquo; basis. Visitors agree not to abuse public endpoints, run automated denial-of-service scrapers against market data APIs, or attempt unauthorized modifications to the system.
              </p>
            </section>

            <section className="legal-section">
              <h2>8. Limitation of Liability &amp; Governing Law</h2>
              <p className="owner-placeholder-line">
                [OWNER REVIEW REQUIRED: Insert Governing Law, Dispute Resolution Jurisdiction, Entity Name, and Specific Limitation of Liability Clauses reviewed by qualified legal counsel.]
              </p>
            </section>
          </div>
        </article>
      </div>
    </div>
  );
};
