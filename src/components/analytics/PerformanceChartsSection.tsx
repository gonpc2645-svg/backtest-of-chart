import React, { useState } from 'react';
import { BalanceCurvePoint, DrawdownAnalysis } from '../../services/analytics/AnalyticsTypes';

interface PerformanceChartsSectionProps {
  balanceCurve: BalanceCurvePoint[];
  drawdownAnalysis: DrawdownAnalysis;
  initialBalance: number;
}

export const PerformanceChartsSection: React.FC<PerformanceChartsSectionProps> = ({
  balanceCurve,
  drawdownAnalysis,
  initialBalance,
}) => {
  const [activeTab, setActiveTab] = useState<'BALANCE' | 'DRAWDOWN'>('BALANCE');
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  const formatUtc = (ms: number) => {
    return new Date(ms).toISOString().replace('T', ' ').slice(0, 16) + ' UTC';
  };

  // Dimensions for SVG rendering
  const width = 900;
  const height = 260;
  const padding = { top: 20, right: 30, bottom: 35, left: 65 };
  const innerWidth = width - padding.left - padding.right;
  const innerHeight = height - padding.top - padding.bottom;

  // 1. Balance Data Normalization
  const balanceValues = balanceCurve.map((p) => p.balance);
  const minBal = Math.min(initialBalance * 0.98, ...balanceValues);
  const maxBal = Math.max(initialBalance * 1.02, ...balanceValues);
  const balRange = maxBal - minBal || 1;

  // 2. Drawdown Data Normalization
  const ddValues = drawdownAnalysis.drawdownCurve.map((d) => d.drawdownPct);
  const maxDd = Math.max(5, ...ddValues);

  // SVG Coordinate Helpers
  const getBalanceX = (idx: number, count: number) => {
    if (count <= 1) return padding.left + innerWidth / 2;
    return padding.left + (idx / (count - 1)) * innerWidth;
  };

  const getBalanceY = (val: number) => {
    const norm = (val - minBal) / balRange;
    return padding.top + innerHeight - norm * innerHeight;
  };

  const getDrawdownY = (pct: number) => {
    const norm = pct / maxDd;
    return padding.top + norm * innerHeight;
  };

  // Build Balance Path
  const balancePointsStr = balanceCurve
    .map((p, i) => `${getBalanceX(i, balanceCurve.length)},${getBalanceY(p.balance)}`)
    .join(' ');

  const initialBalY = getBalanceY(initialBalance);

  // Build Drawdown Path
  const ddPoints = drawdownAnalysis.drawdownCurve;
  const ddPointsStr = ddPoints
    .map((d, i) => `${getBalanceX(i, ddPoints.length)},${getDrawdownY(d.drawdownPct)}`)
    .join(' ');

  const hoveredPoint =
    hoverIndex !== null && hoverIndex >= 0 && hoverIndex < balanceCurve.length
      ? balanceCurve[hoverIndex]
      : null;

  const hoveredDdPoint =
    hoverIndex !== null && hoverIndex >= 0 && hoverIndex < ddPoints.length
      ? ddPoints[hoverIndex]
      : null;

  return (
    <div className="analytics-chart-card">
      <div className="analytics-chart-header">
        <h3 className="analytics-chart-title">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
          </svg>
          {activeTab === 'BALANCE' ? 'Historical Balance Curve' : 'Underwater Drawdown Curve (%)'}
        </h3>

        <div className="analytics-chart-tabs">
          <button
            type="button"
            className={`analytics-chart-tab ${activeTab === 'BALANCE' ? 'active' : ''}`}
            onClick={() => setActiveTab('BALANCE')}
          >
            Balance Curve
          </button>
          <button
            type="button"
            className={`analytics-chart-tab ${activeTab === 'DRAWDOWN' ? 'active' : ''}`}
            onClick={() => setActiveTab('DRAWDOWN')}
          >
            Drawdown (%)
          </button>
        </div>
      </div>

      {/* SVG Interactive Chart */}
      <div className="chart-svg-container">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          style={{ width: '100%', height: '100%', overflow: 'visible' }}
          onMouseLeave={() => setHoverIndex(null)}
        >
          {/* Background gridlines */}
          <line
            x1={padding.left}
            y1={padding.top}
            x2={width - padding.right}
            y2={padding.top}
            stroke="#1f2937"
            strokeDasharray="4 4"
          />
          <line
            x1={padding.left}
            y1={padding.top + innerHeight / 2}
            x2={width - padding.right}
            y2={padding.top + innerHeight / 2}
            stroke="#1f2937"
            strokeDasharray="4 4"
          />
          <line
            x1={padding.left}
            y1={padding.top + innerHeight}
            x2={width - padding.right}
            y2={padding.top + innerHeight}
            stroke="#374151"
          />

          {activeTab === 'BALANCE' ? (
            <>
              {/* Initial Balance Reference Line */}
              <line
                x1={padding.left}
                y1={initialBalY}
                x2={width - padding.right}
                y2={initialBalY}
                stroke="#64748b"
                strokeDasharray="3 3"
                strokeWidth="1.2"
              />
              <text
                x={padding.left + 8}
                y={initialBalY - 6}
                fill="#94a3b8"
                fontSize="10"
                fontFamily="monospace"
              >
                Initial (${initialBalance.toFixed(0)})
              </text>

              {/* Balance Polyline */}
              <polyline
                fill="none"
                stroke="#22d3ee"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                points={balancePointsStr}
              />

              {/* Data points */}
              {balanceCurve.map((pt, i) => {
                const cx = getBalanceX(i, balanceCurve.length);
                const cy = getBalanceY(pt.balance);
                const isHovered = hoverIndex === i;
                return (
                  <circle
                    key={i}
                    cx={cx}
                    cy={cy}
                    r={isHovered ? 6 : 3.5}
                    fill={pt.pnl && pt.pnl > 0 ? '#22d3ee' : pt.pnl && pt.pnl < 0 ? '#f43f5e' : '#38bdf8'}
                    stroke="#0a0e14"
                    strokeWidth={isHovered ? 2 : 1}
                    style={{ cursor: 'pointer', transition: 'r 0.15s ease' }}
                    onMouseEnter={() => setHoverIndex(i)}
                  />
                );
              })}

              {/* Y Axis Labels */}
              <text x={padding.left - 8} y={padding.top + 4} textAnchor="end" fill="#9ca3af" fontSize="10" fontFamily="monospace">
                ${maxBal.toFixed(0)}
              </text>
              <text x={padding.left - 8} y={padding.top + innerHeight / 2 + 4} textAnchor="end" fill="#9ca3af" fontSize="10" fontFamily="monospace">
                ${((maxBal + minBal) / 2).toFixed(0)}
              </text>
              <text x={padding.left - 8} y={padding.top + innerHeight} textAnchor="end" fill="#9ca3af" fontSize="10" fontFamily="monospace">
                ${minBal.toFixed(0)}
              </text>
            </>
          ) : (
            <>
              {/* Drawdown Area / Polyline */}
              <polyline
                fill="none"
                stroke="#f43f5e"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                points={ddPointsStr}
              />

              {/* 0% Top Reference */}
              <line
                x1={padding.left}
                y1={padding.top}
                x2={width - padding.right}
                y2={padding.top}
                stroke="#374151"
                strokeWidth="1.5"
              />

              {ddPoints.map((pt, i) => {
                const cx = getBalanceX(i, ddPoints.length);
                const cy = getDrawdownY(pt.drawdownPct);
                const isHovered = hoverIndex === i;
                return (
                  <circle
                    key={i}
                    cx={cx}
                    cy={cy}
                    r={isHovered ? 6 : 3.5}
                    fill="#f43f5e"
                    stroke="#0a0e14"
                    strokeWidth={isHovered ? 2 : 1}
                    style={{ cursor: 'pointer' }}
                    onMouseEnter={() => setHoverIndex(i)}
                  />
                );
              })}

              {/* Y Axis Labels */}
              <text x={padding.left - 8} y={padding.top + 4} textAnchor="end" fill="#9ca3af" fontSize="10" fontFamily="monospace">
                0.00%
              </text>
              <text x={padding.left - 8} y={padding.top + innerHeight / 2 + 4} textAnchor="end" fill="#9ca3af" fontSize="10" fontFamily="monospace">
                -{(maxDd / 2).toFixed(2)}%
              </text>
              <text x={padding.left - 8} y={padding.top + innerHeight} textAnchor="end" fill="#f43f5e" fontSize="10" fontFamily="monospace">
                -{maxDd.toFixed(2)}%
              </text>
            </>
          )}

          {/* X Axis Start & End Dates */}
          {balanceCurve.length > 0 && (
            <>
              <text x={padding.left} y={height - 10} fill="#6b7280" fontSize="10" fontFamily="monospace">
                {formatUtc(balanceCurve[0].timestamp)}
              </text>
              <text
                x={width - padding.right}
                y={height - 10}
                textAnchor="end"
                fill="#6b7280"
                fontSize="10"
                fontFamily="monospace"
              >
                {formatUtc(balanceCurve[balanceCurve.length - 1].timestamp)}
              </text>
            </>
          )}
        </svg>

        {/* Hover Tooltip Overlay */}
        {hoveredPoint && (
          <div
            style={{
              position: 'absolute',
              top: 10,
              right: 15,
              background: 'rgba(17, 24, 39, 0.95)',
              border: '1px solid #374151',
              borderRadius: 6,
              padding: '0.5rem 0.8rem',
              fontSize: '0.75rem',
              color: '#e5e7eb',
              boxShadow: '0 4px 15px rgba(0,0,0,0.5)',
              pointerEvents: 'none',
              zIndex: 10,
            }}
          >
            <div style={{ color: '#9ca3af', marginBottom: 2 }}>{formatUtc(hoveredPoint.timestamp)}</div>
            {activeTab === 'BALANCE' ? (
              <>
                <div>
                  Balance: <strong style={{ color: '#22d3ee' }}>${hoveredPoint.balance.toFixed(2)}</strong>
                </div>
                {hoveredPoint.pnl !== undefined && (
                  <div style={{ color: hoveredPoint.pnl >= 0 ? '#4ade80' : '#f43f5e' }}>
                    Trade P/L: {hoveredPoint.pnl >= 0 ? '+' : ''}${hoveredPoint.pnl.toFixed(2)}
                  </div>
                )}
              </>
            ) : (
              <>
                <div style={{ color: '#f43f5e' }}>
                  Drawdown: <strong>-{hoveredDdPoint?.drawdownPct.toFixed(2)}%</strong>
                </div>
                <div>Amount: -${hoveredDdPoint?.drawdownAmount.toFixed(2)}</div>
                <div style={{ color: '#9ca3af' }}>Peak: ${hoveredDdPoint?.peakBalance.toFixed(2)}</div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
