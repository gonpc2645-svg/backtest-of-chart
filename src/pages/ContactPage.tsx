import React from 'react';
import { Link } from 'react-router-dom';
import { BRAND_IDENTITY } from '../data/platformData';

export const ContactPage: React.FC = () => {
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
            Contact &amp; Inquiries
          </span>
        </div>

        <article className="surface-card legal-card">
          <header className="legal-card__header">
            <div className="section-eyebrow">PLATFORM INQUIRIES</div>
            <h1 className="legal-card__title">CONTACT {BRAND_IDENTITY.name}</h1>
            <p className="legal-card__meta">
              General platform questions, partnership inquiries, and technical
              feedback.
            </p>
          </header>

          <div className="owner-review-callout" role="note">
            <strong>[OWNER REVIEW REQUIRED]:</strong> To avoid inventing
            unverified business emails, phone numbers, or physical addresses in
            Phase 1, please insert your official support email address and
            business contact details in the fields marked below before public
            deployment.
          </div>

          <div className="legal-card__content">
            <section className="legal-section">
              <h2>Official Contact Channels</h2>
              <p>
                For inquiries regarding <strong>{BRAND_IDENTITY.name}</strong>,
                including feedback on the historical backtesting platform or
                licensing correspondence:
              </p>
              <div className="contact-details-grid">
                <div className="surface-card contact-detail-box">
                  <div className="contact-detail-box__label">
                    Platform Identity
                  </div>
                  <div className="contact-detail-box__value">
                    {BRAND_IDENTITY.name}
                  </div>
                </div>
                <div className="surface-card contact-detail-box">
                  <div className="contact-detail-box__label">
                    Official Contact Email
                  </div>
                  <div className="contact-detail-box__value contact-detail-box__value--placeholder">
                    [OWNER REVIEW REQUIRED: Insert official domain email]
                  </div>
                </div>
              </div>
            </section>

            <section className="legal-section">
              <h2>Quick Navigation</h2>
              <p>
                Looking to configure a simulated backtesting session or read
                answers to common questions?
              </p>
              <div className="hero-section__cta-group">
                <Link to="/backtest" className="btn btn--primary">
                  Open Backtest Setup
                </Link>
                <Link to="/#faq" className="btn btn--secondary">
                  View Platform FAQ
                </Link>
              </div>
            </section>
          </div>
        </article>
      </div>
    </div>
  );
};
