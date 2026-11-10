import React, { useMemo, useState } from 'react';
import {
  NormalizedTrade,
  SortOrder,
  TradeFilterCriteria,
  TradeSortField,
} from '../../services/analytics/AnalyticsTypes';
import {
  ReviewableTrade,
  TradeExecutionReviewModal,
  getStoredJournalMeta,
} from './TradeExecutionReviewModal';

interface TradeHistoryTableProps {
  trades: NormalizedTrade[];
  onTradeMetaUpdated?: () => void;
}

export const TradeHistoryTable: React.FC<TradeHistoryTableProps> = ({ trades, onTradeMetaUpdated }) => {
  const [filterCriteria, setFilterCriteria] = useState<TradeFilterCriteria>({
    result: 'ALL',
    direction: 'ALL',
    searchQuery: '',
  });

  const [sortField, setSortField] = useState<TradeSortField>('exitTime');
  const [sortOrder, setSortOrder] = useState<SortOrder>('DESC');
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(10);
  const [reviewingTrade, setReviewingTrade] = useState<ReviewableTrade | null>(null);
  const [, setMetaVersion] = useState<number>(0);

  const formatUtc = (ms: number) => {
    return new Date(ms).toISOString().replace('T', ' ').slice(0, 16);
  };

  const formatPrice = (p: number) => {
    if (!p || isNaN(p)) return '0.00';
    return p < 10 ? p.toFixed(5) : p < 200 ? p.toFixed(3) : p.toFixed(2);
  };

  const formatDuration = (ms: number) => {
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

  const filteredTrades = useMemo(() => {
    return trades.filter((t) => {
      if (filterCriteria.result === 'WINNERS' && t.pnl <= 0.000001) return false;
      if (filterCriteria.result === 'LOSERS' && t.pnl >= -0.000001) return false;
      if (filterCriteria.result === 'BREAKEVEN' && Math.abs(t.pnl) > 0.000001) return false;

      if (filterCriteria.direction !== 'ALL' && t.direction !== filterCriteria.direction) {
        return false;
      }

      if (filterCriteria.searchQuery) {
        const query = filterCriteria.searchQuery.toLowerCase();
        const meta = getStoredJournalMeta(t.id);
        const matchId = t.id.toLowerCase().includes(query);
        const matchInst = t.instrumentId.toLowerCase().includes(query);
        const matchTag = meta.setupTag.toLowerCase().includes(query) || meta.moodTag.toLowerCase().includes(query);
        if (!matchId && !matchInst && !matchTag) return false;
      }

      return true;
    });
  }, [trades, filterCriteria]);

  const sortedTrades = useMemo(() => {
    const list = [...filteredTrades];
    list.sort((a, b) => {
      let valA: number = 0;
      let valB: number = 0;

      switch (sortField) {
        case 'exitTime':
          valA = a.exitTime;
          valB = b.exitTime;
          break;
        case 'entryTime':
          valA = a.entryTime;
          valB = b.entryTime;
          break;
        case 'pnl':
          valA = a.pnl;
          valB = b.pnl;
          break;
        case 'quantity':
          valA = a.quantity;
          valB = b.quantity;
          break;
        case 'durationMs':
          valA = a.durationMs;
          valB = b.durationMs;
          break;
        case 'returnPct':
          valA = a.returnPct;
          valB = b.returnPct;
          break;
      }

      if (valA === valB) return 0;
      const res = valA > valB ? 1 : -1;
      return sortOrder === 'ASC' ? res : -res;
    });
    return list;
  }, [filteredTrades, sortField, sortOrder]);

  const totalPages = Math.max(1, Math.ceil(sortedTrades.length / pageSize));
  const pageIndex = Math.min(currentPage, totalPages);
  const paginatedTrades = sortedTrades.slice((pageIndex - 1) * pageSize, pageIndex * pageSize);

  const handleSortClick = (field: TradeSortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'ASC' ? 'DESC' : 'ASC');
    } else {
      setSortField(field);
      setSortOrder('DESC');
    }
  };

  return (
    <div className="trade-table-wrapper">
      {/* Table Toolbar */}
      <div className="trade-table-toolbar">
        <div className="trade-filter-group">
          <span style={{ fontSize: '0.75rem', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 600 }}>
            Result:
          </span>
          {(['ALL', 'WINNERS', 'LOSERS', 'BREAKEVEN'] as const).map((res) => (
            <button
              key={res}
              type="button"
              className={`trade-filter-btn ${filterCriteria.result === res ? 'active' : ''}`}
              onClick={() => {
                setFilterCriteria((prev) => ({ ...prev, result: res }));
                setCurrentPage(1);
              }}
            >
              {res}
            </button>
          ))}

          <span style={{ fontSize: '0.75rem', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 600, marginLeft: '0.5rem' }}>
            Direction:
          </span>
          {(['ALL', 'BUY', 'SELL'] as const).map((dir) => (
            <button
              key={dir}
              type="button"
              className={`trade-filter-btn ${filterCriteria.direction === dir ? 'active' : ''}`}
              onClick={() => {
                setFilterCriteria((prev) => ({ ...prev, direction: dir }));
                setCurrentPage(1);
              }}
            >
              {dir}
            </button>
          ))}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <input
            type="text"
            className="trade-search-input"
            placeholder="Search ID, Pair, or Setup Tag..."
            value={filterCriteria.searchQuery}
            onChange={(e) => {
              setFilterCriteria((prev) => ({ ...prev, searchQuery: e.target.value }));
              setCurrentPage(1);
            }}
          />

          <select
            className="trade-search-input"
            style={{ width: 'auto' }}
            value={pageSize}
            onChange={(e) => {
              setPageSize(Number(e.target.value));
              setCurrentPage(1);
            }}
          >
            <option value={10}>10 per page</option>
            <option value={25}>25 per page</option>
            <option value={50}>50 per page</option>
          </select>
        </div>
      </div>

      {/* Table View */}
      <div className="table-responsive">
        <table className="analytics-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Instrument</th>
              <th>Direction</th>
              <th onClick={() => handleSortClick('quantity')}>
                Quantity {sortField === 'quantity' ? (sortOrder === 'ASC' ? '↑' : '↓') : ''}
              </th>
              <th>Entry Price</th>
              <th>Exit Price</th>
              <th onClick={() => handleSortClick('entryTime')}>
                Entry (UTC) {sortField === 'entryTime' ? (sortOrder === 'ASC' ? '↑' : '↓') : ''}
              </th>
              <th onClick={() => handleSortClick('durationMs')}>
                Duration {sortField === 'durationMs' ? (sortOrder === 'ASC' ? '↑' : '↓') : ''}
              </th>
              <th onClick={() => handleSortClick('pnl')}>
                Net P/L ($) {sortField === 'pnl' ? (sortOrder === 'ASC' ? '↑' : '↓') : ''}
              </th>
              <th onClick={() => handleSortClick('returnPct')}>
                Return (%) {sortField === 'returnPct' ? (sortOrder === 'ASC' ? '↑' : '↓') : ''}
              </th>
              <th>Exit Reason</th>
              <th>Playbook / Grade</th>
              <th>R-Multiple</th>
              <th>Execution Review</th>
            </tr>
          </thead>
          <tbody>
            {paginatedTrades.length === 0 ? (
              <tr>
                <td colSpan={14} style={{ textAlign: 'center', padding: '2rem 1rem', color: '#64748b' }}>
                  No closed trade records match the selected filter criteria.
                </td>
              </tr>
            ) : (
              paginatedTrades.map((t) => {
                const meta = getStoredJournalMeta(t.id);
                return (
                  <tr key={t.id}>
                    <td>#{t.id.slice(-6)}</td>
                    <td>
                      <strong>{t.instrumentId.split(':')[1] || t.instrumentId}</strong>
                    </td>
                    <td>
                      <span
                        style={{
                          padding: '0.2rem 0.45rem',
                          borderRadius: 3,
                          fontSize: '0.75rem',
                          fontWeight: 700,
                          background: t.direction === 'BUY' ? 'rgba(34, 211, 238, 0.15)' : 'rgba(244, 63, 94, 0.15)',
                          color: t.direction === 'BUY' ? '#22d3ee' : '#f43f5e',
                        }}
                      >
                        {t.direction}
                      </span>
                    </td>
                    <td>{t.quantity}</td>
                    <td>{formatPrice(t.entryPrice)}</td>
                    <td>{formatPrice(t.exitPrice)}</td>
                    <td>{formatUtc(t.entryTime)}</td>
                    <td>{formatDuration(t.durationMs)}</td>
                    <td
                      style={{
                        fontWeight: 700,
                        color: t.pnl > 0 ? '#22d3ee' : t.pnl < 0 ? '#f43f5e' : '#cbd5e1',
                      }}
                    >
                      {t.pnl >= 0 ? '+$' : '-$'}
                      {Math.abs(t.pnl).toFixed(2)}
                    </td>
                    <td style={{ color: t.returnPct >= 0 ? '#22d3ee' : '#f43f5e' }}>
                      {t.returnPct >= 0 ? '+' : ''}
                      {t.returnPct.toFixed(2)}%
                    </td>
                    <td>
                      <span
                        style={{
                          fontSize: '0.75rem',
                          padding: '0.15rem 0.4rem',
                          borderRadius: 3,
                          background: '#1f2937',
                          color: '#9ca3af',
                        }}
                      >
                        {t.exitReason}
                      </span>
                    </td>
                    <td>
                      <span style={{ fontSize: '0.75rem', color: '#38bdf8', fontWeight: 600 }}>
                        [{meta.grade}] {meta.setupTag}
                      </span>
                    </td>
                    <td
                      style={{
                        fontWeight: 600,
                        color:
                          t.rMultiple !== undefined && t.rMultiple > 0
                            ? '#22d3ee'
                            : t.rMultiple !== undefined && t.rMultiple < 0
                            ? '#f43f5e'
                            : '#9ca3af',
                      }}
                    >
                      {t.rMultiple !== undefined ? `${t.rMultiple >= 0 ? '+' : ''}${t.rMultiple.toFixed(2)}R` : '-'}
                    </td>
                    <td>
                      <button
                        type="button"
                        className="trade-filter-btn active"
                        style={{ cursor: 'pointer', fontSize: '0.72rem' }}
                        onClick={() =>
                          setReviewingTrade({
                            id: t.id,
                            instrumentId: t.instrumentId,
                            direction: t.direction,
                            quantity: t.quantity,
                            entryPrice: t.entryPrice,
                            exitPrice: t.exitPrice,
                            pnl: t.pnl,
                            entryTime: t.entryTime,
                            exitTime: t.exitTime,
                            exitReason: t.exitReason,
                          })
                        }
                      >
                        📈 Review &amp; Tag
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Table Pagination */}
      <div className="table-pagination">
        <div>
          Showing {sortedTrades.length > 0 ? (pageIndex - 1) * pageSize + 1 : 0} to{' '}
          {Math.min(pageIndex * pageSize, sortedTrades.length)} of {sortedTrades.length} trades
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <button
            type="button"
            className="pagination-btn"
            disabled={pageIndex <= 1}
            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
          >
            Previous
          </button>
          <span>
            Page {pageIndex} of {totalPages}
          </span>
          <button
            type="button"
            className="pagination-btn"
            disabled={pageIndex >= totalPages}
            onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
          >
            Next
          </button>
        </div>
      </div>

      {/* Trade Execution Review & Tagging Modal */}
      <TradeExecutionReviewModal
        trade={reviewingTrade}
        onClose={() => setReviewingTrade(null)}
        onMetaSaved={() => {
          setMetaVersion((v) => v + 1);
          if (onTradeMetaUpdated) onTradeMetaUpdated();
        }}
      />
    </div>
  );
};
