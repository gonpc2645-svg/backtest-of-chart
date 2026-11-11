import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { AnalyticsExportService } from '../../services/analytics/AnalyticsExportService';
import { SessionAnalyticsReport } from '../../services/analytics/AnalyticsTypes';

interface AnalyticsHeaderProps {
  report: SessionAnalyticsReport;
  onRefresh: () => void;
}

export const AnalyticsHeader: React.FC<AnalyticsHeaderProps> = ({ report, onRefresh }) => {
  const [showExportMenu, setShowExportMenu] = useState(false);

  const formatDateUtc = (ms: number) => {
    return new Date(ms).toISOString().replace('T', ' ').slice(0, 19) + ' UTC';
  };

  const handleExportTrades = () => {
    const csv = AnalyticsExportService.exportTradesToCsv(report);
    AnalyticsExportService.downloadFile(csv, `trades_${report.sessionId}.csv`, 'text/csv');
    setShowExportMenu(false);
  };

  const handleExportSummary = () => {
    const csv = AnalyticsExportService.exportSummaryToCsv(report);
    AnalyticsExportService.downloadFile(csv, `summary_${report.sessionId}.csv`, 'text/csv');
    setShowExportMenu(false);
  };

  const handleExportDaily = () => {
    const csv = AnalyticsExportService.exportPeriodicToCsv(report, 'daily');
    AnalyticsExportService.downloadFile(csv, `daily_${report.sessionId}.csv`, 'text/csv');
    setShowExportMenu(false);
  };

  const handleExportJson = () => {
    const json = AnalyticsExportService.exportReportToJson(report);
    AnalyticsExportService.downloadFile(json, `report_${report.sessionId}.json`, 'application/json');
    setShowExportMenu(false);
  };

  const handlePrint = () => {
    if (typeof window !== 'undefined') {
      window.print();
    }
  };

  return (
    <header className="analytics-header">
      <div className="analytics-header__left">
        <Link to={`/backtest/replay/${report.sessionId}`} className="analytics-header__back-btn">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
          Back to Replay Workspace
        </Link>

        <div className="analytics-header__title-row">
          <h1 className="analytics-header__title">
            Performance <span className="tc-serif-accent">Analytics.</span>
          </h1>
          <span className="analytics-header__badge analytics-header__badge--status">
            {report.replayStatus}
          </span>
          <span className="analytics-header__badge" style={{ background: '#1e293b', color: '#94a3b8' }}>
            {report.executionAssumptions.priceBasis} Price Basis
          </span>
        </div>

        <div className="analytics-header__meta">
          <div className="analytics-header__meta-item">
            Instrument: <strong>{report.instrumentId}</strong>
          </div>
          <div className="analytics-header__meta-item">
            Timeframe: <strong>{report.timeframe}</strong>
          </div>
          <div className="analytics-header__meta-item">
            Replay Cursor: <strong>{formatDateUtc(report.replayCursorMs)}</strong>
          </div>
          <div className="analytics-header__meta-item">
            Range: <strong>{formatDateUtc(report.historicalStartMs)}</strong> to <strong>{formatDateUtc(report.historicalEndMs)}</strong>
          </div>
        </div>
      </div>

      <div className="analytics-header__actions">
        <button
          type="button"
          className="btn-analytics"
          onClick={onRefresh}
          title="Recalculate analytics based on latest trading records"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67" />
          </svg>
          Recalculate
        </button>

        <div style={{ position: 'relative' }}>
          <button
            type="button"
            className="btn-analytics btn-analytics--primary"
            onClick={() => setShowExportMenu(!showExportMenu)}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" />
            </svg>
            Export Report
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M6 9l6 6 6-6" />
            </svg>
          </button>

          {showExportMenu && (
            <div
              style={{
                position: 'absolute',
                top: '100%',
                right: 0,
                marginTop: 6,
                background: '#111827',
                border: '1px solid #374151',
                borderRadius: 6,
                boxShadow: '0 10px 25px -5px rgba(0,0,0,0.5)',
                zIndex: 50,
                minWidth: 190,
                overflow: 'hidden',
              }}
            >
              <button
                type="button"
                className="btn-analytics"
                style={{ width: '100%', border: 'none', borderRadius: 0, justifyContent: 'flex-start' }}
                onClick={handleExportTrades}
              >
                Export Closed Trades (CSV)
              </button>
              <button
                type="button"
                className="btn-analytics"
                style={{ width: '100%', border: 'none', borderRadius: 0, justifyContent: 'flex-start' }}
                onClick={handleExportSummary}
              >
                Export Performance Summary (CSV)
              </button>
              <button
                type="button"
                className="btn-analytics"
                style={{ width: '100%', border: 'none', borderRadius: 0, justifyContent: 'flex-start' }}
                onClick={handleExportDaily}
              >
                Export Daily Breakdown (CSV)
              </button>
              <button
                type="button"
                className="btn-analytics"
                style={{ width: '100%', border: 'none', borderRadius: 0, justifyContent: 'flex-start' }}
                onClick={handleExportJson}
              >
                Export Complete Session (JSON)
              </button>
            </div>
          )}
        </div>

        <button
          type="button"
          className="btn-analytics"
          onClick={handlePrint}
          title="Print to PDF or paper document"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="6 9 6 2 18 2 18 9" />
            <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
            <rect x="6" y="14" width="12" height="8" />
          </svg>
          Print / PDF
        </button>
      </div>
    </header>
  );
};
