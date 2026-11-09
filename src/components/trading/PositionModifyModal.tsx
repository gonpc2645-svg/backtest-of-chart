import React, { useState } from 'react';
import { InstrumentSpecification, Position } from '../../services/trading/TradingTypes';

interface PositionModifyModalProps {
  position: Position | null;
  specification: InstrumentSpecification;
  onClose: () => void;
  onSaveProtection: (positionId: string, sl?: number, tp?: number) => { success: boolean; error?: string };
  onPartialClose: (positionId: string, quantity: number) => { success: boolean; error?: string };
}

export const PositionModifyModal: React.FC<PositionModifyModalProps> = ({
  position,
  specification,
  onClose,
  onSaveProtection,
  onPartialClose,
}) => {
  if (!position) return null;

  const [activeTab, setActiveTab] = useState<'PROTECTION' | 'PARTIAL_CLOSE'>('PROTECTION');
  const [stopLoss, setStopLoss] = useState<string>(position.stopLoss ? position.stopLoss.toString() : '');
  const [takeProfit, setTakeProfit] = useState<string>(position.takeProfit ? position.takeProfit.toString() : '');
  const [partialQty, setPartialQty] = useState<string>((position.quantity / 2).toFixed(specification.volumePrecision));
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSaveProtection = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    const sl = stopLoss ? parseFloat(stopLoss) : undefined;
    const tp = takeProfit ? parseFloat(takeProfit) : undefined;

    const res = onSaveProtection(position.id, sl, tp);
    if (!res.success) {
      setErrorMsg(res.error || 'Failed to update protection levels.');
    } else {
      onClose();
    }
  };

  const handleExecutePartialClose = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    const qty = parseFloat(partialQty) || 0;

    const res = onPartialClose(position.id, qty);
    if (!res.success) {
      setErrorMsg(res.error || 'Failed to execute partial close.');
    } else {
      onClose();
    }
  };

  return (
    <div className="trading-modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="modify-title">
      <div className="trading-modal-card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 id="modify-title" className="trading-modal-title">
            Manage Position #{position.id.slice(-6)}
          </h3>
          <button type="button" className="btn-action-sm" onClick={onClose}>
            &times;
          </button>
        </div>

        <div style={{ display: 'flex', gap: 6, borderBottom: '1px solid var(--border-subtle)', paddingBottom: 6 }}>
          <button
            type="button"
            className={`btn-action-sm ${activeTab === 'PROTECTION' ? 'active' : ''}`}
            onClick={() => {
              setActiveTab('PROTECTION');
              setErrorMsg(null);
            }}
          >
            Modify SL / TP
          </button>
          <button
            type="button"
            className={`btn-action-sm ${activeTab === 'PARTIAL_CLOSE' ? 'active' : ''}`}
            onClick={() => {
              setActiveTab('PARTIAL_CLOSE');
              setErrorMsg(null);
            }}
          >
            Partial Close
          </button>
        </div>

        {errorMsg && (
          <div className="order-unsupported-box">
            {errorMsg}
          </div>
        )}

        {activeTab === 'PROTECTION' ? (
          <form onSubmit={handleSaveProtection} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div className="order-field-group">
              <label className="order-field-label-row">
                <span>Stop Loss ({position.direction === 'BUY' ? '< ' + position.currentPrice : '> ' + position.currentPrice})</span>
              </label>
              <input
                type="number"
                step={specification.tickSize}
                value={stopLoss}
                onChange={(e) => setStopLoss(e.target.value)}
                placeholder="Leave empty to remove SL"
                className="order-input"
              />
            </div>

            <div className="order-field-group">
              <label className="order-field-label-row">
                <span>Take Profit ({position.direction === 'BUY' ? '> ' + position.currentPrice : '< ' + position.currentPrice})</span>
              </label>
              <input
                type="number"
                step={specification.tickSize}
                value={takeProfit}
                onChange={(e) => setTakeProfit(e.target.value)}
                placeholder="Leave empty to remove TP"
                className="order-input"
              />
            </div>

            <div className="trading-modal-actions">
              <button type="button" className="btn-action-sm" onClick={onClose}>
                Cancel
              </button>
              <button type="submit" className="order-submit-btn order-submit-btn--buy" style={{ padding: '6px 14px' }}>
                Save Protection
              </button>
            </div>
          </form>
        ) : (
          <form onSubmit={handleExecutePartialClose} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div className="order-field-group">
              <label className="order-field-label-row">
                <span>Quantity to Close (Open: {position.quantity} {specification.baseAsset})</span>
              </label>
              <input
                type="number"
                step={specification.quantityStep}
                min={specification.minQuantity}
                max={position.quantity}
                value={partialQty}
                onChange={(e) => setPartialQty(e.target.value)}
                className="order-input"
                required
              />
            </div>

            <div className="trading-modal-actions">
              <button type="button" className="btn-action-sm" onClick={onClose}>
                Cancel
              </button>
              <button type="submit" className="order-submit-btn order-submit-btn--sell" style={{ padding: '6px 14px' }}>
                Close Partial Quantity
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
