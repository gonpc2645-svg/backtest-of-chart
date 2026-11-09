import React from 'react';
import { PerformanceOverviewMetrics, RiskRewardMetrics, StreakMetrics } from '../../services/analytics/AnalyticsTypes';

interface WinLossStreaksSectionProps {
  overview: PerformanceOverviewMetrics;
  streaks: StreakMetrics;
  riskReward: RiskRewardMetrics;
}

export const WinLossStreaksSection: React.FC<WinLossStreaksSectionProps> = ({
  overview,
  streaks,
  riskReward,
}) => {
  const formatDuration = (ms: number | null) => {
    if (ms === null || ms === undefined) return 'N/A';
    const totalSec = Math.round(ms / 1000);
    const hours = Math.floor(totalSec / 3600);
    const minutes = Math.floor((totalSec % 3600) / 60);
    const seconds = totalSec % 60;
    const parts = [];
    if (hours > 0) parts.push(`${hours}h`);
    if (minutes > 0 || hours > 0) parts.push(`${minutes}m`);
    parts.push(`${seconds}s`);
    return parts.join(' ');
  };

  return (
    <div className="analytics-two-col">
      {/* 1. Streaks & Duration */}
      <div className="analytics-subcard">
        <h4 className="analytics-subcard__title">Streaks &amp; Duration Profile</h4>
        <div className="analytics-stats-list">
          <div className="analytics-stat-row">
            <span className="analytics-stat-row__label">Max Consecutive Wins</span>
            <span className="analytics-stat-row__val" style={{ color: '#22d3ee' }}>
              {streaks.maxConsecutiveWins} trades
            </span>
          </div>

          <div className="analytics-stat-row">
            <span className="analytics-stat-row__label">Max Consecutive Losses</span>
            <span className="analytics-stat-row__val" style={{ color: '#f43f5e' }}>
              {streaks.maxConsecutiveLosses} trades
            </span>
          </div>

          <div className="analytics-stat-row">
            <span className="analytics-stat-row__label">Current Active Streak</span>
            <span
              className="analytics-stat-row__val"
              style={{
                color:
                  streaks.currentStreakType === 'WIN'
                    ? '#22d3ee'
                    : streaks.currentStreakType === 'LOSS'
                    ? '#f43f5e'
                    : '#94a3b8',
              }}
            >
              {streaks.currentStreakCount > 0
                ? `${streaks.currentStreakCount} ${streaks.currentStreakType}S`
                : 'None'}
            </span>
          </div>

          <div className="analytics-stat-row">
            <span className="analytics-stat-row__label">Avg Winner Duration</span>
            <span className="analytics-stat-row__val">{formatDuration(overview.averageWinnerDurationMs)}</span>
          </div>

          <div className="analytics-stat-row">
            <span className="analytics-stat-row__label">Avg Loser Duration</span>
            <span className="analytics-stat-row__val">{formatDuration(overview.averageLoserDurationMs)}</span>
          </div>
        </div>
      </div>

      {/* 2. Risk / Reward & R-Multiples */}
      <div className="analytics-subcard">
        <h4 className="analytics-subcard__title">Risk / Reward (R-Multiples)</h4>
        <div className="analytics-stats-list">
          <div className="analytics-stat-row">
            <span className="analytics-stat-row__label">Trades with Defined SL Risk</span>
            <span className="analytics-stat-row__val">{riskReward.tradesWithDefinedRiskCount}</span>
          </div>

          <div className="analytics-stat-row">
            <span className="analytics-stat-row__label">Average Initial Risk (R)</span>
            <span className="analytics-stat-row__val">
              {riskReward.averageInitialRisk !== null ? `$${riskReward.averageInitialRisk.toFixed(2)}` : 'N/A'}
            </span>
          </div>

          <div className="analytics-stat-row">
            <span className="analytics-stat-row__label">Average Realized R-Multiple</span>
            <span
              className="analytics-stat-row__val"
              style={{
                color:
                  riskReward.averageRMultiple !== null && riskReward.averageRMultiple > 0
                    ? '#22d3ee'
                    : riskReward.averageRMultiple !== null && riskReward.averageRMultiple < 0
                    ? '#f43f5e'
                    : '#e2e8f0',
              }}
            >
              {riskReward.averageRMultiple !== null
                ? `${riskReward.averageRMultiple >= 0 ? '+' : ''}${riskReward.averageRMultiple.toFixed(2)}R`
                : 'N/A'}
            </span>
          </div>

          <div className="analytics-stat-row">
            <span className="analytics-stat-row__label">Largest Realized R-Multiple</span>
            <span className="analytics-stat-row__val" style={{ color: '#22d3ee' }}>
              {riskReward.largestRMultiple !== null ? `+${riskReward.largestRMultiple.toFixed(2)}R` : 'N/A'}
            </span>
          </div>

          <div className="analytics-stat-row">
            <span className="analytics-stat-row__label">Lowest Realized R-Multiple</span>
            <span className="analytics-stat-row__val" style={{ color: '#f43f5e' }}>
              {riskReward.lowestRMultiple !== null ? `${riskReward.lowestRMultiple.toFixed(2)}R` : 'N/A'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
