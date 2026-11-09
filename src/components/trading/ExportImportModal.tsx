import React, { useState } from 'react';
import { TradingPersistence } from '../../services/trading/TradingPersistence';
import { TradingState } from '../../services/trading/TradingTypes';

interface ExportImportModalProps {
  isOpen: boolean;
  sessionId: string;
  tradingState: TradingState;
  onClose: () => void;
  onImportState: (state: TradingState) => void;
}

export const ExportImportModal: React.FC<ExportImportModalProps> = ({
  isOpen,
  sessionId,
  tradingState,
  onClose,
  onImportState,
}) => {
  const [importJsonText, setImportJsonText] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleExportJson = () => {
    TradingPersistence.exportSessionJson(sessionId, tradingState);
  };

  const handleExportCsv = () => {
    TradingPersistence.exportTradesCsv(sessionId, tradingState.tradeRecords);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = String(event.target?.result || '');
        const validatedState = TradingPersistence.parseAndValidateImportJson(text);
        onImportState(validatedState);
        onClose();
      } catch (err) {
        setErrorMsg(err instanceof Error ? err.message : String(err));
      }
    };
    reader.readAsText(file);
  };

  const handleImportText = () => {
    try {
      setErrorMsg(null);
      const validatedState = TradingPersistence.parseAndValidateImportJson(importJsonText);
      onImportState(validatedState);
      onClose();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : String(err));
    }
  };

  return (
    <div className="trading-modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="export-title">
      <div className="trading-modal-card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 id="export-title" className="trading-modal-title">
            Session Export / Import &amp; CSV
          </h3>
          <button type="button" className="btn-action-sm" onClick={onClose}>
            &times;
          </button>
        </div>

        <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: 0 }}>
          Backtest of Chart stores sessions locally in your browser's IndexedDB. Use these options to backup your
          trading session, export your trade history to CSV, or import a saved session.
        </p>

        {errorMsg && <div className="order-unsupported-box">{errorMsg}</div>}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ display: 'flex', gap: 10 }}>
            <button
              type="button"
              className="btn-action-sm"
              style={{ flex: 1, padding: '8px' }}
              onClick={handleExportJson}
            >
              Export Session (JSON)
            </button>
            <button
              type="button"
              className="btn-action-sm"
              style={{ flex: 1, padding: '8px' }}
              onClick={handleExportCsv}
              disabled={tradingState.tradeRecords.length === 0}
            >
              Export Trades ({tradingState.tradeRecords.length}) (CSV)
            </button>
          </div>

          <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: 12 }}>
            <span style={{ fontSize: '0.78rem', color: 'var(--text-primary)', fontWeight: 600 }}>
              Import Saved Session:
            </span>
            <input
              type="file"
              accept=".json"
              onChange={handleFileSelect}
              style={{ display: 'block', marginTop: 8, fontSize: '0.78rem' }}
            />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span style={{ fontSize: '0.72rem', color: 'var(--text-dim)' }}>Or paste JSON payload below:</span>
            <textarea
              rows={3}
              className="order-input"
              value={importJsonText}
              onChange={(e) => setImportJsonText(e.target.value)}
              placeholder="Paste exported session JSON..."
              style={{ resize: 'vertical', fontSize: '0.72rem' }}
            />
            {importJsonText && (
              <button
                type="button"
                className="btn-action-sm"
                onClick={handleImportText}
                style={{ alignSelf: 'flex-end', marginTop: 4 }}
              >
                Load Pasted Session
              </button>
            )}
          </div>
        </div>

        <div className="trading-modal-actions">
          <button type="button" className="btn-action-sm" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
