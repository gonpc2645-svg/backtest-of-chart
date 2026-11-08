import React from 'react';
import { Link } from 'react-router-dom';

export const NotFoundPage: React.FC = () => {
  return (
    <div className="legal-page">
      <div className="container legal-page__container">
        <article className="surface-card legal-card">
          <div className="section-eyebrow">ERROR 404</div>
          <h1 className="legal-card__title">ROUTE NOT FOUND</h1>
          <p className="section-description">
            The requested page could not be found on BACKTEST OF CHART. Use the
            links below to return to the homepage or open the Backtest Setup
            interface.
          </p>
          <div className="hero-section__cta-group">
            <Link to="/" className="btn btn--primary">
              Back to Home
            </Link>
            <Link to="/backtest" className="btn btn--secondary">
              Configure Backtest
            </Link>
          </div>
        </article>
      </div>
    </div>
  );
};
