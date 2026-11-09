import React from 'react';
import { Link } from 'react-router-dom';
import { TradingAccount } from '../../services/trading/TradingTypes';

interface AccountSummaryBarProps {
  account: TradingAccount;
  sessionId?: string;
  onResetClick: () => void;
  onExportImportClick: () => void;
}

export const AccountSummaryBar: React.FC<AccountSummaryBarProps> = ({
  account,
  sessionId,
  onResetClick,
  onExportImportClick,
}) => {
  const formatCurrency = (val: number | undefined): string => {
    if (val === undefined || isNaN(val)) return '$0.00';
    return (
      (val < 0 ? '-$' : '$') +
      Math.abs(val).toLocaleString('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })
    );
  };

  const getMarginLevelColor = (level: number | null): string => {
    if (level === null) return '';
    if (level <= 60) return 'trading-metric-value--danger';
    if (level <= 120) return 'trading-metric-value--warning';
    return 'trading-metric-value--positive';
  };

  return (
    <div className="trading-account-bar" aria-label="Simulated Trading Account Summary">
      <div className="trading-account-metrics">
        {/* Balance */}
        <div className="trading-metric-item">
          <span className="trading-metric-label">Balance:</span>
          <span className="trading-metric-value">{formatCurrency(account.balance)}</span>
        </div>

        {/* Equity */}
        <div className="trading-metric-item">
          <span className="trading-metric-label">Equity:</span>
          <span
            className={`trading-metric-value ${
              account.equity >= account.balance
                ? 'trading-metric-value--positive'
                : 'trading-metric-value--negative'
            }`}
          >
            {formatCurrency(account.equity)}
          </span>
        </div>

        {/* Used Margin */}
        <div className="trading-metric-item">
          <span className="trading-metric-label">Used Margin:</span>
          <span className="trading-metric-value">{formatCurrency(account.usedMargin)}</span>
        </div>

        {/* Free Margin */}
        <div className="trading-metric-item">
          <span className="trading-metric-label">Free Margin:</span>
          <span
            className={`trading-metric-value ${
              account.freeMargin < 0 ? 'trading-metric-value--danger' : ''
            }`}
          >
            {formatCurrency(account.freeMargin)}
          </span>
        </div>

        {/* Margin Level */}
        <div className="trading-metric-item">
          <span className="trading-metric-label">Margin Level:</span>
          <span className={`trading-metric-value ${getMarginLevelColor(account.marginLevel)}`}>
            {account.marginLevel !== null ? `${account.marginLevel.toFixed(1)}%` : 'N/A'}
          </span>
        </div>

        {/* Floating P/L */}
        <div className="trading-metric-item">
          <span className="trading-metric-label">Floating P/L:</span>
          <span
            className={`trading-metric-value ${
              account.unrealizedPnL > 0
                ? 'trading-metric-value--positive'
                : account.unrealizedPnL < 0
                ? 'trading-metric-value--negative'
                : ''
            }`}
          >
            {formatCurrency(account.unrealizedPnL)}
          </span>
        </div>

        {/* Leverage Pill */}
        <div className="trading-metric-item">
          <span className="trading-metric-label">Leverage:</span>
          <span className="trading-metric-value" style={{ color: 'var(--text-muted)' }}>
            1:{account.leverage}
          </span>
        </div>
      </div>

      <div className="trading-account-actions">
        <Link
          to={`/backtest/analytics/${sessionId || ''}`}
          className="btn-action-sm"
          title="Open Full Performance Analytics Dashboard"
          style={{ textDecoration: 'none', color: '#22d3ee', borderColor: 'rgba(34, 211, 238, 0.4)' }}
        >
          Analytics
        </Link>
        <button
          type="button"
          className="btn-action-sm"
          onClick={onExportImportClick}
          title="Export / Import Session or Trade History CSV"
        >
          Session &amp; CSV
        </button>
        <button
          type="button"
          className="btn-action-sm btn-action-sm--danger"
          onClick={onResetClick}
          title="Reset Trading Account to Initial State"
        >
          Reset Account
        </button>
      </div>
    </div>
  );
};
