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
import { ChartDrawingOverlay } from '../components/replay/ChartDrawingOverlay';
import { CANONICAL_CATALOG_INSTRUMENTS } from '../data/canonicalCatalog';
import { TradingEngine } from '../services/trading/TradingEngine';
import {
  CreateOrderRequest,
  Position,
  TradingState,
} from '../services/trading/TradingTypes';
import { TradingPersistence } from '../services/trading/TradingPersistence';
import { AccountSummaryBar } from '../components/trading/AccountSummaryBar';
import {
  ChartPickTarget,
  ExternalOrderPreset,
  OrderEntryPanel,
} from '../components/trading/OrderEntryPanel';
import { BottomTradingPanel } from '../components/trading/BottomTradingPanel';
import { PositionModifyModal } from '../components/trading/PositionModifyModal';
import { AccountResetModal } from '../components/trading/AccountResetModal';
import { ExportImportModal } from '../components/trading/ExportImportModal';
import { detectTradingSession } from '../components/analytics/TradeExecutionReviewModal';
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

  // Enhanced Chart & Pro Backtest States
  const [showEma, setShowEma] = useState<boolean>(true);
  const [chartTheme, setChartTheme] = useState<'dark' | 'light'>('dark');
  const [chartViewMode, setChartViewMode] = useState<'REPLAY' | 'LIVE_TV'>('REPLAY');
  const [fromDateInput, setFromDateInput] = useState<string>('2025-01-14');
  const [toDateInput, setToDateInput] = useState<string>('2025-01-17');
  const [chartPickTarget, setChartPickTarget] = useState<ChartPickTarget>('NONE');
  const [pickedChartPrice, setPickedChartPrice] = useState<{
    target: ChartPickTarget;
    price: number;
    ts: number;
  } | null>(null);
  const [externalPreset, setExternalPreset] = useState<ExternalOrderPreset | null>(null);

  // Phase 4 Trading States
  const [tradingState, setTradingState] = useState<TradingState | null>(null);
  const [modifyingPosition, setModifyingPosition] = useState<Position | null>(null);
  const [isResetModalOpen, setIsResetModalOpen] = useState<boolean>(false);
  const [isExportImportModalOpen, setIsExportImportModalOpen] = useState<boolean>(false);
  const [isBottomPanelCollapsed, setIsBottomPanelCollapsed] = useState<boolean>(false);

  const toDateStrUtc = (ts: number): string => {
    const d = new Date(ts);
    const yyyy = d.getUTCFullYear();
    const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
    const dd = String(d.getUTCDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  };

  const formatUtc = (ts: number): string => {
    if (!ts || isNaN(ts)) return '--';
    const d = new Date(ts);
    return d.toISOString().replace('T', ' ').replace('.000Z', ' UTC');
  };

  const formatPrice = (p: number | undefined): string => {
    if (p === undefined || isNaN(p)) return '-';
    const maxDec = p > 0 && p < 10 ? 5 : p < 200 ? 3 : 2;
    return p.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: maxDec });
  };

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

        if (sessionId) {
          activeSession = await ReplayPersistence.getSession(sessionId);
        }

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

        if (!activeSession) {
          const all = await ReplayPersistence.getAllSessions();
          if (all.length > 0) {
            activeSession = all[0];
          }
        }

        if (!activeSession) {
          const defaultStart = Date.parse('2025-01-14T00:00:00Z');
          const defaultEnd = Date.parse('2025-01-17T23:59:00Z');

          activeSession = {
            id: 'session_default_btc',
            provider: 'DUKASCOPY',
            instrumentId: 'DUKASCOPY:XAUUSD',
            providerSymbol: 'XAUUSD',
            displayName: 'XAU / USD (Gold / US Dollar)',
            marketCategory: 'metals',
            timeframe: 'M15',
            startTimestamp: defaultStart,
            endTimestamp: defaultEnd,
            cursor: defaultStart,
            speed: 1,
            status: 'PAUSED',
            skippedGaps: [],
            createdAt: Date.now(),
            updatedAt: Date.now(),
            version: 1,
          };
          await ReplayPersistence.saveSession(activeSession);
        }

        // Normalize legacy sessions that were auto-seeded with the 2026-11-09 system clock
        if (activeSession.startTimestamp > 1790000000000) {
          const normStart = Date.parse('2025-01-14T00:00:00Z');
          const normEnd = Date.parse('2025-01-17T23:59:00Z');
          activeSession = {
            ...activeSession,
            startTimestamp: normStart,
            endTimestamp: normEnd,
            cursor: normStart,
          };
          await ReplayPersistence.saveSession(activeSession);
        }

        if (isCancelled) return;

        setSession(activeSession);
        setFromDateInput(toDateStrUtc(activeSession.startTimestamp));
        setToDateInput(toDateStrUtc(activeSession.endTimestamp));
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

    const adapter = new ReplayChartAdapter();
    adapter.initialize(chartContainerRef.current, (legend) => {
      setCurrentLegend(legend);
    });
    adapter.setTheme(chartTheme);
    chartAdapterRef.current = adapter;

    const engine = new ReplayEngine(session);
    engineRef.current = engine;

    // Immediately initialize TradingEngine synchronously from canonical catalog so OrderEntryPanel is always visible
    const fallbackInst =
      CANONICAL_CATALOG_INSTRUMENTS.find((i) => i.id === session.instrumentId) ||
      CANONICAL_CATALOG_INSTRUMENTS.find((i) => i.providerSymbol === session.providerSymbol) ||
      CANONICAL_CATALOG_INSTRUMENTS[0];

    const initialTradingEngine = new TradingEngine(session.id, fallbackInst);
    tradingEngineRef.current = initialTradingEngine;
    setTradingState(initialTradingEngine.getState());

    initialTradingEngine.on('stateChange', (st) => {
      setTradingState({ ...st });
      adapter.updateTradeOverlays(st.positions, st.pendingOrders);
    });

    engine.on('m1Candle', (m1) => {
      tradingEngineRef.current?.onTick(m1);
    });

    // Restore persisted trading state if available
    TradingPersistence.getTradingState(session.id)
      .then((savedState) => {
        if (isDisposed || !savedState) return;
        const restoredEngine = new TradingEngine(session.id, fallbackInst, savedState);
        tradingEngineRef.current = restoredEngine;
        setTradingState(restoredEngine.getState());
        restoredEngine.on('stateChange', (st) => {
          setTradingState({ ...st });
          adapter.updateTradeOverlays(st.positions, st.pendingOrders);
        });
        adapter.updateTradeOverlays(restoredEngine.getPositions(), restoredEngine.getPendingOrders());
      })
      .catch(() => {});

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

  // Wire chart click-to-pick price handler
  useEffect(() => {
    if (!chartAdapterRef.current) return;
    if (chartPickTarget === 'NONE') {
      chartAdapterRef.current.setOnPriceClick(undefined);
    } else {
      chartAdapterRef.current.setOnPriceClick((price) => {
        setPickedChartPrice({ target: chartPickTarget, price, ts: Date.now() });
        setChartPickTarget('NONE');
      });
    }
  }, [chartPickTarget]);

  // Keyboard shortcut handler
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        e.target instanceof HTMLSelectElement
      ) {
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

  const handleToggleEma = useCallback(() => {
    setShowEma((prev) => {
      const next = !prev;
      chartAdapterRef.current?.setEmaVisible(next);
      return next;
    });
  }, []);

  const handleToggleChartTheme = useCallback(() => {
    setChartTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
  }, []);

  useEffect(() => {
    chartAdapterRef.current?.setTheme(chartTheme);
  }, [chartTheme]);

  // FX Replay style "Go-To Next Session" (Jumps to London 07:00, NY 13:00, or Tokyo 00:00 UTC)
  const handleSkipToNextSession = useCallback(async () => {
    const engine = engineRef.current;
    if (!engine) return;
    if (engine.getState() === 'PLAYING') engine.pause();

    const sessionHours = [0, 7, 13];
    const startCur = engine.getCursor();
    const curHour = new Date(startCur).getUTCHours();
    let targetHour = sessionHours.find((h) => h > curHour) ?? 0;

    let steps = 0;
    while (steps < 360) {
      const advanced = await engine.stepForward();
      if (!advanced) break;
      steps++;
      const d = new Date(engine.getCursor());
      if (d.getUTCHours() === targetHour && d.getUTCMinutes() === 0) {
        break;
      }
    }
    if (chartAdapterRef.current) {
      chartAdapterRef.current.setCandles(engine.getCurrentBars());
    }
  }, []);

  // FX Replay style "Skip to Trade Exit (SL/TP Hit)"
  const handleSkipToTradeExit = useCallback(async () => {
    const engine = engineRef.current;
    const tEngine = tradingEngineRef.current;
    if (!engine || !tEngine) return;
    if (engine.getState() === 'PLAYING') engine.pause();

    const initialOpenCount = tEngine.getPositions().length;
    if (initialOpenCount === 0) return;

    let steps = 0;
    while (steps < 240) {
      const advanced = await engine.stepForward();
      if (!advanced) break;
      steps++;
      if (tEngine.getPositions().length < initialOpenCount) {
        break;
      }
    }
    if (chartAdapterRef.current) {
      chartAdapterRef.current.setCandles(engine.getCurrentBars());
    }
  }, []);

  const handleContinueAcrossGap = useCallback(() => {
    engineRef.current?.continueAcrossGap();
    setDataGap(null);
  }, []);

  const handleScrubChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (!session || !engineRef.current) return;
      const pct = Number(e.target.value);
      const range = session.endTimestamp - session.startTimestamp;
      const targetMs = session.startTimestamp + (range * pct) / 100;
      engineRef.current.seek(targetMs);
      if (chartAdapterRef.current) {
        chartAdapterRef.current.setCandles(engineRef.current.getCurrentBars());
      }
    },
    [session]
  );

  // UI Actions: Trading Actions
  const handleOrderSubmit = useCallback(
    (req: CreateOrderRequest): { success: boolean; error?: string } => {
      if (!tradingEngineRef.current || !engineRef.current) {
        return { success: false, error: 'Trading Engine not ready.' };
      }
      const curPrice = getCurrentPrice();
      const curCursor = engineRef.current.getCursor();
      return tradingEngineRef.current.placeOrder(req, curPrice, curCursor);
    },
    [getCurrentPrice]
  );

  const handleClosePosition = useCallback(
    (positionId: string) => {
      if (!tradingEngineRef.current || !engineRef.current) return;
      const curPrice = getCurrentPrice();
      const curCursor = engineRef.current.getCursor();
      tradingEngineRef.current.closePosition(positionId, curPrice, curCursor);
    },
    [getCurrentPrice]
  );

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

  // 1-Click Move SL to Break-Even (Entry Price)
  const handleMoveToBreakEven = useCallback((pos: Position) => {
    if (!tradingEngineRef.current || !engineRef.current) return;
    const curCursor = engineRef.current.getCursor();
    tradingEngineRef.current.modifyPositionProtection(pos.id, curCursor, pos.entryPrice, pos.takeProfit);
  }, []);

  // 1-Click Quick Partial Close (e.g. 50%)
  const handleQuickPartialClose = useCallback(
    (pos: Position, fraction: number) => {
      if (!tradingEngineRef.current || !engineRef.current) return;
      const spec = tradingEngineRef.current.getSpecification();
      const step = spec.quantityStep || 0.01;
      const closeQty = Math.max(
        spec.minQuantity,
        Number((Math.floor((pos.quantity * fraction) / step) * step).toFixed(spec.volumePrecision))
      );
      const curPrice = getCurrentPrice();
      const curCursor = engineRef.current.getCursor();
      tradingEngineRef.current.closePosition(pos.id, curPrice, curCursor, closeQty);
    },
    [getCurrentPrice]
  );

  const handlePartialClose = useCallback(
    (positionId: string, quantity: number) => {
      if (!tradingEngineRef.current || !engineRef.current) return { success: false, error: 'Engine unavailable' };
      const curPrice = getCurrentPrice();
      const curCursor = engineRef.current.getCursor();
      return tradingEngineRef.current.closePosition(positionId, curPrice, curCursor, quantity);
    },
    [getCurrentPrice]
  );

  const handleConfirmResetAccount = useCallback((initBal: number, lev: number) => {
    if (!tradingEngineRef.current || !engineRef.current) return;
    const curCursor = engineRef.current.getCursor();
    tradingEngineRef.current.resetAccount(initBal, lev, curCursor);
    if (chartAdapterRef.current) {
      chartAdapterRef.current.updateTradeOverlays([], []);
    }
  }, []);

  const handleImportTradingState = useCallback(
    (newState: TradingState) => {
      if (!session || !tradingEngineRef.current) return;
      TradingPersistence.saveTradingState(session.id, newState);
      setTradingState(newState);
      if (chartAdapterRef.current) {
        chartAdapterRef.current.updateTradeOverlays(newState.positions, newState.pendingOrders);
      }
    },
    [session]
  );

  const handleApplyDateRange = useCallback(
    async (e?: React.FormEvent, overrideFrom?: string, overrideTo?: string) => {
      if (e) e.preventDefault();
      if (!session) return;

      const fStr = overrideFrom || fromDateInput;
      const tStr = overrideTo || toDateInput;
      const parsedStart = Date.parse(`${fStr}T00:00:00Z`);
      const parsedEnd = Date.parse(`${tStr}T23:59:00Z`);

      if (isNaN(parsedStart)) return;
      const validEnd = !isNaN(parsedEnd) && parsedEnd > parsedStart ? parsedEnd : parsedStart + 3 * 86400000;

      const updatedSession: ReplaySession = {
        ...session,
        timeframe: currentTimeframe,
        startTimestamp: parsedStart,
        endTimestamp: validEnd,
        cursor: parsedStart,
        status: 'PAUSED',
        updatedAt: Date.now(),
      };

      setIsLoading(true);
      setErrorMessage(null);
      await ReplayPersistence.saveSession(updatedSession);
      setSession(updatedSession);
    },
    [session, fromDateInput, toDateInput, currentTimeframe]
  );

  const handleQuickSymbolChange = useCallback(
    async (newInstrumentId: string) => {
      if (!session) return;
      const inst = CANONICAL_CATALOG_INSTRUMENTS.find((i) => i.id === newInstrumentId);
      if (!inst) return;

      const updatedSession: ReplaySession = {
        ...session,
        provider: inst.provider,
        instrumentId: inst.id,
        providerSymbol: inst.providerSymbol,
        displayName: inst.displayName,
        marketCategory: inst.marketCategory,
        timeframe: currentTimeframe,
        cursor: session.startTimestamp,
        status: 'PAUSED',
        updatedAt: Date.now(),
      };

      setIsLoading(true);
      setErrorMessage(null);
      await ReplayPersistence.saveSession(updatedSession);
      setSession(updatedSession);
    },
    [session, currentTimeframe]
  );

  const currentPrice = getCurrentPrice();
  const activeSessionLabel = cursor ? detectTradingSession(cursor) : 'London';
  const tvWidgetSymbol =
    session?.provider === 'BINANCE'
      ? `BINANCE:${session.providerSymbol}`
      : `OANDA:${session?.providerSymbol || 'XAUUSD'}`;

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
            <div className="replay-header__symbol-badge" title="Switch Instrument / Pair">
              <span className="replay-header__provider-tag">{session.provider}</span>
              <select
                className="replay-symbol-select"
                value={session.instrumentId}
                onChange={(e) => handleQuickSymbolChange(e.target.value)}
                aria-label="Select Trading Pair"
              >
                {CANONICAL_CATALOG_INSTRUMENTS.map((inst) => (
                  <option key={inst.id} value={inst.id}>
                    {inst.providerSymbol} ({inst.marketCategory.toUpperCase()})
                  </option>
                ))}
              </select>
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

          {/* Inline Historical Date Range Bar (From Date -> To Date + Enter) */}
          <form className="replay-date-range-bar" onSubmit={(e) => handleApplyDateRange(e)}>
            <span className="replay-date-range-label">📅 Date:</span>
            <label className="replay-date-input-group">
              <span>From</span>
              <input
                type="date"
                className="replay-date-input"
                value={fromDateInput}
                onChange={(e) => setFromDateInput(e.target.value)}
                title="Backtest Start Date (UTC)"
              />
            </label>
            <span style={{ color: 'var(--text-dim)' }}>&rarr;</span>
            <label className="replay-date-input-group">
              <span>To</span>
              <input
                type="date"
                className="replay-date-input"
                value={toDateInput}
                min={fromDateInput}
                onChange={(e) => setToDateInput(e.target.value)}
                title="Backtest End Date (UTC)"
              />
            </label>
            <button
              type="submit"
              className="replay-date-go-btn"
              title="Load Real Historical Market Data for Selected Dates (Enter)"
            >
              Load &crarr;
            </button>
          </form>

          {/* Indicator, Chart Theme & Live Mode Switcher */}
          <button
            type="button"
            className={`replay-timeframe-btn ${showEma ? 'replay-timeframe-btn--active' : ''}`}
            onClick={handleToggleEma}
            title="Toggle EMA 20 & EMA 50 Indicators"
          >
            EMA 20/50
          </button>

          <button
            type="button"
            className={`replay-timeframe-btn ${chartTheme === 'light' ? 'replay-timeframe-btn--active' : ''}`}
            onClick={handleToggleChartTheme}
            aria-pressed={chartTheme === 'light'}
            data-testid="chart-theme-toggle"
            title="Switch between Ocean Dark and Traders Casa Light Chart Theme"
          >
            {chartTheme === 'light' ? '☀ Casa Light' : '🌙 Ocean Dark'}
          </button>

          <button
            type="button"
            className={`replay-timeframe-btn ${chartViewMode === 'LIVE_TV' ? 'replay-timeframe-btn--active' : ''}`}
            onClick={() => setChartViewMode(chartViewMode === 'REPLAY' ? 'LIVE_TV' : 'REPLAY')}
            title="Switch between Replay Backtest Engine and Live TradingView Chart"
          >
            {chartViewMode === 'REPLAY' ? '📺 Live TV Chart' : '⏪ Back to Replay'}
          </button>
        </div>

        <div className="replay-header__right">
          {/* Active Market Session Pill */}
          <span
            className="replay-status-pill"
            style={{
              background: 'rgba(56, 189, 248, 0.12)',
              color: '#38bdf8',
              border: '1px solid rgba(56, 189, 248, 0.3)',
            }}
            title="Active Forex/Market Session at Replay Timestamp"
          >
            🌐 {activeSessionLabel}
          </span>

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
        <main
          className="replay-chart-area"
          data-chart-theme={chartTheme}
          style={{ backgroundColor: chartTheme === 'light' ? '#F9F9F9' : '#05141F' }}
        >
          {/* Chart Pick Mode Banner */}
          {chartPickTarget !== 'NONE' && (
            <div className="replay-draw-banner" style={{ left: 160 }}>
              <span>
                🎯 Click anywhere on the chart to set <strong>{chartPickTarget}</strong> price
              </span>
              <button type="button" onClick={() => setChartPickTarget('NONE')}>
                Cancel
              </button>
            </div>
          )}

          {/* Floating OHLCV + EMA Legend */}
          {chartViewMode === 'REPLAY' && currentLegend && (
            <div className="replay-chart-legend" style={{ left: 52 }} aria-live="off">
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
              {showEma && currentLegend.ema20 && (
                <span className="replay-chart-legend__item" style={{ color: '#38bdf8' }}>
                  EMA20: <strong>{formatPrice(currentLegend.ema20)}</strong>
                </span>
              )}
              {showEma && currentLegend.ema50 && (
                <span className="replay-chart-legend__item" style={{ color: '#f59e0b' }}>
                  EMA50: <strong>{formatPrice(currentLegend.ema50)}</strong>
                </span>
              )}
            </div>
          )}

          {/* Interactive Drawing Toolbar + SVG Overlay (FX Replay / TradeZella style) */}
          {chartViewMode === 'REPLAY' && session && (
            <ChartDrawingOverlay
              sessionId={session.id}
              adapter={chartAdapterRef.current}
              currentTimeSec={Math.floor(cursor / 1000)}
              currentPrice={currentPrice}
              onApplyPositionTool={(preset) =>
                setExternalPreset({
                  ...preset,
                  timestamp: Date.now(),
                })
              }
            />
          )}

          {/* Live TradingView Embed Mode (SNRBD APK style live chart option) */}
          {chartViewMode === 'LIVE_TV' && (
            <iframe
              title="TradingView Live Chart"
              src={`https://s.tradingview.com/widgetembed/?symbol=${encodeURIComponent(
                tvWidgetSymbol
              )}&interval=15&theme=dark&style=1&timezone=Etc%2FUTC&withdateranges=1&hide_side_toolbar=0&allow_symbol_change=1`}
              style={{
                position: 'absolute',
                inset: 0,
                width: '100%',
                height: '100%',
                border: 'none',
                zIndex: 15,
                background: '#05141F',
              }}
            />
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
          <div
            ref={chartContainerRef}
            className="replay-chart-mount"
            style={{ visibility: chartViewMode === 'REPLAY' ? 'visible' : 'hidden' }}
          />
        </main>

        {/* Smart Order Entry Panel (Right Sidebar) */}
        {tradingEngineRef.current && tradingState && (
          <OrderEntryPanel
            specification={tradingEngineRef.current.getSpecification()}
            account={tradingState.account}
            currentPrice={currentPrice}
            executionAssumptions={tradingState.executionAssumptions}
            onSubmitOrder={handleOrderSubmit}
            chartPickTarget={chartPickTarget}
            onRequestChartPick={setChartPickTarget}
            pickedChartPrice={pickedChartPrice}
            externalPreset={externalPreset}
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

            {/* FX Replay Go-To Next Session Button */}
            <button
              type="button"
              className="replay-btn"
              onClick={handleSkipToNextSession}
              disabled={isLoading || engineState === 'COMPLETED'}
              title="FX Replay Go-To: Fast-forward to next Market Session Open (London / NY / Asian)"
            >
              <span>⚡ Next Session</span>
            </button>

            {/* FX Replay Skip to SL/TP Exit Button */}
            {tradingState && tradingState.positions.length > 0 && (
              <button
                type="button"
                className="replay-btn"
                style={{ borderColor: '#38bdf8', color: '#38bdf8' }}
                onClick={handleSkipToTradeExit}
                title="Fast-forward until an open position hits SL or TP"
              >
                <span>🎯 Skip to SL/TP</span>
              </button>
            )}
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
          onMoveToBreakEven={handleMoveToBreakEven}
          onQuickPartialClose={handleQuickPartialClose}
        />
      )}

      {/* 6. Modals */}
      {modifyingPosition && tradingEngineRef.current && (
        <PositionModifyModal
          position={modifyingPosition}
          specification={tradingEngineRef.current.getSpecification()}
          onClose={() => setModifyingPosition(null)}
          onSaveProtection={handleSaveProtection}
          onPartialClose={handlePartialClose}
        />
      )}

      {tradingState && (
        <AccountResetModal
          isOpen={isResetModalOpen}
          currentBalance={tradingState.account.initialBalance}
          currentLeverage={tradingState.account.leverage}
          onClose={() => setIsResetModalOpen(false)}
          onConfirmReset={handleConfirmResetAccount}
        />
      )}

      {session && tradingState && (
        <ExportImportModal
          isOpen={isExportImportModalOpen}
          sessionId={session.id}
          tradingState={tradingState}
          onClose={() => setIsExportImportModalOpen(false)}
          onImportState={handleImportTradingState}
        />
      )}

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
