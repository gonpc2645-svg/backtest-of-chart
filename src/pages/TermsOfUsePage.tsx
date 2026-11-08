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
            </section>

            <section className="legal-section">
              <h2>2. No Financial, Investment, or Brokerage Advice</h2>
              <p>
                Nothing on <strong>{BRAND_IDENTITY.name}</strong> constitutes
                financial advice, investment recommendations, trading signals,
                or brokerage services. The Platform does not execute real market
                orders, hold user funds, or connect to live brokerage accounts.
              </p>
            </section>

            <section className="legal-section">
              <h2>3. Free Access &amp; Platform Availability</h2>
              <p>
                The Platform is provided as a free public web application on an
                &ldquo;as-is&rdquo; and &ldquo;as-available&rdquo; basis.
                Features described as planned for future development phases
                (including Phase 2 historical data feeds, Phase 3 replay
                engines, Phase 4 simulated execution, Phase 5 analytics, and
                Phase 6 charting integrations) are roadmap items and are not
                guaranteed to be active during Phase 1.
              </p>
            </section>

            <section className="legal-section">
              <h2>4. Acceptable Use</h2>
              <p>
                Visitors agree not to misuse the Platform, attempt unauthorised
                access to its hosting infrastructure, scrape or redistribute
                restricted assets, or misrepresent simulated backtesting outputs
                as verified live trading records.
              </p>
            </section>

            <section className="legal-section">
              <h2>5. Limitation of Liability &amp; Governing Law</h2>
              <p className="owner-placeholder-line">
                [OWNER REVIEW REQUIRED: Insert Governing Law, Dispute Resolution
                Jurisdiction, Entity Name, and Specific Limitation of Liability
                Clauses reviewed by qualified legal counsel.]
              </p>
            </section>
          </div>
        </article>
      </div>
    </div>
  );
};
