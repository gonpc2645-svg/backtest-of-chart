import React, { useEffect, useState, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { AnalyticsHeader } from '../components/analytics/AnalyticsHeader';
import { LongShortBreakdownSection } from '../components/analytics/LongShortBreakdownSection';
import { PerformanceChartsSection } from '../components/analytics/PerformanceChartsSection';
import { PerformanceOverviewCards } from '../components/analytics/PerformanceOverviewCards';
import { PeriodicPerformanceSection } from '../components/analytics/PeriodicPerformanceSection';
import { TradeDistributionChart } from '../components/analytics/TradeDistributionChart';
import { TradeHistoryTable } from '../components/analytics/TradeHistoryTable';
import { WinLossStreaksSection } from '../components/analytics/WinLossStreaksSection';
import { SessionAndCalendarAnalyticsSection } from '../components/analytics/SessionAndCalendarAnalyticsSection';
import { AnalyticsEngine } from '../services/analytics/AnalyticsEngine';
import { AnalyticsPersistence } from '../services/analytics/AnalyticsPersistence';
import { SessionAnalyticsReport } from '../services/analytics/AnalyticsTypes';
import { ReplayPersistence } from '../services/replay/ReplayPersistence';
import { ReplaySession } from '../services/replay/types';
import { TradingPersistence } from '../services/trading/TradingPersistence';
import '../styles/analytics.css';

export const AnalyticsPage: React.FC = () => {
  const { sessionId: paramSessionId } = useParams<{ sessionId?: string }>();
  const [report, setReport] = useState<SessionAnalyticsReport | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const loadAnalytics = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage(null);

    try {
      let activeSession: ReplaySession | null = null;

      if (paramSessionId) {
        activeSession = await ReplayPersistence.getSession(paramSessionId);
      }

      if (!activeSession) {
        const allSessions = await ReplayPersistence.getAllSessions();
        if (allSessions.length > 0) {
          activeSession = allSessions[0];
        }
      }

      if (!activeSession) {
        // Fallback default demo session
        activeSession = {
          id: 'session_default_btc',
          provider: 'BINANCE',
          instrumentId: 'BINANCE:BTCUSDT',
          providerSymbol: 'BTCUSDT',
          displayName: 'Bitcoin / Tether USD Spot',
          marketCategory: 'crypto',
          timeframe: 'M15',
          startTimestamp: 1793987040000,
          endTimestamp: 1794100980000,
          cursor: 1794050000000,
          speed: 1,
          status: 'PAUSED',
          skippedGaps: [],
          createdAt: Date.now(),
          updatedAt: Date.now(),
          version: 1,
        };
      }

      // Load Trading State for this session
      let tradingState = await TradingPersistence.getTradingState(activeSession.id);

      if (!tradingState) {
        // Clean default trading state if none recorded yet
        tradingState = {
          account: {
            currency: 'USD',
            initialBalance: 10000,
            balance: 10000,
            equity: 10000,
            usedMargin: 0,
            freeMargin: 10000,
            marginLevel: null,
            stopOutLevel: 50,
            leverage: 100,
            realizedPnL: 0,
            unrealizedPnL: 0,
            tradingMode: 'HEDGING',
            isLocked: false,
          },
          positions: [],
          closedPositions: [],
          pendingOrders: [],
          completedOrders: [],
          tradeRecords: [],
          events: [],
          executionAssumptions: {
            priceModel: 'LAST_PRICE',
            spreadPipsOrPts: 0,
            commissionPerLotOrUnit: 0,
            slippagePoints: 0,
            swapLong: 0,
            swapShort: 0,
          },
          updatedAt: Date.now(),
        };
      }

      // Generate complete deterministic performance report
      const rep = AnalyticsEngine.generateReport(activeSession, tradingState);
      await AnalyticsPersistence.saveReport(rep);
      setReport(rep);
    } catch (err) {
      console.error('[AnalyticsPage] Failed to load session analytics:', err);
      setErrorMessage(err instanceof Error ? err.message : String(err));
    } finally {
      setIsLoading(false);
    }
  }, [paramSessionId]);

  useEffect(() => {
    loadAnalytics();
  }, [loadAnalytics]);

  if (isLoading) {
    return (
      <div className="analytics-dashboard" style={{ justifyContent: 'center', alignItems: 'center' }}>
        <div style={{ color: '#22d3ee', fontSize: '1.125rem', fontWeight: 600 }}>
          Calculating Session Performance Metrics...
        </div>
      </div>
    );
  }

  if (errorMessage || !report) {
    return (
      <div className="analytics-dashboard" style={{ justifyContent: 'center', alignItems: 'center' }}>
        <div style={{ maxWidth: 500, textAlign: 'center', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <h2 style={{ color: '#f43f5e', margin: 0 }}>Analytics Load Error</h2>
          <p style={{ color: '#94a3b8' }}>{errorMessage || 'Unable to locate session analytics.'}</p>
          <Link to="/backtest" className="btn-analytics btn-analytics--primary" style={{ alignSelf: 'center' }}>
            Return to Backtest Setup
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="analytics-dashboard">
      {/* 1. Header & Navigation */}
      <AnalyticsHeader report={report} onRefresh={loadAnalytics} />

      {/* 2. Performance Overview Cards */}
      <PerformanceOverviewCards
        overview={report.overview}
        openPositions={report.openPositions}
        pendingOrdersCount={report.pendingOrdersCount}
      />

      {/* 3. Empty State Guidance Banner if 0 closed trades */}
      {report.overview.totalClosedTrades === 0 && (
        <div
          style={{
            background: 'rgba(30, 41, 59, 0.6)',
            border: '1px solid #334155',
            borderRadius: 8,
            padding: '1.25rem 1.5rem',
            color: '#94a3b8',
            fontSize: '0.875rem',
            display: 'flex',
            alignItems: 'center',
            gap: '1rem',
          }}
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#38bdf8" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          <div>
            <strong style={{ color: '#e2e8f0', display: 'block' }}>No Completed Trades Recorded Yet</strong>
            To generate statistical Win Rate, Profit Factor, Expectancy, and Drawdown curves, place and close simulated trades in the Replay Workspace.
          </div>
        </div>
      )}

      {/* 4. Interactive Balance & Drawdown Curves */}
      <PerformanceChartsSection
        balanceCurve={report.balanceCurve}
        drawdownAnalysis={report.drawdownAnalysis}
        initialBalance={report.overview.initialBalance}
      />

      {/* 5. Streaks, Holding Durations & Risk/Reward */}
      <WinLossStreaksSection
        overview={report.overview}
        streaks={report.streaks}
        riskReward={report.riskReward}
      />

      {/* 6. Long vs Short Analysis */}
      <LongShortBreakdownSection
        longAnalysis={report.longAnalysis}
        shortAnalysis={report.shortAnalysis}
      />

      {/* 7. Periodic Performance & Outcome Distribution */}
      <div className="analytics-two-col">
        <PeriodicPerformanceSection
          daily={report.dailyPerformance}
          weekly={report.weeklyPerformance}
          monthly={report.monthlyPerformance}
        />
        <TradeDistributionChart bins={report.distributionBins} />
      </div>

      {/* 8. Session Killzones, Prop-Firm Challenge Tracker & Daily P&L Calendar */}
      <SessionAndCalendarAnalyticsSection
        trades={report.closedTrades}
        overview={report.overview}
        drawdown={report.drawdownAnalysis}
      />

      {/* 9. Closed Trade History Table with Execution Review & Tagging */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        <h3 style={{ fontSize: '1.125rem', fontWeight: 700, margin: 0, color: '#f3f4f6' }}>
          Closed Trade Records &amp; Visual Execution Review ({report.closedTrades.length})
        </h3>
        <TradeHistoryTable trades={report.closedTrades} onTradeMetaUpdated={loadAnalytics} />
      </div>
    </div>
  );
};

export default AnalyticsPage;
