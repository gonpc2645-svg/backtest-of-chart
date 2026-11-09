import React from 'react';
import { Link } from 'react-router-dom';
import { BRAND_IDENTITY } from '../data/platformData';

export const PrivacyPolicyPage: React.FC = () => {
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
            <div className="section-eyebrow">LEGAL &amp; PRIVACY</div>
            <h1 className="legal-card__title">PRIVACY POLICY</h1>
            <p className="legal-card__meta">
              Platform: <strong>{BRAND_IDENTITY.name}</strong> • Status: Starter
              Template (Requires Owner Legal Review)
            </p>
          </header>

          <div className="owner-review-callout" role="note">
            <strong>[OWNER REVIEW REQUIRED]:</strong> This Privacy Policy is a
            foundational starter document prepared for Phase 1 of{' '}
            <strong>{BRAND_IDENTITY.name}</strong>. Before public production
            launch, the platform owner should review and insert the final
            operating entity details, jurisdiction, hosting/analytics disclosures,
            and official contact email address where marked below.
          </div>

          <div className="legal-card__content">
            <section className="legal-section">
              <h2>1. Overview</h2>
              <p>
                <strong>{BRAND_IDENTITY.name}</strong> (&ldquo;the
                Platform&rdquo;) is a free historical market backtesting
                platform designed for educational market study and simulated
                trading practice.
              </p>
            </section>

            <section className="legal-section">
              <h2>2. No Account Registration or Personal Financial Data</h2>
              <p>
                During Phase 1, the Platform operates without user accounts,
                login credentials, signup forms, or subscription billing
                systems. Visitors are not required to submit personal identity
                documents, payment methods, or brokerage credentials to browse
                the website or access the Backtest Setup interface.
              </p>
            </section>

            <section className="legal-section">
              <h2>3. Technical &amp; Server Logs</h2>
              <p>
                When you access the Platform, standard web hosting
                infrastructure may automatically record basic technical
                information such as browser type, device viewport, referring
                page, and anonymised or standard IP request logs for security
                and reliability purposes.
              </p>
              <p className="owner-placeholder-line">
                [OWNER REVIEW REQUIRED: Specify hosting provider log retention
                period and whether any privacy-friendly analytics or cookies
                will be enabled in production.]
              </p>
            </section>

            <section className="legal-section">
              <h2>4. Client-Side Browser Storage (IndexedDB)</h2>
              <p>
                To provide a 100% private and account-free backtesting experience, simulated trade history, account balances, orders, replay timeline states, and technical chart drawings are stored locally on your device using your browser&rsquo;s IndexedDB API.
              </p>
              <p>
                This data remains entirely on your machine; it is never transmitted to our backend servers, never profiled, and never shared with third parties. Clearing your browser cookies and site storage will reset your locally stored backtest records unless exported to CSV or JSON.
              </p>
            </section>

            <section className="legal-section">
              <h2>5. Public Market Data Providers</h2>
              <p>
                Historical candle data is served from our independent server cache, which integrates public market endpoints (such as Binance Spot Kline endpoints and Dukascopy historical archives). When your browser loads historical price candles from our API, no personal identification or trading telemetry is shared with these external market providers.
              </p>
            </section>

            <section className="legal-section">
              <h2>6. Owner &amp; Privacy Contact Details</h2>
              <p className="owner-placeholder-line">
                [OWNER REVIEW REQUIRED: Insert Legal Entity / Owner Name,
                Registered Jurisdiction, Effective Date, and Official Privacy
                Contact Email Address.]
              </p>
            </section>
          </div>
        </article>
      </div>
    </div>
  );
};
