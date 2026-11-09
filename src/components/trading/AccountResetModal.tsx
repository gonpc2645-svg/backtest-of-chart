import React, { useState } from 'react';

interface AccountResetModalProps {
  isOpen: boolean;
  currentBalance: number;
  currentLeverage: number;
  onClose: () => void;
  onConfirmReset: (initialBalance: number, leverage: number) => void;
}

export const AccountResetModal: React.FC<AccountResetModalProps> = ({
  isOpen,
  currentBalance,
  currentLeverage,
  onClose,
  onConfirmReset,
}) => {
  const [balance, setBalance] = useState<string>(currentBalance.toString());
  const [leverage, setLeverage] = useState<number>(currentLeverage);

  if (!isOpen) return null;

  const handleConfirm = (e: React.FormEvent) => {
    e.preventDefault();
    const bal = parseFloat(balance) || 10000;
    onConfirmReset(bal, leverage);
    onClose();
  };

  return (
    <div className="trading-modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="reset-title">
      <div className="trading-modal-card">
        <h3 id="reset-title" className="trading-modal-title" style={{ color: '#f43f5e' }}>
          Reset Simulated Trading Account
        </h3>

        <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', lineHeight: 1.5, margin: 0 }}>
          This action will reset your account balance and remove all active open positions, pending orders, and trading
          history for this session. The historical market data and date range will remain unchanged.
        </p>

        <form onSubmit={handleConfirm} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div className="order-field-group">
            <label className="order-field-label-row">
              <span>Initial Balance ($ USD):</span>
            </label>
            <input
              type="number"
              min="100"
              max="10000000"
              step="100"
              value={balance}
              onChange={(e) => setBalance(e.target.value)}
              className="order-input"
              required
            />
          </div>

          <div className="order-field-group">
            <label className="order-field-label-row">
              <span>Account Leverage:</span>
            </label>
            <select
              value={leverage}
              onChange={(e) => setLeverage(Number(e.target.value))}
              className="order-input"
            >
              <option value={10}>1:10 (Conservative)</option>
              <option value={30}>1:30 (Retail Standard)</option>
              <option value={50}>1:50</option>
              <option value={100}>1:100 (Default)</option>
              <option value={200}>1:200</option>
              <option value={500}>1:500 (Aggressive)</option>
            </select>
          </div>

          <div className="trading-modal-actions" style={{ marginTop: 8 }}>
            <button type="button" className="btn-action-sm" onClick={onClose}>
              Cancel
            </button>
            <button
              type="submit"
              className="order-submit-btn order-submit-btn--sell"
              style={{ padding: '6px 16px', fontSize: '0.8rem' }}
            >
              Confirm Account Reset
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
