import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  BRAND_IDENTITY,
  MARKET_CATEGORIES,
  TIMEFRAME_OPTIONS,
} from '../data/platformData';
import { MarketCategoryId, TimeframeId } from '../types/backtest';

export const BacktestSetupPage: React.FC = () => {
  const [selectedMarket, setSelectedMarket] =
    useState<MarketCategoryId>('forex');
  const [selectedTimeframe, setSelectedTimeframe] =
    useState<TimeframeId>('M15');
  const [selectedDate, setSelectedDate] = useState<string>('2024-06-03');
  const [workspaceNoticeVisible, setWorkspaceNoticeVisible] =
    useState<boolean>(false);

  const currentMarket =
    MARKET_CATEGORIES.find((m) => m.id === selectedMarket) ??
    MARKET_CATEGORIES[0];

  const currentTimeframe =
    TIMEFRAME_OPTIONS.find((t) => t.id === selectedTimeframe) ??
    TIMEFRAME_OPTIONS[2];

  const handleMarketSelect = (marketId: MarketCategoryId) => {
    setSelectedMarket(marketId);
  };

  const handleTimeframeSelect = (timeframeId: TimeframeId) => {
    setSelectedTimeframe(timeframeId);
  };

  const handleContinueToWorkspace = (event: React.FormEvent) => {
    event.preventDefault();
    setWorkspaceNoticeVisible(true);
    window.setTimeout(() => {
      const noticeEl = document.getElementById('workspace-phase-notice');
      if (noticeEl) {
        noticeEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    }, 50);
  };

  const handleResetConfiguration = () => {
    setSelectedMarket('forex');
    setSelectedTimeframe('M15');
    setSelectedDate('2024-06-03');
    setWorkspaceNoticeVisible(false);
  };

  return (
    <div className="setup-page">
      <div className="container setup-page__container">
        {/* Top Back Navigation Bar */}
        <div className="setup-page__topbar">
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

          <div className="setup-page__badges">
            <span className="status-pill status-pill--cyan">
              No Account Required
            </span>
            <span className="status-pill status-pill--blue">
              Phase 1 Setup UI
            </span>
          </div>
        </div>

        {/* Page Heading */}
        <header className="setup-page__header">
          <div className="section-eyebrow">SESSION CONFIGURATION</div>
          <h1 className="setup-page__title">CONFIGURE YOUR BACKTEST</h1>
          <p className="setup-page__subtitle">
            Choose your market and prepare your historical backtesting session.
          </p>
        </header>

        <div className="setup-workspace-layout">
          {/* Left Column: Setup Form Sections 1 - 5 */}
          <form
            className="setup-form"
            onSubmit={handleContinueToWorkspace}
            noValidate
          >
            {/* 1. SELECT MARKET */}
            <section
              className="surface-card setup-step-card"
              aria-labelledby="step-market-heading"
            >
              <div className="setup-step-card__header">
                <div className="setup-step-card__title-group">
                  <span className="setup-step-card__number">01</span>
                  <div>
                    <h2
                      id="step-market-heading"
                      className="setup-step-card__title"
                    >
                      Select Market
                    </h2>
                    <p className="setup-step-card__desc">
                      Choose an intended asset class for your backtesting
                      session.
                    </p>
                  </div>
                </div>
                <span className="status-pill status-pill--cyan">
                  Selected: {currentMarket.name}
                </span>
              </div>

              <div
                className="setup-market-grid"
                role="radiogroup"
                aria-labelledby="step-market-heading"
              >
                {MARKET_CATEGORIES.map((market) => {
                  const isSelected = market.id === selectedMarket;
                  return (
                    <button
                      key={market.id}
                      type="button"
                      role="radio"
                      aria-checked={isSelected}
                      className={`setup-market-option ${
                        isSelected ? 'setup-market-option--selected' : ''
                      }`}
                      onClick={() => handleMarketSelect(market.id)}
                    >
                      <div className="setup-market-option__top">
                        <span className="setup-market-option__code">
                          {market.code}
                        </span>
                        <span className="setup-market-option__indicator" />
                      </div>
                      <div className="setup-market-option__name">
                        {market.name}
                      </div>
                      <div className="setup-market-option__source">
                        Planned source: {market.intendedSource}
                      </div>
                    </button>
                  );
                })}
              </div>
            </section>

            {/* 2. SELECT INSTRUMENT */}
            <section
              className="surface-card setup-step-card"
              aria-labelledby="step-instrument-heading"
            >
              <div className="setup-step-card__header">
                <div className="setup-step-card__title-group">
                  <span className="setup-step-card__number">02</span>
                  <div>
                    <h2
                      id="step-instrument-heading"
                      className="setup-step-card__title"
                    >
                      Select Instrument
                    </h2>
                    <p className="setup-step-card__desc">
                      API-driven instrument selector prepared for{' '}
                      {currentMarket.name} symbols.
                    </p>
                  </div>
                </div>
                <span className="status-pill status-pill--neutral">
                  Connected in Phase 2
                </span>
              </div>

              <div className="instrument-placeholder-box">
                <div className="instrument-placeholder-box__control">
                  <div className="instrument-placeholder-box__input-mock">
                    <svg
                      width="18"
                      height="18"
                      viewBox="0 0 24 24"
                      fill="none"
                      aria-hidden="true"
                    >
                      <circle
                        cx="11"
                        cy="11"
                        r="7"
                        stroke="currentColor"
                        strokeWidth="2"
                      />
                      <path
                        d="M20 20L16.5 16.5"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                      />
                    </svg>
                    <span>
                      {currentMarket.name} Instrument List — Awaiting Phase 2{' '}
                      {currentMarket.intendedSource} Data Integration
                    </span>
                  </div>
                  <span className="instrument-placeholder-box__tag">
                    API Feed Pending
                  </span>
                </div>

                <div className="instrument-placeholder-box__notice">
                  <p className="instrument-placeholder-box__notice-title">
                    Instrument List Will Be Connected in Phase 2
                  </p>
                  <p className="instrument-placeholder-box__notice-text">
                    {currentMarket.instrumentSchemaNote} Real market data
                    integrations are not part of Phase 1, so no live or
                    fabricated instrument availability is displayed here.
                  </p>
                </div>
              </div>
            </section>

            {/* 3. SELECT TIMEFRAME */}
            <section
              className="surface-card setup-step-card"
              aria-labelledby="step-timeframe-heading"
            >
              <div className="setup-step-card__header">
                <div className="setup-step-card__title-group">
                  <span className="setup-step-card__number">03</span>
                  <div>
                    <h2
                      id="step-timeframe-heading"
                      className="setup-step-card__title"
                    >
                      Select Timeframe
                    </h2>
                    <p className="setup-step-card__desc">
                      Choose the planned candle resolution for historical chart
                      replay (Default: M15).
                    </p>
                  </div>
                </div>
                <span className="status-pill status-pill--cyan">
                  {currentTimeframe.label} ({currentTimeframe.fullName})
                </span>
              </div>

              <div
                className="timeframe-selector-grid"
                role="radiogroup"
                aria-labelledby="step-timeframe-heading"
              >
                {TIMEFRAME_OPTIONS.map((tf) => {
                  const isSelected = tf.id === selectedTimeframe;
                  return (
                    <button
                      key={tf.id}
                      type="button"
                      role="radio"
                      aria-checked={isSelected}
                      className={`timeframe-btn ${
                        isSelected ? 'timeframe-btn--selected' : ''
                      }`}
                      onClick={() => handleTimeframeSelect(tf.id)}
                    >
                      <span className="timeframe-btn__code">{tf.label}</span>
                      <span className="timeframe-btn__name">{tf.fullName}</span>
                    </button>
                  );
                })}
              </div>
            </section>

            {/* 4. SELECT HISTORICAL DATE */}
            <section
              className="surface-card setup-step-card"
              aria-labelledby="step-date-heading"
            >
              <div className="setup-step-card__header">
                <div className="setup-step-card__title-group">
                  <span className="setup-step-card__number">04</span>
                  <div>
                    <h2
                      id="step-date-heading"
                      className="setup-step-card__title"
                    >
                      Select Historical Date
                    </h2>
                    <p className="setup-step-card__desc">
                      Date selection interface designed for future integration
                      with historical data availability.
                    </p>
                  </div>
                </div>
                <span className="status-pill status-pill--neutral">
                  Date Coverage Bound in Phase 2
                </span>
              </div>

              <div className="date-selector-area">
                <div className="date-selector-area__field">
                  <label
                    htmlFor="historical-start-date"
                    className="date-selector-area__label"
                  >
                    Target Historical Replay Date (UI Configuration Preview)
                  </label>
                  <div className="date-selector-area__input-row">
                    <input
                      id="historical-start-date"
                      type="date"
                      className="date-selector-area__input"
                      value={selectedDate}
                      onChange={(e) => setSelectedDate(e.target.value)}
                    />
                    <span className="date-selector-area__selected-badge">
                      Configured Date: {selectedDate || 'Not Set'}
                    </span>
                  </div>
                </div>

                <div className="date-selector-area__notice">
                  <strong>Historical Coverage Notice:</strong> Verified earliest
                  and latest date ranges are not claimed or enforced in Phase 1.
                  Instrument-specific historical date boundaries will be
                  dynamically validated once {currentMarket.intendedSource}{' '}
                  historical datasets are connected in Phase 2.
                </div>
              </div>
            </section>

            {/* 5. START WORKSPACE */}
            <section
              className="surface-card setup-step-card setup-step-card--cta"
              aria-labelledby="step-workspace-heading"
            >
              <div className="setup-step-card__header">
                <div className="setup-step-card__title-group">
                  <span className="setup-step-card__number">05</span>
                  <div>
                    <h2
                      id="step-workspace-heading"
                      className="setup-step-card__title"
                    >
                      Start Workspace
                    </h2>
                    <p className="setup-step-card__desc">
                      Review your configuration parameters and proceed to the
                      workspace status view.
                    </p>
                  </div>
                </div>
              </div>

              <div className="setup-cta-actions">
                <button
                  type="submit"
                  className="btn btn--primary btn--lg btn--full"
                >
                  <span>CONTINUE TO BACKTEST WORKSPACE</span>
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
                </button>
                <button
                  type="button"
                  className="btn btn--secondary btn--sm"
                  onClick={handleResetConfiguration}
                >
                  Reset Selection Defaults
                </button>
              </div>

              {/* Phase 1 Workspace Development Status Message */}
              {workspaceNoticeVisible && (
                <div
                  id="workspace-phase-notice"
                  className="workspace-phase-alert"
                  role="status"
                  aria-live="polite"
                >
                  <div className="workspace-phase-alert__header">
                    <span className="status-pill status-pill--cyan">
                      Phase 1 Foundation Status
                    </span>
                    <button
                      type="button"
                      className="workspace-phase-alert__close"
                      aria-label="Dismiss status message"
                      onClick={() => setWorkspaceNoticeVisible(false)}
                    >
                      &times;
                    </button>
                  </div>

                  <h3 className="workspace-phase-alert__title">
                    Backtest Workspace &amp; Historical Data Integration In
                    Development
                  </h3>

                  <p className="workspace-phase-alert__text">
                    Your session setup parameters have been configured in the
                    Phase 1 interface. The interactive charting workspace,
                    historical market data pipelines (
                    <strong>{currentMarket.intendedSource}</strong>), and
                    candle-by-candle replay engine are scheduled for
                    implementation in upcoming development phases (Phases 2–6).
                  </p>

                  <div className="workspace-phase-alert__summary">
                    <div className="workspace-phase-alert__summary-item">
                      <span className="workspace-phase-alert__label">
                        Selected Market
                      </span>
                      <span className="workspace-phase-alert__value">
                        {currentMarket.name} ({currentMarket.code})
                      </span>
                    </div>
                    <div className="workspace-phase-alert__summary-item">
                      <span className="workspace-phase-alert__label">
                        Instrument List
                      </span>
                      <span className="workspace-phase-alert__value">
                        Planned Phase 2 ({currentMarket.intendedSource})
                      </span>
                    </div>
                    <div className="workspace-phase-alert__summary-item">
                      <span className="workspace-phase-alert__label">
                        Selected Timeframe
                      </span>
                      <span className="workspace-phase-alert__value">
                        {currentTimeframe.label} ({currentTimeframe.fullName})
                      </span>
                    </div>
                    <div className="workspace-phase-alert__summary-item">
                      <span className="workspace-phase-alert__label">
                        Target Date Input
                      </span>
                      <span className="workspace-phase-alert__value">
                        {selectedDate || 'Not specified'}
                      </span>
                    </div>
                  </div>

                  <div className="workspace-phase-alert__footer">
                    <Link to="/" className="btn btn--secondary btn--sm">
                      Return to Homepage
                    </Link>
                  </div>
                </div>
              )}
            </section>
          </form>

          {/* Right Column: Sticky Session Configuration Summary & Roadmap Sidebar */}
          <aside
            className="setup-summary-sidebar"
            aria-label="Current Session Configuration Summary"
          >
            <div className="surface-card setup-summary-card">
              <div className="setup-summary-card__header">
                <h2 className="setup-summary-card__title">
                  SESSION CONFIGURATION
                </h2>
                <span className="status-pill status-pill--blue">Phase 1</span>
              </div>

              <dl className="setup-summary-list">
                <div className="setup-summary-list__row">
                  <dt>Market Category</dt>
                  <dd>
                    <strong>{currentMarket.name}</strong> ({currentMarket.code})
                  </dd>
                </div>
                <div className="setup-summary-list__row">
                  <dt>Intended Data Source</dt>
                  <dd>{currentMarket.intendedSource} (Phase 2)</dd>
                </div>
                <div className="setup-summary-list__row">
                  <dt>Instrument Feed</dt>
                  <dd className="text-muted">Connected in Phase 2</dd>
                </div>
                <div className="setup-summary-list__row">
                  <dt>Timeframe Resolution</dt>
                  <dd>
                    <strong>{currentTimeframe.label}</strong> —{' '}
                    {currentTimeframe.fullName}
                  </dd>
                </div>
                <div className="setup-summary-list__row">
                  <dt>Target Date Input</dt>
                  <dd>{selectedDate || 'Not specified'}</dd>
                </div>
                <div className="setup-summary-list__row">
                  <dt>Execution Mode</dt>
                  <dd>100% Simulated (Planned Phase 4)</dd>
                </div>
              </dl>

              <div className="setup-summary-card__roadmap">
                <h3 className="setup-summary-card__roadmap-title">
                  UPCOMING INTEGRATION ROADMAP
                </h3>
                <ul className="setup-roadmap-list">
                  <li className="setup-roadmap-list__item setup-roadmap-list__item--done">
                    <span className="setup-roadmap-list__phase">Phase 1</span>
                    <span>Website Foundation &amp; Setup UI</span>
                  </li>
                  <li className="setup-roadmap-list__item">
                    <span className="setup-roadmap-list__phase">Phase 2</span>
                    <span>Dukascopy &amp; Binance Data Integration</span>
                  </li>
                  <li className="setup-roadmap-list__item">
                    <span className="setup-roadmap-list__phase">Phase 3</span>
                    <span>Historical Market Replay Engine</span>
                  </li>
                  <li className="setup-roadmap-list__item">
                    <span className="setup-roadmap-list__phase">Phase 4</span>
                    <span>Simulated Trading &amp; Risk Engine</span>
                  </li>
                  <li className="setup-roadmap-list__item">
                    <span className="setup-roadmap-list__phase">Phase 5</span>
                    <span>Backtest Performance Analytics</span>
                  </li>
                  <li className="setup-roadmap-list__item">
                    <span className="setup-roadmap-list__phase">Phase 6</span>
                    <span>
                      TradingView Advanced Charts (Subject to Approval)
                    </span>
                  </li>
                </ul>
              </div>

              <div className="setup-summary-card__disclaimer">
                {BRAND_IDENTITY.disclaimer}
              </div>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
};
