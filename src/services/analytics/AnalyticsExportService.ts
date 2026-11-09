import { SessionAnalyticsReport } from './AnalyticsTypes';

export class AnalyticsExportService {
  /**
   * Generates a CSV containing all normalized closed trades.
   */
  public static exportTradesToCsv(report: SessionAnalyticsReport): string {
    const headers = [
      'Trade ID',
      'Position ID',
      'Instrument',
      'Direction',
      'Quantity',
      'Entry Time (UTC)',
      'Exit Time (UTC)',
      'Entry Price',
      'Exit Price',
      'Net P/L ($)',
      'Return (%)',
      'Holding Duration (s)',
      'Exit Reason',
      'Initial SL',
      'Initial Risk ($)',
      'R-Multiple',
    ];

    const rows = report.closedTrades.map((t) => [
      `"${t.id}"`,
      `"${t.positionId}"`,
      `"${t.instrumentId}"`,
      t.direction,
      t.quantity,
      new Date(t.entryTime).toISOString(),
      new Date(t.exitTime).toISOString(),
      t.entryPrice.toFixed(4),
      t.exitPrice.toFixed(4),
      t.pnl.toFixed(2),
      t.returnPct.toFixed(2),
      Math.round(t.durationMs / 1000),
      t.exitReason,
      t.initialStopLoss !== undefined ? t.initialStopLoss.toFixed(4) : '',
      t.initialRisk !== undefined ? t.initialRisk.toFixed(2) : '',
      t.rMultiple !== undefined ? t.rMultiple.toFixed(2) : '',
    ]);

    return [headers.join(','), ...rows.map((r) => r.join(','))].join('\r\n');
  }

  /**
   * Generates a CSV summarizing the primary performance metrics.
   */
  public static exportSummaryToCsv(report: SessionAnalyticsReport): string {
    const o = report.overview;
    const s = report.streaks;

    const data: [string, string | number][] = [
      ['Session ID', report.sessionId],
      ['Instrument', report.instrumentId],
      ['Timeframe', report.timeframe],
      ['Generated At (UTC)', new Date(report.generatedAtMs).toISOString()],
      ['Initial Balance ($)', o.initialBalance.toFixed(2)],
      ['Current Balance ($)', o.currentBalance.toFixed(2)],
      ['Current Equity ($)', o.currentEquity.toFixed(2)],
      ['Net Realized P/L ($)', o.netPnL.toFixed(2)],
      ['Gross Profit ($)', o.grossProfit.toFixed(2)],
      ['Gross Loss ($)', o.grossLoss.toFixed(2)],
      ['Total Closed Trades', o.totalClosedTrades],
      ['Winning Trades', o.winningTrades],
      ['Losing Trades', o.losingTrades],
      ['Breakeven Trades', o.breakevenTrades],
      ['Win Rate (%)', o.winRate !== null ? o.winRate.toFixed(2) : 'N/A'],
      ['Profit Factor', o.profitFactor !== null ? (o.profitFactor === Infinity ? 'Infinity (No Losses)' : o.profitFactor.toFixed(2)) : 'N/A'],
      ['Expectancy ($/trade)', o.expectancy !== null ? o.expectancy.toFixed(2) : 'N/A'],
      ['Average Win ($)', o.averageWin !== null ? o.averageWin.toFixed(2) : 'N/A'],
      ['Average Loss ($)', o.averageLoss !== null ? o.averageLoss.toFixed(2) : 'N/A'],
      ['Largest Win ($)', o.largestWin !== null ? o.largestWin.toFixed(2) : 'N/A'],
      ['Largest Loss ($)', o.largestLoss !== null ? o.largestLoss.toFixed(2) : 'N/A'],
      ['Maximum Drawdown ($)', o.maxDrawdownAmount.toFixed(2)],
      ['Maximum Drawdown (%)', o.maxDrawdownPct.toFixed(2)],
      ['Current Drawdown ($)', o.currentDrawdownAmount.toFixed(2)],
      ['Current Drawdown (%)', o.currentDrawdownPct.toFixed(2)],
      ['Recovery Factor', o.recoveryFactor !== null ? (o.recoveryFactor === Infinity ? 'Infinity' : o.recoveryFactor.toFixed(2)) : 'N/A'],
      ['Max Consecutive Wins', s.maxConsecutiveWins],
      ['Max Consecutive Losses', s.maxConsecutiveLosses],
      ['Current Streak', `${s.currentStreakCount} ${s.currentStreakType}`],
    ];

    const lines = data.map(([k, v]) => `"${k}","${v}"`);
    return ['Metric,Value', ...lines].join('\r\n');
  }

  /**
   * Generates a CSV for periodic performance (Daily, Weekly, or Monthly).
   */
  public static exportPeriodicToCsv(
    report: SessionAnalyticsReport,
    period: 'daily' | 'weekly' | 'monthly'
  ): string {
    const list =
      period === 'daily'
        ? report.dailyPerformance
        : period === 'weekly'
        ? report.weeklyPerformance
        : report.monthlyPerformance;

    const headers = [
      'Period',
      'Closed Trades',
      'Net P/L ($)',
      'Gross Profit ($)',
      'Gross Loss ($)',
      'Wins',
      'Losses',
      'Breakeven',
      'Win Rate (%)',
    ];

    const rows = list.map((r) => [
      `"${r.periodLabel}"`,
      r.tradeCount,
      r.netPnL.toFixed(2),
      r.grossProfit.toFixed(2),
      r.grossLoss.toFixed(2),
      r.winCount,
      r.lossCount,
      r.breakevenCount,
      r.winRate !== null ? r.winRate.toFixed(2) : 'N/A',
    ]);

    return [headers.join(','), ...rows.map((r) => r.join(','))].join('\r\n');
  }

  /**
   * Generates a structured JSON string of the complete analytics report.
   */
  public static exportReportToJson(report: SessionAnalyticsReport): string {
    return JSON.stringify(report, null, 2);
  }

  /**
   * Browser file download helper.
   */
  public static downloadFile(content: string, filename: string, mimeType: string): void {
    if (typeof window === 'undefined') return;

    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }
}
