import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { ReplayEngine } from '../services/replay/ReplayEngine';
import {
  ReplayDataGap,
  ReplaySession,
  ReplaySpeed,
  ReplayState,
  TimeframeId,
} from '../services/replay/types';
import { ReplayPersistence } from '../services/replay/ReplayPersistence';
import { LegendOHLC, ReplayChartAdapter } from '../components/replay/ReplayChartAdapter';
import { MarketDataApi } from '../services/marketDataApi';
import { TradingEngine } from '../services/trading/TradingEngine';
import {
  CreateOrderRequest,
  Position,
  TradingState,
} from '../services/trading/TradingTypes';
import { TradingPersistence } from '../services/trading/TradingPersistence';
import { AccountSummaryBar } from '../components/trading/AccountSummaryBar';
import { OrderEntryPanel } from '../components/trading/OrderEntryPanel';
import { BottomTradingPanel } from '../components/trading/BottomTradingPanel';
import { PositionModifyModal } from '../components/trading/PositionModifyModal';
import { AccountResetModal } from '../components/trading/AccountResetModal';
import { ExportImportModal } from '../components/trading/ExportImportModal';
import '../styles/replayWorkspace.css';
import '../styles/trading.css';

const TIMEFRAMES: TimeframeId[] = ['M1', 'M5', 'M15', 'M30', 'H1', 'H4', 'D1'];
const SPEEDS: ReplaySpeed[] = [0.5, 1, 2, 5, 10, 20];

export const ReplayWorkspacePage: React.FC = () => {
  const { sessionId } = useParams<{ sessionId?: string }>();
  const [searchParams] = useSearchParams();

  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartAdapterRef = useRef<ReplayChartAdapter | null>(null);
  const engineRef = useRef<ReplayEngine | null>(null);
  const tradingEngineRef = useRef<TradingEngine | null>(null);

  const [session, setSession] = useState<ReplaySession | null>(null);
  const [engineState, setEngineState] = useState<ReplayState>('INITIALIZING');
  const [cursor, setCursor] = useState<number>(0);
  const [progressPct, setProgressPct] = useState<number>(0);
  const [currentSpeed, setCurrentSpeed] = useState<ReplaySpeed>(1);
  const [currentTimeframe, setCurrentTimeframe] = useState<TimeframeId>('M15');
  const [currentLegend, setCurrentLegend] = useState<LegendOHLC | null>(null);
  const [dataGap, setDataGap] = useState<ReplayDataGap | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Phase 4 Trading States
  const [tradingState, setTradingState] = useState<TradingState | null>(null);
  const [modifyingPosition, setModifyingPosition] = useState<Position | null>(null);
  const [isResetModalOpen, setIsResetModalOpen] = useState<boolean>(false);
  const [isExportImportModalOpen, setIsExportImportModalOpen] = useState<boolean>(false);
  const [isBottomPanelCollapsed, setIsBottomPanelCollapsed] = useState<boolean>(false);

  // Format UTC datetime
  const formatUtc = (ts: number): string => {
    if (!ts || isNaN(ts)) return '--';
    const d = new Date(ts);
    return d.toISOString().replace('T', ' ').replace('.000Z', ' UTC');
  };

  // Format price
  const formatPrice = (p: number | undefined): string => {
    if (p === undefined || isNaN(p)) return '-';
    return p.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 4 });
  };

  // Get current market price safely
  const getCurrentPrice = useCallback((): number => {
    const curCandle = engineRef.current?.getCurrentCandle();
    if (curCandle && curCandle.close > 0) return curCandle.close;
    if (currentLegend && currentLegend.close > 0) return currentLegend.close;
    const bars = engineRef.current?.getCurrentBars();
    if (bars && bars.length > 0) return bars[bars.length - 1].close;
    return 0;
  }, [currentLegend]);

  // 1. Load or Build Session
  useEffect(() => {
    let isCancelled = false;

    const setupSession = async () => {
      try {
        setIsLoading(true);
        setErrorMessage(null);

        let activeSession: ReplaySession | null = null;

        // Try load from ID in route
        if (sessionId) {
          activeSession = await ReplayPersistence.getSession(sessionId);
        }

        // If not found by ID, check if query params provided
        if (!activeSession) {
          const queryInst = searchParams.get('instrument');
          const queryTf = (searchParams.get('tf') as TimeframeId) || 'M15';
          const queryStart = Number(searchParams.get('start'));
          const queryEnd = Number(searchParams.get('end'));

          if (queryInst && !isNaN(queryStart) && !isNaN(queryEnd) && queryEnd > queryStart) {
            const sym = queryInst.split(':')[1] || queryInst;
            activeSession = {
              id: 'session_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
              provider: queryInst.startsWith('DUKASCOPY') ? 'DUKASCOPY' : 'BINANCE',
              instrumentId: queryInst,
              providerSymbol: sym,
              displayName: sym,
              marketCategory: 'crypto',
              timeframe: queryTf,
              startTimestamp: queryStart,
              endTimestamp: queryEnd,
              cursor: queryStart,
              speed: 1,
              status: 'PAUSED',
              skippedGaps: [],
              createdAt: Date.now(),
              updatedAt: Date.now(),
              version: 1,
            };
            await ReplayPersistence.saveSession(activeSession);
          }
        }

        // If still no session, load most recent from IndexedDB
        if (!activeSession) {
          const all = await ReplayPersistence.getAllSessions();
          if (all.length > 0) {
            activeSession = all[0];
          }
        }

        // If no past sessions exist, use verified BTCUSDT range
        if (!activeSession) {
          const covRes = await MarketDataApi.getCoverage('BINANCE:BTCUSDT').catch(() => null);
          const earliest = covRes?.coverage?.earliestVerifiedTimestamp || 1794050000000;
          const latest = covRes?.coverage?.latestVerifiedTimestamp || earliest + 1000 * 60 * 1000;

          activeSession = {
            id: 'session_default_btc',
            provider: 'BINANCE',
            instrumentId: 'BINANCE:BTCUSDT',
            providerSymbol: 'BTCUSDT',
            displayName: 'Bitcoin / Tether USD Spot',
            marketCategory: 'crypto',
            timeframe: 'M15',
            startTimestamp: earliest,
            endTimestamp: latest,
            cursor: earliest,
            speed: 1,
            status: 'PAUSED',
            skippedGaps: [],
            createdAt: Date.now(),
            updatedAt: Date.now(),
            version: 1,
          };
          await ReplayPersistence.saveSession(activeSession);
        }

        if (isCancelled) return;

        setSession(activeSession);
        setCursor(activeSession.cursor);
        setCurrentSpeed(activeSession.speed || 1);
        setCurrentTimeframe(activeSession.timeframe || 'M15');
      } catch (err: unknown) {
        if (!isCancelled) {
          setErrorMessage(err instanceof Error ? err.message : String(err));
          setIsLoading(false);
        }
      }
    };

    setupSession();

    return () => {
      isCancelled = true;
    };
  }, [sessionId, searchParams]);

  // 2. Initialize ReplayEngine, TradingEngine & Chart
  useEffect(() => {
    if (!session || !chartContainerRef.current) return;

    let isDisposed = false;

    // A. Create chart adapter
    const adapter = new ReplayChartAdapter();
    adapter.initialize(chartContainerRef.current, (legend) => {
      setCurrentLegend(legend);
    });
    chartAdapterRef.current = adapter;

    // B. Create replay engine
    const engine = new ReplayEngine(session);
    engineRef.current = engine;

    // Attach replay listeners
    engine.on('stateChange', (st) => {
      setEngineState(st);
      if (st !== 'DATA_GAP') {
        setDataGap(null);
      }
    });

    engine.on('cursorChange', (newCursor, pct) => {
      setCursor(newCursor);
      setProgressPct(pct);
    });

    engine.on('candleUpdate', (candle) => {
      adapter.updateCandle(candle);
    });

    engine.on('speedChange', (speed) => {
      setCurrentSpeed(speed);
    });

    engine.on('timeframeChange', (tf) => {
      setCurrentTimeframe(tf);
      adapter.setCandles(engine.getCurrentBars());
    });

    engine.on('gapDetected', (gap) => {
      setDataGap(gap);
    });

    engine.on('error', (err) => {
      setErrorMessage(err);
    });

    // C. Initialize TradingEngine
    MarketDataApi.getCoverage(session.instrumentId)
      .then(async (covData) => {
        if (isDisposed) return;
        const savedTradingState = await TradingPersistence.getTradingState(session.id);
        if (isDisposed) return;

        const tradingEngine = new TradingEngine(session.id, covData.instrument, savedTradingState || undefined);
        tradingEngineRef.current = tradingEngine;
        setTradingState(tradingEngine.getState());

        // Attach trading engine event listener
        tradingEngine.on('stateChange', (st) => {
          setTradingState({ ...st });
          adapter.updateTradeOverlays(st.positions, st.pendingOrders);
        });

        // Pipe canonical M1 candle to trading engine on every simulation step
        engine.on('m1Candle', (m1) => {
          tradingEngineRef.current?.onTick(m1);
        });

        // Initial overlay update
        adapter.updateTradeOverlays(tradingEngine.getPositions(), tradingEngine.getPendingOrders());
      })
      .catch((err) => {
        console.warn('[TradingEngine Init] Error loading instrument specification:', err);
      });

    // Initialize historical data and bars
    engine
      .initialize()
      .then(() => {
        setIsLoading(false);
        const bars = engine.getCurrentBars();
        adapter.setCandles(bars);
        adapter.fitContent();
        setEngineState(engine.getState());
      })
      .catch((err) => {
        setIsLoading(false);
        setErrorMessage(err instanceof Error ? err.message : String(err));
      });

    // Auto-pause if user switches tabs
    const handleVisibilityChange = () => {
      if (document.hidden && engine.getState() === 'PLAYING') {
        engine.pause();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      isDisposed = true;
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      engine.dispose();
      adapter.dispose();
      tradingEngineRef.current?.dispose();
      engineRef.current = null;
      chartAdapterRef.current = null;
      tradingEngineRef.current = null;
    };
  }, [session]);

  // Keyboard shortcut handler
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if user is in an input field
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLSelectElement) {
        return;
      }

      const engine = engineRef.current;
      if (!engine) return;

      if (e.code === 'Space') {
        e.preventDefault();
        if (engine.getState() === 'PLAYING') {
          engine.pause();
        } else if (engine.getState() === 'PAUSED' || engine.getState() === 'READY') {
          engine.play();
        }
      } else if (e.code === 'ArrowRight') {
        e.preventDefault();
        engine.stepForward();
      } else if (e.code === 'ArrowLeft') {
        e.preventDefault();
        const success = engine.stepBackward();
        if (success && chartAdapterRef.current) {
          chartAdapterRef.current.setCandles(engine.getCurrentBars());
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // UI Actions: Replay Controls
  const handlePlay = useCallback(() => {
    engineRef.current?.play();
  }, []);

  const handlePause = useCallback(() => {
    engineRef.current?.pause();
  }, []);

  const handleStepForward = useCallback(async () => {
    await engineRef.current?.stepForward();
  }, []);

  const handleStepBackward = useCallback(() => {
    const success = engineRef.current?.stepBackward();
    if (success && chartAdapterRef.current && engineRef.current) {
      chartAdapterRef.current.setCandles(engineRef.current.getCurrentBars());
    }
  }, []);

  const handleResetReplay = useCallback(() => {
    engineRef.current?.reset();
    if (chartAdapterRef.current && engineRef.current) {
      chartAdapterRef.current.setCandles(engineRef.current.getCurrentBars());
      chartAdapterRef.current.fitContent();
    }
  }, []);

  const handleSpeedChange = useCallback((speed: ReplaySpeed) => {
    engineRef.current?.setSpeed(speed);
  }, []);

  const handleTimeframeChange = useCallback((tf: TimeframeId) => {
    engineRef.current?.setTimeframe(tf);
  }, []);

  const handleContinueAcrossGap = useCallback(() => {
    engineRef.current?.continueAcrossGap();
    setDataGap(null);
  }, []);

  const handleScrubChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (!session || !engineRef.current) return;
    const pct = Number(e.target.value);
    const range = session.endTimestamp - session.startTimestamp;
    const targetMs = session.startTimestamp + (range * pct) / 100;
    engineRef.current.seek(targetMs);
    if (chartAdapterRef.current) {
      chartAdapterRef.current.setCandles(engineRef.current.getCurrentBars());
    }
  }, [session]);

  // UI Actions: Trading Actions
  const handleOrderSubmit = useCallback((req: CreateOrderRequest): { success: boolean; error?: string } => {
    if (!tradingEngineRef.current || !engineRef.current) {
      return { success: false, error: 'Trading Engine not ready.' };
    }
    const curPrice = getCurrentPrice();
    const curCursor = engineRef.current.getCursor();
    return tradingEngineRef.current.placeOrder(req, curPrice, curCursor);
  }, [getCurrentPrice]);

  const handleClosePosition = useCallback((positionId: string) => {
    if (!tradingEngineRef.current || !engineRef.current) return;
    const curPrice = getCurrentPrice();
    const curCursor = engineRef.current.getCursor();
    tradingEngineRef.current.closePosition(positionId, curPrice, curCursor);
  }, [getCurrentPrice]);

  const handleCancelPendingOrder = useCallback((orderId: string) => {
    if (!tradingEngineRef.current || !engineRef.current) return;
    const curCursor = engineRef.current.getCursor();
    tradingEngineRef.current.cancelPendingOrder(orderId, curCursor);
  }, []);

  const handleSaveProtection = useCallback((positionId: string, sl?: number, tp?: number) => {
    if (!tradingEngineRef.current || !engineRef.current) return { success: false, error: 'Engine unavailable' };
    const curCursor = engineRef.current.getCursor();
    return tradingEngineRef.current.modifyPositionProtection(positionId, curCursor, sl, tp);
  }, []);

  const handlePartialClose = useCallback((positionId: string, quantity: number) => {
    if (!tradingEngineRef.current || !engineRef.current) return { success: false, error: 'Engine unavailable' };
    const curPrice = getCurrentPrice();
    const curCursor = engineRef.current.getCursor();
    return tradingEngineRef.current.closePosition(positionId, curPrice, curCursor, quantity);
  }, [getCurrentPrice]);

  const handleConfirmResetAccount = useCallback((initBal: number, lev: number) => {
    if (!tradingEngineRef.current || !engineRef.current) return;
    const curCursor = engineRef.current.getCursor();
    tradingEngineRef.current.resetAccount(initBal, lev, curCursor);
    if (chartAdapterRef.current) {
      chartAdapterRef.current.updateTradeOverlays([], []);
    }
  }, []);

  const handleImportTradingState = useCallback((newState: TradingState) => {
    if (!session || !tradingEngineRef.current) return;
    TradingPersistence.saveTradingState(session.id, newState);
    setTradingState(newState);
    if (chartAdapterRef.current) {
      chartAdapterRef.current.updateTradeOverlays(newState.positions, newState.pendingOrders);
    }
  }, [session]);

  const currentPrice = getCurrentPrice();

  return (
    <div className="replay-workspace">
      {/* 1. Header Bar */}
      <header className="replay-header">
        <div className="replay-header__left">
          <Link to="/backtest" className="replay-header__back-btn" title="Back to Setup">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
              <path d="M19 12H5M12 19l-7-7 7-7" />
            </svg>
            <span>Setup</span>
          </Link>

          {session && (
            <div className="replay-header__symbol-badge">
              <span className="replay-header__provider-tag">{session.provider}</span>
              <span className="replay-header__symbol-name">{session.providerSymbol}</span>
            </div>
          )}

          {/* Timeframe Switcher */}
          <div className="replay-timeframe-selector" role="group" aria-label="Timeframe Selection">
            {TIMEFRAMES.map((tf) => (
              <button
                key={tf}
                type="button"
                className={`replay-timeframe-btn ${currentTimeframe === tf ? 'replay-timeframe-btn--active' : ''}`}
                onClick={() => handleTimeframeChange(tf)}
              >
                {tf}
              </button>
            ))}
          </div>
        </div>

        <div className="replay-header__right">
          {/* Analytics Dashboard Button */}
          <Link
            to={`/backtest/analytics/${session?.id || ''}`}
            className="replay-header__analytics-btn"
            title="Open Performance Analytics Dashboard"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
              <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
            </svg>
            Analytics
          </Link>

          {/* Status Pill */}
          <span className={`replay-status-pill replay-status-pill--${engineState.toLowerCase()}`}>
            <span
              className={`replay-status-indicator-dot ${
                engineState === 'PLAYING' ? 'replay-status-indicator-dot--pulse' : ''
              }`}
            />
            {engineState}
          </span>

          {/* Current Simulation Clock */}
          <div className="replay-header__utc-clock" title="Current Replay Simulation Clock">
            {formatUtc(cursor)}
          </div>
        </div>
      </header>

      {/* 2. Account Summary Bar */}
      {tradingState && (
        <AccountSummaryBar
          account={tradingState.account}
          sessionId={session?.id}
          onResetClick={() => setIsResetModalOpen(true)}
          onExportImportClick={() => setIsExportImportModalOpen(true)}
        />
      )}

      {/* 3. Center Replay Body (Chart + Order Entry Panel) */}
      <div className="replay-workspace-body">
        {/* Chart Area */}
        <main className="replay-chart-area">
          {/* Floating OHLCV Legend */}
          {currentLegend && (
            <div className="replay-chart-legend" aria-live="off">
              <span className="replay-chart-legend__symbol">{session?.providerSymbol || ''}</span>
              <span className="replay-chart-legend__item">
                O: <strong className="replay-chart-legend__value">{formatPrice(currentLegend.open)}</strong>
              </span>
              <span className="replay-chart-legend__item">
                H: <strong className="replay-chart-legend__value">{formatPrice(currentLegend.high)}</strong>
              </span>
              <span className="replay-chart-legend__item">
                L: <strong className="replay-chart-legend__value">{formatPrice(currentLegend.low)}</strong>
              </span>
              <span className="replay-chart-legend__item">
                C:{' '}
                <strong
                  className={`replay-chart-legend__value ${
                    currentLegend.close >= currentLegend.open
                      ? 'replay-chart-legend__value--up'
                      : 'replay-chart-legend__value--down'
                  }`}
                >
                  {formatPrice(currentLegend.close)}
                </strong>
              </span>
              {currentLegend.volume !== undefined && currentLegend.volume !== null && (
                <span className="replay-chart-legend__item">
                  Vol: <span className="replay-chart-legend__value">{formatPrice(currentLegend.volume)}</span>
                </span>
              )}
              {currentLegend.changePct !== undefined && (
                <span
                  className={`replay-chart-legend__value ${
                    currentLegend.changePct >= 0
                      ? 'replay-chart-legend__value--up'
                      : 'replay-chart-legend__value--down'
                  }`}
                >
                  ({currentLegend.changePct >= 0 ? '+' : ''}
                  {currentLegend.changePct.toFixed(2)}%)
                </span>
              )}
            </div>
          )}

          {/* Loading overlay */}
          {isLoading && (
            <div className="replay-loading-screen">
              <div className="replay-spinner" />
              <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                Loading genuine M1 historical data and reconstructing {currentTimeframe} timeline...
              </p>
            </div>
          )}

          {/* Error overlay */}
          {errorMessage && (
            <div className="replay-error-screen">
              <h3 style={{ color: '#f87171' }}>Historical Replay Initialization Error</h3>
              <p style={{ color: 'var(--text-secondary)', maxWidth: 500 }}>{errorMessage}</p>
              <Link to="/backtest" className="btn btn--primary btn--sm" style={{ marginTop: 12 }}>
                Return to Backtest Setup
              </Link>
            </div>
          )}

          {/* Lightweight Charts Canvas Element */}
          <div ref={chartContainerRef} className="replay-chart-mount" />
        </main>

        {/* Order Entry Panel (Right Sidebar) */}
        {tradingEngineRef.current && tradingState && (
          <OrderEntryPanel
            specification={tradingEngineRef.current.getSpecification()}
            account={tradingState.account}
            currentPrice={currentPrice}
            executionAssumptions={tradingState.executionAssumptions}
            onSubmitOrder={handleOrderSubmit}
          />
        )}
      </div>

      {/* 4. Replay Control Bar */}
      <footer className="replay-control-bar">
        {/* Progress & Scrub Row */}
        <div className="replay-scrub-row">
          <input
            type="range"
            min="0"
            max="100"
            step="0.1"
            value={progressPct}
            onChange={handleScrubChange}
            className="replay-scrub-slider"
            aria-label="Timeline Scrub Slider"
            disabled={isLoading || engineState === 'ERROR'}
          />
          <div className="replay-scrub-info">
            <span className="replay-scrub-pct">{progressPct.toFixed(1)}%</span>
            <span>
              {session ? `${formatUtc(session.startTimestamp)} — ${formatUtc(session.endTimestamp)}` : ''}
            </span>
            <button
              type="button"
              className="btn-action-sm"
              style={{ marginLeft: 8 }}
              onClick={() => setIsBottomPanelCollapsed(!isBottomPanelCollapsed)}
              title="Toggle Trading Tabs Panel"
            >
              {isBottomPanelCollapsed ? 'Show Trades ▲' : 'Hide Trades ▼'}
            </button>
          </div>
        </div>

        {/* Controls Main Row */}
        <div className="replay-buttons-row">
          <div className="replay-main-buttons">
            {/* Reset */}
            <button
              type="button"
              className="replay-btn"
              onClick={handleResetReplay}
              disabled={isLoading || cursor <= (session?.startTimestamp || 0)}
              title="Reset Replay Timeline to Start"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                <path d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
              </svg>
              <span>Reset</span>
            </button>

            {/* Step Backward */}
            <button
              type="button"
              className="replay-btn"
              onClick={handleStepBackward}
              disabled={isLoading || cursor <= (session?.startTimestamp || 0) || engineState === 'PLAYING'}
              title="Step Backward 1 Candle (Left Arrow)"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                <path d="M19 20L9 12l10-8v16zM5 19V5" />
              </svg>
              <span>Prev</span>
            </button>

            {/* Play / Pause Toggle */}
            {engineState === 'PLAYING' ? (
              <button
                type="button"
                className="replay-btn replay-btn--pause"
                onClick={handlePause}
                title="Pause Replay (Spacebar)"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                  <rect x="6" y="4" width="4" height="16" rx="1" />
                  <rect x="14" y="4" width="4" height="16" rx="1" />
                </svg>
                <span>Pause</span>
              </button>
            ) : (
              <button
                type="button"
                className="replay-btn replay-btn--play"
                onClick={handlePlay}
                disabled={isLoading || engineState === 'COMPLETED' || engineState === 'DATA_GAP'}
                title="Play Replay (Spacebar)"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M5 3l14 9-14 9V3z" />
                </svg>
                <span>Play</span>
              </button>
            )}

            {/* Step Forward */}
            <button
              type="button"
              className="replay-btn"
              onClick={handleStepForward}
              disabled={isLoading || engineState === 'COMPLETED' || engineState === 'DATA_GAP'}
              title="Step Forward 1 Candle (Right Arrow)"
            >
              <span>Next</span>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                <path d="M5 4l10 8-10 8V4zM19 5v14" />
              </svg>
            </button>
          </div>

          {/* Speed Control Group */}
          <div className="replay-speed-group" role="group" aria-label="Replay Speed Selection">
            <span className="replay-speed-label">Speed:</span>
            {SPEEDS.map((sp) => (
              <button
                key={sp}
                type="button"
                className={`replay-speed-btn ${currentSpeed === sp ? 'replay-speed-btn--active' : ''}`}
                onClick={() => handleSpeedChange(sp)}
              >
                {sp}x
              </button>
            ))}
          </div>

          {/* Keyboard Shortcut Hint */}
          <div className="replay-shortcut-hint">
            <span className="replay-shortcut-key">Space</span> Play/Pause &bull;
            <span className="replay-shortcut-key">&larr;</span> Prev &bull;
            <span className="replay-shortcut-key">&rarr;</span> Next
          </div>
        </div>
      </footer>

      {/* 5. Bottom Trading Panel */}
      {!isBottomPanelCollapsed && tradingState && (
        <BottomTradingPanel
          positions={tradingState.positions}
          pendingOrders={tradingState.pendingOrders}
          completedOrders={tradingState.completedOrders}
          tradeRecords={tradingState.tradeRecords}
          events={tradingState.events}
          onOpenModifyModal={(pos) => setModifyingPosition(pos)}
          onClosePosition={handleClosePosition}
          onCancelPendingOrder={handleCancelPendingOrder}
        />
      )}

      {/* 6. Modals */}
      {/* Modify Position Modal */}
      {modifyingPosition && tradingEngineRef.current && (
        <PositionModifyModal
          position={modifyingPosition}
          specification={tradingEngineRef.current.getSpecification()}
          onClose={() => setModifyingPosition(null)}
          onSaveProtection={handleSaveProtection}
          onPartialClose={handlePartialClose}
        />
      )}

      {/* Account Reset Modal */}
      {tradingState && (
        <AccountResetModal
          isOpen={isResetModalOpen}
          currentBalance={tradingState.account.initialBalance}
          currentLeverage={tradingState.account.leverage}
          onClose={() => setIsResetModalOpen(false)}
          onConfirmReset={handleConfirmResetAccount}
        />
      )}

      {/* Export / Import Modal */}
      {session && tradingState && (
        <ExportImportModal
          isOpen={isExportImportModalOpen}
          sessionId={session.id}
          tradingState={tradingState}
          onClose={() => setIsExportImportModalOpen(false)}
          onImportState={handleImportTradingState}
        />
      )}

      {/* Data Gap Modal */}
      {dataGap && (
        <div className="replay-modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="gap-title">
          <div className="replay-gap-card">
            <div className="replay-gap-header">
              <svg
                className="replay-gap-icon"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                <line x1="12" y1="9" x2="12" y2="13" />
                <line x1="12" y1="17" x2="12.01" y2="17" />
              </svg>
              <h2 id="gap-title" className="replay-gap-title">
                Historical Market Data Gap Detected
              </h2>
            </div>
            <p className="replay-gap-desc">
              A trading gap was detected in the verified provider records. The replay engine automatically paused to
              preserve temporal accuracy.
            </p>
            <div className="replay-gap-details">
              <div>
                <strong>Gap Start:</strong> {formatUtc(dataGap.start)}
              </div>
              <div>
                <strong>Gap End:</strong> {formatUtc(dataGap.end)}
              </div>
              <div>
                <strong>Missing Duration:</strong> {dataGap.missingMinutes} minutes
              </div>
            </div>
            <div className="replay-gap-actions">
              <button type="button" className="btn btn--secondary btn--sm" onClick={() => setDataGap(null)}>
                Keep Paused
              </button>
              <button type="button" className="btn btn--primary btn--sm" onClick={handleContinueAcrossGap}>
                Continue Across Gap
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ReplayWorkspacePage;
