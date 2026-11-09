import React, { useState } from 'react';
import { PeriodicPerformanceRecord } from '../../services/analytics/AnalyticsTypes';

interface PeriodicPerformanceSectionProps {
  daily: PeriodicPerformanceRecord[];
  weekly: PeriodicPerformanceRecord[];
  monthly: PeriodicPerformanceRecord[];
}

export const PeriodicPerformanceSection: React.FC<PeriodicPerformanceSectionProps> = ({
  daily,
  weekly,
  monthly,
}) => {
  const [periodType, setPeriodType] = useState<'DAILY' | 'WEEKLY' | 'MONTHLY'>('DAILY');

  const activeList =
    periodType === 'DAILY' ? daily : periodType === 'WEEKLY' ? weekly : monthly;

  return (
    <div className="analytics-subcard">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
        <h4 className="analytics-subcard__title" style={{ border: 'none', padding: 0 }}>
          Performance Over Time
        </h4>
        <div className="analytics-chart-tabs">
          <button
            type="button"
            className={`analytics-chart-tab ${periodType === 'DAILY' ? 'active' : ''}`}
            onClick={() => setPeriodType('DAILY')}
          >
            Daily
          </button>
          <button
            type="button"
            className={`analytics-chart-tab ${periodType === 'WEEKLY' ? 'active' : ''}`}
            onClick={() => setPeriodType('WEEKLY')}
          >
            Weekly
          </button>
          <button
            type="button"
            className={`analytics-chart-tab ${periodType === 'MONTHLY' ? 'active' : ''}`}
            onClick={() => setPeriodType('MONTHLY')}
          >
            Monthly
          </button>
        </div>
      </div>

      {activeList.length === 0 ? (
        <div style={{ color: '#64748b', fontSize: '0.8125rem', padding: '1rem 0' }}>
          No closed trades recorded in this timeframe yet.
        </div>
      ) : (
        <div className="table-responsive" style={{ maxHeight: 240, overflowY: 'auto' }}>
          <table className="analytics-table">
            <thead>
              <tr>
                <th>Period</th>
                <th>Trades</th>
                <th>Wins / Losses</th>
                <th>Win Rate</th>
                <th>Net P/L ($)</th>
              </tr>
            </thead>
            <tbody>
              {activeList.map((row) => (
                <tr key={row.periodKey}>
                  <td><strong>{row.periodLabel}</strong></td>
                  <td>{row.tradeCount}</td>
                  <td>
                    <span style={{ color: '#22d3ee' }}>{row.winCount}W</span> /{' '}
                    <span style={{ color: '#f43f5e' }}>{row.lossCount}L</span>
                  </td>
                  <td>{row.winRate !== null ? `${row.winRate.toFixed(1)}%` : 'N/A'}</td>
                  <td
                    style={{
                      fontWeight: 700,
                      color: row.netPnL > 0 ? '#22d3ee' : row.netPnL < 0 ? '#f43f5e' : '#cbd5e1',
                    }}
                  >
                    {row.netPnL >= 0 ? '+$' : '-$'}{Math.abs(row.netPnL).toFixed(2)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
