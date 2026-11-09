import React from 'react';
import { DirectionMetrics } from '../../services/analytics/AnalyticsTypes';

interface LongShortBreakdownSectionProps {
  longAnalysis: DirectionMetrics;
  shortAnalysis: DirectionMetrics;
}

export const LongShortBreakdownSection: React.FC<LongShortBreakdownSectionProps> = ({
  longAnalysis,
  shortAnalysis,
}) => {
  const renderDirectionBox = (data: DirectionMetrics, isLong: boolean) => {
    return (
      <div className={`comparison-box ${isLong ? 'comparison-box--long' : 'comparison-box--short'}`}>
        <div className="comparison-box__head">
          <span>{isLong ? 'LONG TRADES (BUY)' : 'SHORT TRADES (SELL)'}</span>
          <span style={{ color: isLong ? '#22d3ee' : '#f43f5e', fontSize: '0.8125rem' }}>
            {data.tradeCount} trades
          </span>
        </div>

        <div className="analytics-stats-list">
          <div className="analytics-stat-row">
            <span className="analytics-stat-row__label">Win Rate</span>
            <span className="analytics-stat-row__val">
              {data.winRate !== null ? `${data.winRate.toFixed(1)}%` : 'N/A'}
            </span>
          </div>

          <div className="analytics-stat-row">
            <span className="analytics-stat-row__label">Net Realized P/L</span>
            <span
              className="analytics-stat-row__val"
              style={{
                color: data.netPnL > 0 ? '#22d3ee' : data.netPnL < 0 ? '#f43f5e' : '#e2e8f0',
              }}
            >
              {data.netPnL >= 0 ? '$' : '-$'}{Math.abs(data.netPnL).toFixed(2)}
            </span>
          </div>

          <div className="analytics-stat-row">
            <span className="analytics-stat-row__label">Gross Profit</span>
            <span className="analytics-stat-row__val" style={{ color: '#22d3ee' }}>
              ${data.grossProfit.toFixed(2)}
            </span>
          </div>

          <div className="analytics-stat-row">
            <span className="analytics-stat-row__label">Gross Loss</span>
            <span className="analytics-stat-row__val" style={{ color: '#f43f5e' }}>
              -${data.grossLoss.toFixed(2)}
            </span>
          </div>

          <div className="analytics-stat-row">
            <span className="analytics-stat-row__label">Profit Factor</span>
            <span className="analytics-stat-row__val">
              {data.profitFactor !== null
                ? data.profitFactor === Infinity
                  ? '∞ (No Losses)'
                  : data.profitFactor.toFixed(2)
                : 'N/A'}
            </span>
          </div>

          <div className="analytics-stat-row">
            <span className="analytics-stat-row__label">Avg P/L per Trade</span>
            <span className="analytics-stat-row__val">
              {data.averagePnL !== null
                ? `${data.averagePnL >= 0 ? '$' : '-$'}${Math.abs(data.averagePnL).toFixed(2)}`
                : 'N/A'}
            </span>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="analytics-subcard">
      <h4 className="analytics-subcard__title">Direction Analysis: Long vs Short</h4>
      <div className="comparison-grid">
        {renderDirectionBox(longAnalysis, true)}
        {renderDirectionBox(shortAnalysis, false)}
      </div>
    </div>
  );
};
