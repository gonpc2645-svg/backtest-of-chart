import React from 'react';
import { PerformanceOverviewMetrics, OpenPositionSnapshot } from '../../services/analytics/AnalyticsTypes';

interface PerformanceOverviewCardsProps {
  overview: PerformanceOverviewMetrics;
  openPositions: OpenPositionSnapshot[];
  pendingOrdersCount: number;
}

export const PerformanceOverviewCards: React.FC<PerformanceOverviewCardsProps> = ({
  overview,
  openPositions,
  pendingOrdersCount,
}) => {
  const formatCurrency = (val: number | null) => {
    if (val === null || val === undefined) return 'N/A';
    return (val >= 0 ? '$' : '-$') + Math.abs(val).toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  };

  const formatDuration = (ms: number | null) => {
    if (ms === null || ms === undefined) return 'N/A';
    const totalSec = Math.round(ms / 1000);
    const days = Math.floor(totalSec / 86400);
    const hours = Math.floor((totalSec % 86400) / 3600);
    const minutes = Math.floor((totalSec % 3600) / 60);
    const seconds = totalSec % 60;

    const parts = [];
    if (days > 0) parts.push(`${days}d`);
    if (hours > 0 || days > 0) parts.push(`${hours}h`);
    if (minutes > 0 || (hours === 0 && days === 0)) parts.push(`${minutes}m`);
    if (days === 0 && hours === 0) parts.push(`${seconds}s`);
    return parts.join(' ');
  };

  const totalUnrealizedPnL = openPositions.reduce((acc, p) => acc + p.unrealizedPnL, 0);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      {/* Open Positions Context Alert */}
      <div className="analytics-open-alert">
        <div className="analytics-open-alert__left">
          <span style={{ color: '#94a3b8' }}>Open Exposure:</span>
          <strong>{openPositions.length} Active Positions</strong>
          <span style={{ color: '#64748b' }}>•</span>
          <span>{pendingOrdersCount} Pending Orders</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <span style={{ color: '#94a3b8' }}>Unrealized Floating P/L:</span>
          <span
            className="analytics-open-alert__pnl"
            style={{ color: totalUnrealizedPnL >= 0 ? '#22d3ee' : '#f43f5e' }}
          >
            {formatCurrency(totalUnrealizedPnL)}
          </span>
        </div>
      </div>

      {/* Primary Metrics Grid */}
      <div className="analytics-grid">
        {/* 1. Initial Balance */}
        <div className="metric-card">
          <span className="metric-card__label">Initial Balance</span>
          <span className="metric-card__value">{formatCurrency(overview.initialBalance)}</span>
          <span className="metric-card__sub">Starting deposit</span>
        </div>

        {/* 2. Current Balance */}
        <div className="metric-card">
          <span className="metric-card__label">Current Balance</span>
          <span className="metric-card__value">{formatCurrency(overview.currentBalance)}</span>
          <span className="metric-card__sub">Realized funds</span>
        </div>

        {/* 3. Current Equity */}
        <div className="metric-card">
          <span className="metric-card__label">Current Equity</span>
          <span className="metric-card__value">{formatCurrency(overview.currentEquity)}</span>
          <span className="metric-card__sub">Balance + Floating P/L</span>
        </div>

        {/* 4. Net Profit / Loss */}
        <div className="metric-card">
          <span className="metric-card__label">Net Profit / Loss</span>
          <span
            className={`metric-card__value ${
              overview.netPnL > 0
                ? 'metric-card__value--profit'
                : overview.netPnL < 0
                ? 'metric-card__value--loss'
                : ''
            }`}
          >
            {formatCurrency(overview.netPnL)}
          </span>
          <span className="metric-card__sub">
            {overview.initialBalance > 0
              ? `${((overview.netPnL / overview.initialBalance) * 100).toFixed(2)}% Return`
              : ''}
          </span>
        </div>

        {/* 5. Gross Profit */}
        <div className="metric-card">
          <span className="metric-card__label">Gross Profit</span>
          <span className="metric-card__value metric-card__value--profit">
            {formatCurrency(overview.grossProfit)}
          </span>
          <span className="metric-card__sub">{overview.winningTrades} winning trades</span>
        </div>

        {/* 6. Gross Loss */}
        <div className="metric-card">
          <span className="metric-card__label">Gross Loss</span>
          <span className="metric-card__value metric-card__value--loss">
            {formatCurrency(-overview.grossLoss)}
          </span>
          <span className="metric-card__sub">{overview.losingTrades} losing trades</span>
        </div>

        {/* 7. Total Closed Trades */}
        <div className="metric-card">
          <span className="metric-card__label">Total Closed Trades</span>
          <span className="metric-card__value">{overview.totalClosedTrades}</span>
          <span className="metric-card__sub">
            {overview.winningTrades}W / {overview.losingTrades}L / {overview.breakevenTrades}BE
          </span>
        </div>

        {/* 8. Win Rate */}
        <div className="metric-card">
          <span className="metric-card__label">Win Rate</span>
          <span className="metric-card__value">
            {overview.winRate !== null ? `${overview.winRate.toFixed(1)}%` : 'N/A'}
          </span>
          <span className="metric-card__sub">
            {overview.winRateExcludingBreakeven !== null
              ? `${overview.winRateExcludingBreakeven.toFixed(1)}% (excl. BE)`
              : 'Over all closed trades'}
          </span>
        </div>

        {/* 9. Profit Factor */}
        <div className="metric-card">
          <span className="metric-card__label">Profit Factor</span>
          <span className="metric-card__value">
            {overview.profitFactor !== null
              ? overview.profitFactor === Infinity
                ? '∞ (No Losses)'
                : overview.profitFactor.toFixed(2)
              : 'N/A'}
          </span>
          <span className="metric-card__sub">Gross Profit / Gross Loss</span>
        </div>

        {/* 10. Expectancy */}
        <div className="metric-card">
          <span className="metric-card__label">Expectancy</span>
          <span
            className={`metric-card__value ${
              (overview.expectancy ?? 0) > 0
                ? 'metric-card__value--profit'
                : (overview.expectancy ?? 0) < 0
                ? 'metric-card__value--loss'
                : ''
            }`}
          >
            {formatCurrency(overview.expectancy)}
          </span>
          <span className="metric-card__sub">Avg Net Return per trade</span>
        </div>

        {/* 11. Maximum Drawdown */}
        <div className="metric-card">
          <span className="metric-card__label">Max Drawdown</span>
          <span className="metric-card__value metric-card__value--loss">
            {overview.maxDrawdownPct.toFixed(2)}%
          </span>
          <span className="metric-card__sub">{formatCurrency(-overview.maxDrawdownAmount)} Peak-to-Trough</span>
        </div>

        {/* 12. Recovery Factor */}
        <div className="metric-card">
          <span className="metric-card__label">Recovery Factor</span>
          <span className="metric-card__value">
            {overview.recoveryFactor !== null
              ? overview.recoveryFactor === Infinity
                ? '∞'
                : overview.recoveryFactor.toFixed(2)
              : 'N/A'}
          </span>
          <span className="metric-card__sub">Net PnL / Max Drawdown</span>
        </div>

        {/* 13. Average Win */}
        <div className="metric-card">
          <span className="metric-card__label">Average Win</span>
          <span className="metric-card__value metric-card__value--profit">
            {formatCurrency(overview.averageWin)}
          </span>
          <span className="metric-card__sub">Per winning trade</span>
        </div>

        {/* 14. Average Loss */}
        <div className="metric-card">
          <span className="metric-card__label">Average Loss</span>
          <span className="metric-card__value metric-card__value--loss">
            {formatCurrency(overview.averageLoss !== null ? -overview.averageLoss : null)}
          </span>
          <span className="metric-card__sub">Per losing trade</span>
        </div>

        {/* 15. Win / Loss Ratio */}
        <div className="metric-card">
          <span className="metric-card__label">Win / Loss Ratio</span>
          <span className="metric-card__value">
            {overview.winLossRatio !== null ? overview.winLossRatio.toFixed(2) : 'N/A'}
          </span>
          <span className="metric-card__sub">Avg Win / Avg Loss</span>
        </div>

        {/* 16. Largest Win */}
        <div className="metric-card">
          <span className="metric-card__label">Largest Win</span>
          <span className="metric-card__value metric-card__value--profit">
            {formatCurrency(overview.largestWin)}
          </span>
          <span className="metric-card__sub">Best trade result</span>
        </div>

        {/* 17. Largest Loss */}
        <div className="metric-card">
          <span className="metric-card__label">Largest Loss</span>
          <span className="metric-card__value metric-card__value--loss">
            {formatCurrency(overview.largestLoss)}
          </span>
          <span className="metric-card__sub">Worst trade result</span>
        </div>

        {/* 18. Average Duration */}
        <div className="metric-card">
          <span className="metric-card__label">Avg Trade Duration</span>
          <span className="metric-card__value" style={{ fontSize: '1.15rem' }}>
            {formatDuration(overview.averageHoldingDurationMs)}
          </span>
          <span className="metric-card__sub">Entry to full exit</span>
        </div>
      </div>
    </div>
  );
};
