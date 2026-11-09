import React from 'react';
import { DistributionBin } from '../../services/analytics/AnalyticsTypes';

interface TradeDistributionChartProps {
  bins: DistributionBin[];
}

export const TradeDistributionChart: React.FC<TradeDistributionChartProps> = ({ bins }) => {
  return (
    <div className="analytics-subcard">
      <h4 className="analytics-subcard__title">Trade Result Distribution</h4>

      {bins.length === 0 ? (
        <div style={{ color: '#64748b', fontSize: '0.8125rem', padding: '1rem 0' }}>
          No trade outcome distribution available until trades are completed.
        </div>
      ) : (
        <div className="distribution-bars">
          {bins.map((bin, i) => {
            const isProfit = (bin.minPnL + bin.maxPnL) / 2 >= 0;
            return (
              <div key={i} className="dist-bar-item">
                <div className="dist-bar-label">
                  <span>{bin.binLabel}</span>
                  <strong>
                    {bin.count} trades ({bin.percentage.toFixed(1)}%)
                  </strong>
                </div>
                <div className="dist-bar-track">
                  <div
                    className={`dist-bar-fill ${isProfit ? 'dist-bar-fill--profit' : 'dist-bar-fill--loss'}`}
                    style={{ width: `${Math.max(2, bin.percentage)}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
