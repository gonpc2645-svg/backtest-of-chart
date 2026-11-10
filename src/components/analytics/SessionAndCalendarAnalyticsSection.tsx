import React from 'react';
import { NormalizedTrade, PerformanceOverviewMetrics, DrawdownAnalysis } from '../../services/analytics/AnalyticsTypes';
import { detectTradingSession, getStoredJournalMeta } from './TradeExecutionReviewModal';

interface SessionAndCalendarAnalyticsSectionProps {
  trades: NormalizedTrade[];
  overview: PerformanceOverviewMetrics;
  drawdown: DrawdownAnalysis;
}

const SESSIONS = ['London', 'London/NY Overlap', 'New York', 'Tokyo / Asian'] as const;

export const SessionAndCalendarAnalyticsSection: React.FC<SessionAndCalendarAnalyticsSectionProps> = ({
  trades,
  overview,
  drawdown,
}) => {
  // 1. Session-wise breakdown
  const sessionStats = SESSIONS.map((sessionName) => {
    const matching = trades.filter((t) => detectTradingSession(t.entryTime) === sessionName);
    const wins = matching.filter((t) => t.pnl > 0).length;
    const netPnL = matching.reduce((acc, t) => acc + t.pnl, 0);
    const winRate = matching.length > 0 ? (wins / matching.length) * 100 : 0;
    return {
      sessionName,
      count: matching.length,
      wins,
      losses: matching.length - wins,
      netPnL,
      winRate,
    };
  });

  // 2. Daily P&L Calendar aggregation
  const dailyMap = new Map<string, { dateStr: string; pnl: number; count: number; wins: number }>();
  for (const t of trades) {
    const dateStr = new Date(t.exitTime).toISOString().slice(0, 10);
    const cur = dailyMap.get(dateStr) || { dateStr, pnl: 0, count: 0, wins: 0 };
    cur.pnl += t.pnl;
    cur.count += 1;
    if (t.pnl > 0) cur.wins += 1;
    dailyMap.set(dateStr, cur);
  }
  const calendarDays = Array.from(dailyMap.values()).sort((a, b) => a.dateStr.localeCompare(b.dateStr));

  // 3. Playbook Setup Tag aggregation
  const setupMap = new Map<string, { tag: string; count: number; wins: number; pnl: number }>();
  for (const t of trades) {
    const meta = getStoredJournalMeta(t.id);
    const cur = setupMap.get(meta.setupTag) || { tag: meta.setupTag, count: 0, wins: 0, pnl: 0 };
    cur.count += 1;
    if (t.pnl > 0) cur.wins += 1;
    cur.pnl += t.pnl;
    setupMap.set(meta.setupTag, cur);
  }
  const setupStats = Array.from(setupMap.values());

  // 4. Prop-Firm Challenge Evaluation Rules (8% Target, 5% Daily DD, 10% Max DD)
  const profitTargetPct = 8.0;
  const maxTotalDdLimitPct = 10.0;
  const currentReturnPct =
    overview.initialBalance > 0 ? (overview.netPnL / overview.initialBalance) * 100 : 0;
  const maxObservedDdPct = drawdown.maxDrawdownPct;
  const targetProgress = Math.min(100, Math.max(0, (currentReturnPct / profitTargetPct) * 100));
  const isMaxDdSafe = maxObservedDdPct < maxTotalDdLimitPct;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {/* Row 1: Market Session Breakdown + Prop-Firm Challenge Tracker */}
      <div className="analytics-two-col">
        {/* Session Breakdown Card (FX Replay / TradeZella Style) */}
        <div className="analytics-section-card" style={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: 10, padding: '1.25rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <div>
              <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: '#f8fafc' }}>
                Session-Wise Performance (Killzones)
              </h3>
              <p style={{ margin: '2px 0 0', fontSize: '0.76rem', color: '#94a3b8' }}>
                Win rate &amp; net P&amp;L across London, New York, Overlap, and Asian sessions
              </p>
            </div>
            <span style={{ fontSize: '0.72rem', padding: '3px 8px', borderRadius: 4, background: 'rgba(56,189,248,0.12)', color: '#38bdf8', fontWeight: 700 }}>
              FX Replay / TradeZella Metric
            </span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 10 }}>
            {sessionStats.map((s) => (
              <div
                key={s.sessionName}
                style={{
                  background: '#090d16',
                  border: '1px solid #1e293b',
                  borderRadius: 8,
                  padding: '10px 12px',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', fontWeight: 700, marginBottom: 4 }}>
                  <span style={{ color: '#e2e8f0' }}>{s.sessionName}</span>
                  <span style={{ color: s.netPnL >= 0 ? '#4ade80' : '#f43f5e' }}>
                    {s.netPnL >= 0 ? '+$' : '-$'}{Math.abs(s.netPnL).toFixed(2)}
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', color: '#94a3b8', marginBottom: 6 }}>
                  <span>Trades: {s.count} ({s.wins}W / {s.losses}L)</span>
                  <span>WR: {s.winRate.toFixed(1)}%</span>
                </div>
                <div style={{ height: 5, background: '#1e293b', borderRadius: 3, overflow: 'hidden' }}>
                  <div
                    style={{
                      width: `${Math.min(100, s.winRate)}%`,
                      height: '100%',
                      background: s.netPnL >= 0 ? '#22d3ee' : '#f43f5e',
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Prop-Firm Challenge Evaluation & Strategy Playbook Card */}
        <div className="analytics-section-card" style={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: 10, padding: '1.25rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <div>
              <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: '#f8fafc' }}>
                Prop-Firm Challenge &amp; Playbook Edge
              </h3>
              <p style={{ margin: '2px 0 0', fontSize: '0.76rem', color: '#94a3b8' }}>
                Simulated Funded Account Objectives (8% Target / 10% Max Drawdown)
              </p>
            </div>
            <span
              style={{
                fontSize: '0.72rem',
                padding: '3px 8px',
                borderRadius: 4,
                background: isMaxDdSafe ? 'rgba(74,222,128,0.15)' : 'rgba(244,63,94,0.15)',
                color: isMaxDdSafe ? '#4ade80' : '#f43f5e',
                fontWeight: 700,
              }}
            >
              {currentReturnPct >= profitTargetPct && isMaxDdSafe
                ? '✓ CHALLENGE PASSED'
                : isMaxDdSafe
                ? 'IN PROGRESS (ACTIVE)'
                : '✕ MAX DD BREACHED'}
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.76rem', marginBottom: 4 }}>
                <span style={{ color: '#94a3b8' }}>Profit Target (+8.0% / +${(overview.initialBalance * 0.08).toFixed(0)})</span>
                <strong style={{ color: currentReturnPct >= 0 ? '#4ade80' : '#f43f5e' }}>
                  {currentReturnPct >= 0 ? '+' : ''}{currentReturnPct.toFixed(2)}%
                </strong>
              </div>
              <div style={{ height: 6, background: '#1e293b', borderRadius: 3, overflow: 'hidden' }}>
                <div style={{ width: `${targetProgress}%`, height: '100%', background: '#4ade80' }} />
              </div>
            </div>

            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.76rem', marginBottom: 4 }}>
                <span style={{ color: '#94a3b8' }}>Max Drawdown Limit (10.0% Max Allowed)</span>
                <strong style={{ color: isMaxDdSafe ? '#38bdf8' : '#f43f5e' }}>
                  {maxObservedDdPct.toFixed(2)}% Used
                </strong>
              </div>
              <div style={{ height: 6, background: '#1e293b', borderRadius: 3, overflow: 'hidden' }}>
                <div
                  style={{
                    width: `${Math.min(100, (maxObservedDdPct / maxTotalDdLimitPct) * 100)}%`,
                    height: '100%',
                    background: isMaxDdSafe ? '#38bdf8' : '#f43f5e',
                  }}
                />
              </div>
            </div>

            {setupStats.length > 0 && (
              <div style={{ marginTop: 6, paddingTop: 8, borderTop: '1px solid #1e293b' }}>
                <div style={{ fontSize: '0.74rem', color: '#94a3b8', marginBottom: 6, fontWeight: 600 }}>
                  Playbook Setup Performance:
                </div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {setupStats.map((st) => (
                    <span
                      key={st.tag}
                      style={{
                        fontSize: '0.72rem',
                        padding: '3px 8px',
                        borderRadius: 4,
                        background: '#090d16',
                        border: '1px solid #1e293b',
                        color: st.pnl >= 0 ? '#4ade80' : '#f87171',
                      }}
                    >
                      {st.tag}: {st.count}T ({Math.round((st.wins / st.count) * 100)}% WR) &bull;{' '}
                      {st.pnl >= 0 ? '+$' : '-$'}{Math.abs(st.pnl).toFixed(0)}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Row 2: Daily P&L Calendar View (TradeZella / SNRBD APK PnLCalendarScreen Style) */}
      <div className="analytics-section-card" style={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: 10, padding: '1.25rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.85rem' }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: '#f8fafc' }}>
              Daily P&amp;L Calendar Tracker
            </h3>
            <p style={{ margin: '2px 0 0', fontSize: '0.76rem', color: '#94a3b8' }}>
              Daily realized profit/loss and trade count across backtested trading days
            </p>
          </div>
        </div>

        {calendarDays.length === 0 ? (
          <div style={{ fontSize: '0.82rem', color: '#64748b', padding: '12px 0' }}>
            Complete trades in the Replay Workspace to populate your Daily P&amp;L Calendar.
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(145px, 1fr))', gap: 10 }}>
            {calendarDays.map((day) => {
              const isPos = day.pnl >= 0;
              return (
                <div
                  key={day.dateStr}
                  style={{
                    background: isPos ? 'rgba(34, 197, 94, 0.10)' : 'rgba(244, 63, 94, 0.10)',
                    border: `1px solid ${isPos ? 'rgba(34, 197, 94, 0.35)' : 'rgba(244, 63, 94, 0.35)'}`,
                    borderRadius: 8,
                    padding: '10px 12px',
                  }}
                >
                  <div style={{ fontSize: '0.74rem', color: '#94a3b8', marginBottom: 4 }}>{day.dateStr}</div>
                  <div style={{ fontSize: '1rem', fontWeight: 800, color: isPos ? '#4ade80' : '#f43f5e' }}>
                    {isPos ? '+$' : '-$'}{Math.abs(day.pnl).toFixed(2)}
                  </div>
                  <div style={{ fontSize: '0.7rem', color: '#cbd5e1', marginTop: 4 }}>
                    {day.count} {day.count === 1 ? 'Trade' : 'Trades'} &bull; {Math.round((day.wins / day.count) * 100)}% Win
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
