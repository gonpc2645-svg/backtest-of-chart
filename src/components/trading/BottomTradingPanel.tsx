import React, { useState } from 'react';
import {
  Order,
  Position,
  TradeRecord,
  TradingEvent,
} from '../../services/trading/TradingTypes';

interface BottomTradingPanelProps {
  positions: Position[];
  pendingOrders: Order[];
  completedOrders: Order[];
  tradeRecords: TradeRecord[];
  events: TradingEvent[];
  onOpenModifyModal: (position: Position) => void;
  onClosePosition: (positionId: string) => void;
  onCancelPendingOrder: (orderId: string) => void;
}

type TabKey = 'POSITIONS' | 'PENDING' | 'ORDERS_HISTORY' | 'TRADE_HISTORY' | 'EVENTS';

export const BottomTradingPanel: React.FC<BottomTradingPanelProps> = ({
  positions,
  pendingOrders,
  completedOrders,
  tradeRecords,
  events,
  onOpenModifyModal,
  onClosePosition,
  onCancelPendingOrder,
}) => {
  const [activeTab, setActiveTab] = useState<TabKey>('POSITIONS');

  const formatUtc = (ts: number): string => {
    if (!ts || isNaN(ts)) return '-';
    return new Date(ts).toISOString().replace('T', ' ').slice(0, 19);
  };

  const formatCurrency = (val: number): string => {
    return (val < 0 ? '-$' : '$') + Math.abs(val).toFixed(2);
  };

  return (
    <div className="bottom-trading-panel" aria-label="Trading Terminal Tabs">
      {/* Tabs Header */}
      <div className="trading-tabs-bar">
        <div className="trading-tabs-list" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'POSITIONS'}
            className={`trading-tab-btn ${activeTab === 'POSITIONS' ? 'active' : ''}`}
            onClick={() => setActiveTab('POSITIONS')}
          >
            <span>Positions</span>
            <span className="trading-tab-badge">{positions.length}</span>
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'PENDING'}
            className={`trading-tab-btn ${activeTab === 'PENDING' ? 'active' : ''}`}
            onClick={() => setActiveTab('PENDING')}
          >
            <span>Pending Orders</span>
            <span className="trading-tab-badge">{pendingOrders.length}</span>
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'TRADE_HISTORY'}
            className={`trading-tab-btn ${activeTab === 'TRADE_HISTORY' ? 'active' : ''}`}
            onClick={() => setActiveTab('TRADE_HISTORY')}
          >
            <span>Trade History</span>
            <span className="trading-tab-badge">{tradeRecords.length}</span>
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'ORDERS_HISTORY'}
            className={`trading-tab-btn ${activeTab === 'ORDERS_HISTORY' ? 'active' : ''}`}
            onClick={() => setActiveTab('ORDERS_HISTORY')}
          >
            <span>Orders History</span>
            <span className="trading-tab-badge">{completedOrders.length}</span>
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'EVENTS'}
            className={`trading-tab-btn ${activeTab === 'EVENTS' ? 'active' : ''}`}
            onClick={() => setActiveTab('EVENTS')}
          >
            <span>Event Ledger</span>
            <span className="trading-tab-badge">{events.length}</span>
          </button>
        </div>
      </div>

      {/* Tab Content */}
      <div className="trading-tab-content">
        {/* 1. POSITIONS TAB */}
        {activeTab === 'POSITIONS' && (
          positions.length === 0 ? (
            <div className="trading-table-empty">No active open positions. Place an order from the Order Entry panel.</div>
          ) : (
            <table className="trading-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Instrument</th>
                  <th>Direction</th>
                  <th>Quantity</th>
                  <th>Entry Price</th>
                  <th>Current Price</th>
                  <th>SL</th>
                  <th>TP</th>
                  <th>Floating P/L</th>
                  <th>Margin</th>
                  <th>Opened (UTC)</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {positions.map((pos) => (
                  <tr key={pos.id}>
                    <td>#{pos.id.slice(-6)}</td>
                    <td><strong>{pos.instrumentId.split(':')[1] || pos.instrumentId}</strong></td>
                    <td>
                      <span className={`badge-direction ${pos.direction === 'BUY' ? 'badge-direction--buy' : 'badge-direction--sell'}`}>
                        {pos.direction}
                      </span>
                    </td>
                    <td>{pos.quantity}</td>
                    <td>{pos.entryPrice.toFixed(2)}</td>
                    <td>{pos.currentPrice.toFixed(2)}</td>
                    <td style={{ color: pos.stopLoss ? '#f87171' : 'var(--text-dim)' }}>
                      {pos.stopLoss ? pos.stopLoss.toFixed(2) : '-'}
                    </td>
                    <td style={{ color: pos.takeProfit ? '#4ade80' : 'var(--text-dim)' }}>
                      {pos.takeProfit ? pos.takeProfit.toFixed(2) : '-'}
                    </td>
                    <td style={{ fontWeight: 700, color: pos.unrealizedPnL >= 0 ? '#22d3ee' : '#f43f5e' }}>
                      {formatCurrency(pos.unrealizedPnL)}
                    </td>
                    <td>${pos.usedMargin.toFixed(2)}</td>
                    <td>{formatUtc(pos.entryTimestamp)}</td>
                    <td>
                      <div style={{ display: 'flex', gap: 4 }}>
                        <button
                          type="button"
                          className="btn-action-sm"
                          onClick={() => onOpenModifyModal(pos)}
                          title="Modify SL/TP or Partial Close"
                        >
                          Modify
                        </button>
                        <button
                          type="button"
                          className="btn-action-sm btn-action-sm--close btn-position-close"
                          onClick={() => onClosePosition(pos.id)}
                          title="Close Position at Market Price"
                        >
                          Close
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )
        )}

        {/* 2. PENDING ORDERS TAB */}
        {activeTab === 'PENDING' && (
          pendingOrders.length === 0 ? (
            <div className="trading-table-empty">No pending Limit or Stop orders.</div>
          ) : (
            <table className="trading-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Instrument</th>
                  <th>Order Type</th>
                  <th>Direction</th>
                  <th>Quantity</th>
                  <th>Target Price</th>
                  <th>SL</th>
                  <th>TP</th>
                  <th>Created (UTC)</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {pendingOrders.map((ord) => (
                  <tr key={ord.id}>
                    <td>#{ord.id.slice(-6)}</td>
                    <td><strong>{ord.instrumentId.split(':')[1] || ord.instrumentId}</strong></td>
                    <td>{ord.orderType}</td>
                    <td>
                      <span className={`badge-direction ${ord.direction === 'BUY' ? 'badge-direction--buy' : 'badge-direction--sell'}`}>
                        {ord.direction}
                      </span>
                    </td>
                    <td>{ord.quantity}</td>
                    <td>{ord.requestedPrice.toFixed(2)}</td>
                    <td>{ord.stopLoss ? ord.stopLoss.toFixed(2) : '-'}</td>
                    <td>{ord.takeProfit ? ord.takeProfit.toFixed(2) : '-'}</td>
                    <td>{formatUtc(ord.createdAt)}</td>
                    <td>
                      <span style={{ color: '#fbbf24', fontWeight: 600 }}>PENDING</span>
                    </td>
                    <td>
                      <button
                        type="button"
                        className="btn-action-sm btn-action-sm--close"
                        onClick={() => onCancelPendingOrder(ord.id)}
                      >
                        Cancel
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )
        )}

        {/* 3. TRADE HISTORY TAB */}
        {activeTab === 'TRADE_HISTORY' && (
          tradeRecords.length === 0 ? (
            <div className="trading-table-empty">No completed trades recorded yet.</div>
          ) : (
            <table className="trading-table">
              <thead>
                <tr>
                  <th>Trade ID</th>
                  <th>Position</th>
                  <th>Instrument</th>
                  <th>Direction</th>
                  <th>Qty</th>
                  <th>Entry Price</th>
                  <th>Exit Price</th>
                  <th>Realized P/L</th>
                  <th>Reason</th>
                  <th>Opened (UTC)</th>
                  <th>Closed (UTC)</th>
                </tr>
              </thead>
              <tbody>
                {tradeRecords.slice().reverse().map((t) => (
                  <tr key={t.id}>
                    <td>#{t.id.slice(-6)}</td>
                    <td>#{t.positionId.slice(-6)}</td>
                    <td><strong>{t.instrumentId.split(':')[1] || t.instrumentId}</strong></td>
                    <td>
                      <span className={`badge-direction ${t.direction === 'BUY' ? 'badge-direction--buy' : 'badge-direction--sell'}`}>
                        {t.direction}
                      </span>
                    </td>
                    <td>{t.quantity}</td>
                    <td>{t.entryPrice.toFixed(2)}</td>
                    <td>{t.exitPrice.toFixed(2)}</td>
                    <td style={{ fontWeight: 700, color: t.pnl >= 0 ? '#22d3ee' : '#f43f5e' }}>
                      {formatCurrency(t.pnl)}
                    </td>
                    <td>
                      <span style={{
                        padding: '1px 5px',
                        borderRadius: 3,
                        fontSize: '0.68rem',
                        fontWeight: 600,
                        background: t.exitReason === 'TP' ? 'rgba(74, 222, 128, 0.15)' : t.exitReason === 'SL' || t.exitReason === 'STOP_OUT' ? 'rgba(239, 68, 68, 0.15)' : 'rgba(255, 255, 255, 0.05)',
                        color: t.exitReason === 'TP' ? '#4ade80' : t.exitReason === 'SL' || t.exitReason === 'STOP_OUT' ? '#f87171' : 'inherit'
                      }}>
                        {t.exitReason} {t.isAmbiguous ? '(Ambiguous)' : ''}
                      </span>
                    </td>
                    <td>{formatUtc(t.entryTime)}</td>
                    <td>{formatUtc(t.exitTime)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )
        )}

        {/* 4. ORDERS HISTORY TAB */}
        {activeTab === 'ORDERS_HISTORY' && (
          completedOrders.length === 0 ? (
            <div className="trading-table-empty">No orders history.</div>
          ) : (
            <table className="trading-table">
              <thead>
                <tr>
                  <th>Order ID</th>
                  <th>Instrument</th>
                  <th>Type</th>
                  <th>Direction</th>
                  <th>Quantity</th>
                  <th>Target Price</th>
                  <th>Fill/Execution Price</th>
                  <th>Created (UTC)</th>
                  <th>Status</th>
                  <th>Reason / Details</th>
                </tr>
              </thead>
              <tbody>
                {completedOrders.slice().reverse().map((ord) => (
                  <tr key={ord.id}>
                    <td>#{ord.id.slice(-6)}</td>
                    <td><strong>{ord.instrumentId.split(':')[1] || ord.instrumentId}</strong></td>
                    <td>{ord.orderType}</td>
                    <td>
                      <span className={`badge-direction ${ord.direction === 'BUY' ? 'badge-direction--buy' : 'badge-direction--sell'}`}>
                        {ord.direction}
                      </span>
                    </td>
                    <td>{ord.quantity}</td>
                    <td>{ord.requestedPrice.toFixed(2)}</td>
                    <td>{ord.filledPrice ? ord.filledPrice.toFixed(2) : '-'}</td>
                    <td>{formatUtc(ord.createdAt)}</td>
                    <td>
                      <span style={{
                        fontWeight: 700,
                        color: ord.status === 'FILLED' ? '#4ade80' : ord.status === 'CANCELLED' ? 'var(--text-dim)' : '#f87171'
                      }}>
                        {ord.status}
                      </span>
                    </td>
                    <td style={{ color: 'var(--text-dim)', fontSize: '0.7rem' }}>
                      {ord.rejectionReason || (ord.filledPrice ? `Filled at ${ord.filledPrice}` : '-')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )
        )}

        {/* 5. EVENT LEDGER TAB */}
        {activeTab === 'EVENTS' && (
          events.length === 0 ? (
            <div className="trading-table-empty">No trading events recorded yet.</div>
          ) : (
            <table className="trading-table">
              <thead>
                <tr>
                  <th>Event ID</th>
                  <th>Type</th>
                  <th>Timestamp (UTC)</th>
                  <th>Balance After</th>
                  <th>Equity After</th>
                  <th>Details</th>
                </tr>
              </thead>
              <tbody>
                {events.slice().reverse().map((ev) => (
                  <tr key={ev.id}>
                    <td>#{ev.id.slice(-6)}</td>
                    <td>
                      <span style={{ fontWeight: 700, color: '#38bdf8' }}>{ev.type}</span>
                    </td>
                    <td>{formatUtc(ev.timestamp)}</td>
                    <td>${ev.balanceAfter.toFixed(2)}</td>
                    <td>${ev.equityAfter.toFixed(2)}</td>
                    <td style={{ fontFamily: 'var(--font-mono)', fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                      {JSON.stringify(ev.details)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )
        )}
      </div>
    </div>
  );
};
