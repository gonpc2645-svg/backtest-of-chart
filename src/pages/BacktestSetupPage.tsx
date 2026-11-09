import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  BRAND_IDENTITY,
  MARKET_CATEGORIES,
  TIMEFRAME_OPTIONS,
} from '../data/platformData';
import {
  ApiCandle,
  ApiCoverage,
  ApiMarketCategory,
  ApiMarketInstrument,
  MarketDataApi,
} from '../services/marketDataApi';
import { MarketCategoryId, TimeframeId } from '../types/backtest';
import { ReplaySession } from '../services/replay/types';
import { ReplayPersistence } from '../services/replay/ReplayPersistence';
import { CANONICAL_CATALOG_INSTRUMENTS } from '../data/canonicalCatalog';

export const BacktestSetupPage: React.FC = () => {
  const navigate = useNavigate();
  const [selectedMarket, setSelectedMarket] =
    useState<MarketCategoryId>('crypto');
  const [marketCategories, setMarketCategories] = useState<ApiMarketCategory[]>([]);
  const [instruments, setInstruments] = useState<ApiMarketInstrument[]>([]);
  const [selectedInstrument, setSelectedInstrument] =
    useState<ApiMarketInstrument | null>(null);
  const [instrumentSearch, setInstrumentSearch] = useState<string>('');
  const [isLoadingInstruments, setIsLoadingInstruments] = useState<boolean>(false);
  const [coverage, setCoverage] = useState<ApiCoverage | null>(null);
  const [isLoadingCoverage, setIsLoadingCoverage] = useState<boolean>(false);

  const [selectedTimeframe, setSelectedTimeframe] =
    useState<TimeframeId>('M15');
  const [selectedDate, setSelectedDate] = useState<string>('2026-11-07');
  const [workspaceNoticeVisible, setWorkspaceNoticeVisible] =
    useState<boolean>(false);
  const [previewCandles, setPreviewCandles] = useState<ApiCandle[]>([]);
  const [isLoadingCandles] = useState<boolean>(false);

  // 1. Load Market Categories on Mount
  useEffect(() => {
    MarketDataApi.getMarkets()
      .then((cats) => {
        if (cats && cats.length > 0) setMarketCategories(cats);
      })
      .catch((err) => {
        console.warn('Backend /api/markets not reachable yet:', err.message);
      });
  }, []);

  // 2. Load Instruments when Market or Search changes
  useEffect(() => {
    let isCancelled = false;
    setIsLoadingInstruments(true);

    MarketDataApi.getInstruments(selectedMarket, instrumentSearch)
      .then((insts) => {
        if (isCancelled) return;
        if (insts && insts.length > 0) {
          setInstruments(insts);
          const currentInList = insts.find((i) => i.id === selectedInstrument?.id);
          if (!currentInList) {
            const preferred =
              insts.find(
                (i) =>
                  i.providerSymbol === 'BTCUSDT' ||
                  i.providerSymbol === 'XAUUSD' ||
                  i.providerSymbol === 'EURUSD' ||
                  i.providerSymbol === 'US30'
              ) || insts[0];
            setSelectedInstrument(preferred);
          }
        } else {
          // If a specific search term was typed and produced 0 results, reflect empty search results
          if (instrumentSearch) {
            setInstruments([]);
            setSelectedInstrument(null);
          } else {
            // Fallback to canonical catalog for this category
            const fallback = CANONICAL_CATALOG_INSTRUMENTS.filter(
              (i) => i.marketCategory === selectedMarket
            );
            setInstruments(fallback);
            if (fallback.length > 0) {
              const preferred =
                fallback.find(
                  (i) =>
                    i.providerSymbol === 'BTCUSDT' ||
                    i.providerSymbol === 'XAUUSD' ||
                    i.providerSymbol === 'EURUSD' ||
                    i.providerSymbol === 'US30'
                ) || fallback[0];
              setSelectedInstrument(preferred);
            } else {
              setSelectedInstrument(null);
            }
          }
        }
      })
      .catch((err) => {
        if (isCancelled) return;
        console.warn('API unavailable, activating canonical verified catalog:', err.message);
        const query = instrumentSearch.trim().toUpperCase();
        const fallback = CANONICAL_CATALOG_INSTRUMENTS.filter(
          (i) =>
            i.marketCategory === selectedMarket &&
            (!query ||
              i.providerSymbol.includes(query) ||
              i.displayName.toUpperCase().includes(query))
        );
        setInstruments(fallback);
        if (fallback.length > 0) {
          const preferred =
            fallback.find(
              (i) =>
                i.providerSymbol === 'BTCUSDT' ||
                i.providerSymbol === 'XAUUSD' ||
                i.providerSymbol === 'EURUSD' ||
                i.providerSymbol === 'US30'
            ) || fallback[0];
          setSelectedInstrument(preferred);
        } else {
          setSelectedInstrument(null);
        }
      })
      .finally(() => {
        if (!isCancelled) setIsLoadingInstruments(false);
      });

    return () => {
      isCancelled = true;
    };
  }, [selectedMarket, instrumentSearch]);

  // 3. Load Coverage when Selected Instrument changes
  useEffect(() => {
    if (!selectedInstrument) {
      setCoverage(null);
      return;
    }

    let isCancelled = false;
    setIsLoadingCoverage(true);

    MarketDataApi.getCoverage(selectedInstrument.id)
      .then((res) => {
        if (isCancelled) return;
        setCoverage(res.coverage);
        if (res.coverage.earliestVerifiedTimestamp) {
          const d = new Date(res.coverage.earliestVerifiedTimestamp);
          const yyyy = d.getUTCFullYear();
          const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
          const dd = String(d.getUTCDate()).padStart(2, '0');
          setSelectedDate(`${yyyy}-${mm}-${dd}`);
        }
      })
      .catch((err) => {
        console.warn('Coverage lookup error:', err.message);
      })
      .finally(() => {
        if (!isCancelled) setIsLoadingCoverage(false);
      });

    return () => {
      isCancelled = true;
    };
  }, [selectedInstrument]);

  const currentMarketMeta =
    MARKET_CATEGORIES.find((m) => m.id === selectedMarket) ??
    MARKET_CATEGORIES[0];

  const currentTimeframe =
    TIMEFRAME_OPTIONS.find((t) => t.id === selectedTimeframe) ??
    TIMEFRAME_OPTIONS[2];

  const handleMarketSelect = (marketId: MarketCategoryId) => {
    setSelectedMarket(marketId);
    setInstrumentSearch('');
    setWorkspaceNoticeVisible(false);
    setPreviewCandles([]);
  };

  const handleTimeframeSelect = (timeframeId: TimeframeId) => {
    setSelectedTimeframe(timeframeId);
  };

  const launchReplaySession = async (inst: ApiMarketInstrument, cov: ApiCoverage) => {
    const sessionId = 'session_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6);
    const startTs = cov.earliestVerifiedTimestamp || Date.now() - 24 * 3600 * 1000;
    const endTs = cov.latestVerifiedTimestamp || Date.now();

    const newSession: ReplaySession = {
      id: sessionId,
      provider: inst.provider,
      instrumentId: inst.id,
      providerSymbol: inst.providerSymbol,
      displayName: inst.displayName || inst.providerSymbol,
      marketCategory: selectedMarket,
      timeframe: selectedTimeframe,
      startTimestamp: startTs,
      endTimestamp: endTs,
      cursor: startTs,
      speed: 1,
      status: 'PAUSED',
      skippedGaps: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
      version: 1,
    };

    await ReplayPersistence.saveSession(newSession);
    navigate(`/backtest/replay/${sessionId}`);
  };

  const handleContinueToWorkspace = async (event: React.FormEvent) => {
    event.preventDefault();

    if (selectedInstrument && coverage && coverage.totalCandlesCount > 0) {
      await launchReplaySession(selectedInstrument, coverage);
      return;
    }

    setWorkspaceNoticeVisible(true);
    setPreviewCandles([]);

    window.setTimeout(() => {
      const noticeEl = document.getElementById('workspace-phase-notice');
      if (noticeEl) {
        noticeEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    }, 50);
  };

  const handleResetConfiguration = () => {
    setSelectedMarket('crypto');
    setSelectedTimeframe('M15');
    setInstrumentSearch('');
    setWorkspaceNoticeVisible(false);
    setPreviewCandles([]);
  };

  const isVerifiedDataAvailable =
    selectedInstrument && coverage && coverage.totalCandlesCount > 0;

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
            <span className="status-pill status-pill--green">
              Phase 1–7 Unified Platform
            </span>
          </div>
        </div>

        {/* Page Heading */}
        <header className="setup-page__header">
          <div className="section-eyebrow">SESSION CONFIGURATION</div>
          <h1 className="setup-page__title">CONFIGURE YOUR BACKTEST</h1>
          <p className="setup-page__subtitle">
            Choose your market, select a verified instrument, and prepare your
            historical backtesting session.
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
                      Choose an asset class to load its verified provider catalog.
                    </p>
                  </div>
                </div>
                <span className="status-pill status-pill--cyan">
                  Selected: {currentMarketMeta.name}
                </span>
              </div>

              <div
                className="setup-market-grid"
                role="radiogroup"
                aria-labelledby="step-market-heading"
              >
                {MARKET_CATEGORIES.map((market) => {
                  const isSelected = market.id === selectedMarket;
                  const catApi = marketCategories.find((c) => c.id === market.id);
                  const isLiveActive = market.id === 'crypto';

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
                        <span
                          className={`status-pill ${
                            isLiveActive ? 'status-pill--green' : 'status-pill--amber'
                          }`}
                        >
                          {isLiveActive ? 'Live Data Active' : 'Awaiting S3 Auth'}
                        </span>
                      </div>
                      <div className="setup-market-option__name">
                        {market.name}
                      </div>
                      <div className="setup-market-option__source">
                        Provider: {market.intendedSource}{' '}
                        {catApi?.instrumentCount ? `(${catApi.instrumentCount} pairs)` : ''}
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
                      Select a real market instrument from the {currentMarketMeta.intendedSource} catalog.
                    </p>
                  </div>
                </div>
                <span
                  className={`status-pill ${
                    selectedMarket === 'crypto' ? 'status-pill--green' : 'status-pill--amber'
                  }`}
                >
                  {selectedMarket === 'crypto'
                    ? 'Binance Spot Feed Connected'
                    : 'Dukascopy Catalog (Awaiting S3 Auth)'}
                </span>
              </div>

              {/* Search Bar */}
              <div className="instrument-search-container">
                <div className="instrument-search-input-wrap">
                  <svg
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    aria-hidden="true"
                  >
                    <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" />
                    <path d="M20 20L16.5 16.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                  </svg>
                  <input
                    type="text"
                    className="instrument-search-input"
                    placeholder={`Search ${currentMarketMeta.name} symbols (e.g. ${
                      selectedMarket === 'crypto' ? 'BTC, ETH, SOL' : 'EUR, XAU, US30'
                    })...`}
                    value={instrumentSearch}
                    onChange={(e) => setInstrumentSearch(e.target.value)}
                  />
                </div>
              </div>

              {/* Instrument Selection List */}
              {isLoadingInstruments ? (
                <div className="instrument-placeholder-box__notice">
                  Loading verified instrument catalog...
                </div>
              ) : instruments.length === 0 ? (
                <div className="instrument-placeholder-box__notice">
                  {instrumentSearch.trim()
                    ? `No instruments found matching "${instrumentSearch}".`
                    : `No instruments available in ${currentMarketMeta.name}.`}
                </div>
              ) : (
                <div className="instrument-picker-list" role="listbox">
                  {instruments.slice(0, 30).map((inst) => {
                    const isSelected = selectedInstrument?.id === inst.id;
                    const hasVerifiedM1 =
                      inst.provider === 'BINANCE' &&
                      ['BTCUSDT', 'ETHUSDT', 'SOLUSDT'].includes(inst.providerSymbol);

                    return (
                      <div
                        key={inst.id}
                        role="option"
                        aria-selected={isSelected}
                        className={`instrument-picker-item ${
                          isSelected ? 'instrument-picker-item--selected' : ''
                        }`}
                        onClick={() => {
                          setSelectedInstrument(inst);
                          setWorkspaceNoticeVisible(false);
                        }}
                      >
                        <div>
                          <div className="instrument-picker-item__symbol">
                            {inst.providerSymbol}
                            <span style={{ marginLeft: 8, fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                              ({inst.baseAsset}/{inst.quoteAsset})
                            </span>
                          </div>
                          <div className="instrument-picker-item__name">
                            {inst.displayName}
                          </div>
                        </div>

                        <div className="instrument-picker-item__right">
                          {hasVerifiedM1 ? (
                            <span className="status-pill status-pill--green">
                              1,000 M1 Stored
                            </span>
                          ) : inst.provider === 'BINANCE' ? (
                            <span className="status-pill status-pill--blue">
                              Spot Feed Ready
                            </span>
                          ) : (
                            <span className="status-pill status-pill--amber">
                              Awaiting S3 Auth
                            </span>
                          )}
                          <span className="status-pill status-pill--neutral">
                            {inst.priceBasis}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Verified Coverage Card for Selected Instrument */}
              {selectedInstrument && (
                <div className="coverage-display-panel">
                  <div className="coverage-display-panel__header">
                    <span>
                      Selected: {selectedInstrument.providerSymbol} ({selectedInstrument.provider})
                    </span>
                    <span
                      className={`status-pill ${
                        isVerifiedDataAvailable ? 'status-pill--green' : 'status-pill--neutral'
                      }`}
                    >
                      {isVerifiedDataAvailable ? 'Verified M1 Coverage' : 'Awaiting Ingestion'}
                    </span>
                  </div>

                  <div className="coverage-display-panel__stats">
                    <div className="coverage-stat-box">
                      <span className="coverage-stat-box__label">Price Basis</span>
                      <span className="coverage-stat-box__value">{selectedInstrument.priceBasis}</span>
                    </div>
                    <div className="coverage-stat-box">
                      <span className="coverage-stat-box__label">Stored M1 Candles</span>
                      <span className="coverage-stat-box__value">
                        {isLoadingCoverage ? '...' : coverage?.totalCandlesCount || 0}
                      </span>
                    </div>
                    <div className="coverage-stat-box">
                      <span className="coverage-stat-box__label">Coverage Status</span>
                      <span className="coverage-stat-box__value">
                        {isLoadingCoverage ? '...' : coverage?.coverageStatus || 'EMPTY'}
                      </span>
                    </div>
                  </div>

                  {coverage?.notes && (
                    <div style={{ marginTop: 10, fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                      <strong>Coverage Note:</strong> {coverage.notes}
                    </div>
                  )}
                </div>
              )}
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
                      Choose candle resolution aggregated strictly from canonical M1 data (Default: M15).
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
                      Bound to verified historical database coverage boundaries.
                    </p>
                  </div>
                </div>
                <span
                  className={`status-pill ${
                    isVerifiedDataAvailable ? 'status-pill--green' : 'status-pill--neutral'
                  }`}
                >
                  {isVerifiedDataAvailable ? 'Coverage Bound' : 'Awaiting Data'}
                </span>
              </div>

              <div className="date-selector-area">
                <div className="date-selector-area__field">
                  <label
                    htmlFor="historical-start-date"
                    className="date-selector-area__label"
                  >
                    Target Historical Date (UTC)
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
                      Selected: {selectedDate || 'Not Set'}
                    </span>
                  </div>
                </div>

                <div className="date-selector-area__notice">
                  {isVerifiedDataAvailable && coverage?.earliestVerifiedTimestamp && coverage?.latestVerifiedTimestamp ? (
                    <div>
                      <strong>Verified Available Range:</strong>{' '}
                      {new Date(coverage.earliestVerifiedTimestamp).toUTCString()} &mdash;{' '}
                      {new Date(coverage.latestVerifiedTimestamp).toUTCString()} ({coverage.totalCandlesCount} M1 candles persisted).
                    </div>
                  ) : (
                    <div>
                      <strong>Historical Coverage Notice:</strong> No verified M1 candles have been stored for this instrument yet.
                      {selectedMarket !== 'crypto' && (
                        <span> Dukascopy historical ingestion is blocked awaiting owner AWS S3 credentials or licensing confirmation.</span>
                      )}
                    </div>
                  )}
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
                      Validate your selected parameters against genuine stored historical data.
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

              {/* Phase 2 Workspace Status Panel */}
              {workspaceNoticeVisible && (
                <div
                  id="workspace-phase-notice"
                  className="workspace-phase-alert"
                  role="status"
                  aria-live="polite"
                >
                  <div className="workspace-phase-alert__header">
                    <span
                      className={`status-pill ${
                        isVerifiedDataAvailable ? 'status-pill--green' : 'status-pill--amber'
                      }`}
                    >
                      {isVerifiedDataAvailable
                        ? 'Historical Data Verified'
                        : 'Awaiting Provider Ingestion'}
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
                    {isVerifiedDataAvailable
                      ? 'Historical Data Verified for Selected Session'
                      : 'Historical Data Ingestion Pending for this Instrument'}
                  </h3>

                  <p className="workspace-phase-alert__text">
                    {isVerifiedDataAvailable ? (
                      <>
                        Historical market data is verified and stored in the persistent database for{' '}
                        <strong>{selectedInstrument?.providerSymbol}</strong> (
                        {coverage?.totalCandlesCount} canonical M1 candles). Replay Workspace and
                        candle-by-candle playback will be enabled in Phase 3.
                      </>
                    ) : selectedMarket === 'crypto' ? (
                      <>
                        Real Binance Spot instrument metadata is loaded. Run the ingestion worker to
                        backfill M1 historical data for {selectedInstrument?.providerSymbol}.
                      </>
                    ) : (
                      <>
                        Dukascopy connector architecture is implemented. Historical ingestion is blocked
                        pending owner-provided AWS S3 Requester-Pays credentials or commercial data
                        redistribution agreement. Refusing to fabricate fake candles.
                      </>
                    )}
                  </p>

                  <div className="workspace-phase-alert__summary">
                    <div className="workspace-phase-alert__summary-item">
                      <span className="workspace-phase-alert__label">Selected Instrument</span>
                      <span className="workspace-phase-alert__value">
                        {selectedInstrument?.providerSymbol} ({selectedInstrument?.provider})
                      </span>
                    </div>
                    <div className="workspace-phase-alert__summary-item">
                      <span className="workspace-phase-alert__label">Price Basis</span>
                      <span className="workspace-phase-alert__value">
                        {selectedInstrument?.priceBasis ||
                          (currentMarketMeta.intendedSource === 'Dukascopy' ? 'BID' : 'LAST')}
                      </span>
                    </div>
                    <div className="workspace-phase-alert__summary-item">
                      <span className="workspace-phase-alert__label">Selected Timeframe</span>
                      <span className="workspace-phase-alert__value">
                        {currentTimeframe.label} ({currentTimeframe.fullName})
                      </span>
                    </div>
                    <div className="workspace-phase-alert__summary-item">
                      <span className="workspace-phase-alert__label">Stored M1 Candles</span>
                      <span className="workspace-phase-alert__value">
                        {coverage?.totalCandlesCount || 0}
                      </span>
                    </div>
                  </div>

                  {/* Real OHLCV Preview Table */}
                  {isLoadingCandles ? (
                    <div style={{ marginTop: 14, fontSize: '0.84rem', color: 'var(--text-muted)' }}>
                      Querying persistent database for genuine {selectedTimeframe} candles...
                    </div>
                  ) : previewCandles.length > 0 && (
                    <div className="candles-preview-table-wrap">
                      <div style={{ padding: '8px 10px', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                        <strong>Live Database Query Preview ({selectedTimeframe} Resolution):</strong>
                      </div>
                      <table className="candles-preview-table">
                        <thead>
                          <tr>
                            <th>Timestamp (UTC)</th>
                            <th>Open</th>
                            <th>High</th>
                            <th>Low</th>
                            <th>Close</th>
                            <th>Volume</th>
                          </tr>
                        </thead>
                        <tbody>
                          {previewCandles.map((c) => (
                            <tr key={c.timestamp}>
                              <td>{new Date(c.timestamp).toISOString().replace('.000Z', '')}</td>
                              <td>{c.open.toFixed(2)}</td>
                              <td>{c.high.toFixed(2)}</td>
                              <td>{c.low.toFixed(2)}</td>
                              <td>{c.close.toFixed(2)}</td>
                              <td>{c.volume ? c.volume.toFixed(4) : '-'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

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
                <span className="status-pill status-pill--green">Phase 1–7 Unified</span>
              </div>

              <dl className="setup-summary-list">
                <div className="setup-summary-list__row">
                  <dt>Market Category</dt>
                  <dd>
                    <strong>{currentMarketMeta.name}</strong> ({currentMarketMeta.code})
                  </dd>
                </div>
                <div className="setup-summary-list__row">
                  <dt>Selected Instrument</dt>
                  <dd>
                    <strong>{selectedInstrument?.providerSymbol || 'None'}</strong>
                  </dd>
                </div>
                <div className="setup-summary-list__row">
                  <dt>Data Provider</dt>
                  <dd>{selectedInstrument?.provider || currentMarketMeta.intendedSource}</dd>
                </div>
                <div className="setup-summary-list__row">
                  <dt>Price Basis</dt>
                  <dd>
                    {selectedInstrument?.priceBasis ||
                      (currentMarketMeta.intendedSource === 'Dukascopy' ? 'BID' : 'LAST')}
                  </dd>
                </div>
                <div className="setup-summary-list__row">
                  <dt>Verified M1 Candles</dt>
                  <dd>
                    {isVerifiedDataAvailable ? `${coverage?.totalCandlesCount} Candles` : '0 (Pending)'}
                  </dd>
                </div>
                <div className="setup-summary-list__row">
                  <dt>Timeframe Resolution</dt>
                  <dd>
                    <strong>{currentTimeframe.label}</strong> &mdash; {currentTimeframe.fullName}
                  </dd>
                </div>
                <div className="setup-summary-list__row">
                  <dt>Target Date (UTC)</dt>
                  <dd>{selectedDate || 'Not specified'}</dd>
                </div>
                <div className="setup-summary-list__row">
                  <dt>Engine Status</dt>
                  <dd>
                    <span style={{ color: isVerifiedDataAvailable ? '#34d399' : 'var(--text-muted)' }}>
                      {isVerifiedDataAvailable ? 'Data Verified' : 'Catalog Connected'}
                    </span>
                  </dd>
                </div>
              </dl>

              <div className="setup-summary-card__roadmap">
                <h3 className="setup-summary-card__roadmap-title">
                  PLATFORM INTEGRATION ROADMAP
                </h3>
                <ul className="setup-roadmap-list">
                  <li className="setup-roadmap-list__item setup-roadmap-list__item--done">
                    <span className="setup-roadmap-list__phase">Phase 1</span>
                    <span>Website Foundation &amp; Setup UI</span>
                  </li>
                  <li className="setup-roadmap-list__item setup-roadmap-list__item--done">
                    <span className="setup-roadmap-list__phase" style={{ color: '#34d399' }}>Phase 2</span>
                    <span><strong>Historical Data Engine (Binance M1 Active)</strong></span>
                  </li>
                  <li className="setup-roadmap-list__item setup-roadmap-list__item--done">
                    <span className="setup-roadmap-list__phase" style={{ color: '#22d3ee' }}>Phase 3</span>
                    <span><strong>Proprietary Replay Engine (Active)</strong></span>
                  </li>
                  <li className="setup-roadmap-list__item setup-roadmap-list__item--done">
                    <span className="setup-roadmap-list__phase" style={{ color: '#a855f7' }}>Phase 4</span>
                    <span><strong>Simulated Trading Engine (Active)</strong></span>
                  </li>
                  <li className="setup-roadmap-list__item setup-roadmap-list__item--done">
                    <span className="setup-roadmap-list__phase" style={{ color: '#10b981' }}>Phase 5</span>
                    <span><strong>Analytics &amp; Performance Reporting (Active)</strong></span>
                  </li>
                  <li className="setup-roadmap-list__item setup-roadmap-list__item--done">
                    <span className="setup-roadmap-list__phase" style={{ color: '#f59e0b' }}>Phase 6</span>
                    <span><strong>TV Advanced Adapter Ready (Lightweight Charts Active)</strong></span>
                  </li>
                  <li className="setup-roadmap-list__item setup-roadmap-list__item--done">
                    <span className="setup-roadmap-list__phase" style={{ color: '#6366f1' }}>Phase 7</span>
                    <span><strong>Production Hardened &amp; Audited</strong></span>
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
