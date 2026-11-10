import React, { useState, useEffect } from 'react';
import {
  CreateOrderRequest,
  ExecutionAssumptions,
  InstrumentSpecification,
  OrderDirection,
  OrderType,
  TradingAccount,
} from '../../services/trading/TradingTypes';
import { PositionCalculator } from '../../services/trading/PositionCalculator';
import { ExecutionCostModel } from '../../services/trading/ExecutionCostModel';

export type ChartPickTarget = 'NONE' | 'ENTRY' | 'SL' | 'TP';

export interface ExternalOrderPreset {
  direction: OrderDirection;
  entryPrice: number;
  stopLoss: number;
  takeProfit: number;
  timestamp: number;
}

interface OrderEntryPanelProps {
  specification: InstrumentSpecification;
  account: TradingAccount;
  currentPrice: number;
  executionAssumptions: ExecutionAssumptions;
  onSubmitOrder: (req: CreateOrderRequest) => { success: boolean; error?: string };
  chartPickTarget?: ChartPickTarget;
  onRequestChartPick?: (target: ChartPickTarget) => void;
  pickedChartPrice?: { target: ChartPickTarget; price: number; ts: number } | null;
  externalPreset?: ExternalOrderPreset | null;
}

const RISK_PRESETS = [0.5, 1.0, 2.0, 3.0];
const RRR_PRESETS = [1.5, 2.0, 3.0, 5.0];

export const OrderEntryPanel: React.FC<OrderEntryPanelProps> = ({
  specification,
  account,
  currentPrice,
  executionAssumptions,
  onSubmitOrder,
  chartPickTarget = 'NONE',
  onRequestChartPick,
  pickedChartPrice,
  externalPreset,
}) => {
  const [direction, setDirection] = useState<OrderDirection>('BUY');
  const [orderType, setOrderType] = useState<OrderType>('MARKET');
  const [quantity, setQuantity] = useState<string>('0.1');
  const [requestedPrice, setRequestedPrice] = useState<string>('');
  const [enableSL, setEnableSL] = useState<boolean>(true);
  const [stopLoss, setStopLoss] = useState<string>('');
  const [enableTP, setEnableTP] = useState<boolean>(true);
  const [takeProfit, setTakeProfit] = useState<string>('');
  const [riskPct, setRiskPct] = useState<string>('1.0');
  const [autoSizeByRisk, setAutoSizeByRisk] = useState<boolean>(true);
  const [showDrawdownSim, setShowDrawdownSim] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const fmt = (val: number) => val.toFixed(specification.pricePrecision);

  // Sync default requested price and default SL/TP when symbol/price initializes
  useEffect(() => {
    if (currentPrice > 0 && !requestedPrice) {
      setRequestedPrice(fmt(currentPrice));
      const defaultDist = currentPrice * 0.003;
      const sl = direction === 'BUY' ? currentPrice - defaultDist : currentPrice + defaultDist;
      const tp = direction === 'BUY' ? currentPrice + defaultDist * 2.5 : currentPrice - defaultDist * 2.5;
      if (!stopLoss) setStopLoss(fmt(sl));
      if (!takeProfit) setTakeProfit(fmt(tp));
    }
  }, [currentPrice]);

  // Apply external preset from Long/Short R:R drawing tool on chart
  useEffect(() => {
    if (!externalPreset) return;
    setDirection(externalPreset.direction);
    setEnableSL(true);
    setEnableTP(true);
    setStopLoss(fmt(externalPreset.stopLoss));
    setTakeProfit(fmt(externalPreset.takeProfit));
    if (orderType !== 'MARKET') {
      setRequestedPrice(fmt(externalPreset.entryPrice));
    }
  }, [externalPreset]);

  // Apply price clicked directly on chart
  useEffect(() => {
    if (!pickedChartPrice || pickedChartPrice.target === 'NONE') return;
    const pStr = fmt(pickedChartPrice.price);
    if (pickedChartPrice.target === 'SL') {
      setEnableSL(true);
      setStopLoss(pStr);
    } else if (pickedChartPrice.target === 'TP') {
      setEnableTP(true);
      setTakeProfit(pStr);
    } else if (pickedChartPrice.target === 'ENTRY') {
      if (orderType === 'MARKET') setOrderType('LIMIT');
      setRequestedPrice(pStr);
    }
  }, [pickedChartPrice]);

  const numReqPrice = orderType === 'MARKET' ? currentPrice : parseFloat(requestedPrice) || currentPrice;
  const numSL = enableSL && parseFloat(stopLoss) > 0 ? parseFloat(stopLoss) : undefined;
  const numTP = enableTP && parseFloat(takeProfit) > 0 ? parseFloat(takeProfit) : undefined;
  const numRiskPct = Math.max(0.1, parseFloat(riskPct) || 1.0);
  const riskDollarAmount = (account.balance * numRiskPct) / 100;

  // Calculate recommended quantity from Risk % and SL distance
  const slDistance = numSL && numReqPrice > 0 ? Math.abs(numReqPrice - numSL) : 0;
  const rawRecommendedQty =
    slDistance > 0 && specification.contractSize > 0
      ? riskDollarAmount / (slDistance * specification.contractSize)
      : 0;

  const step = specification.quantityStep || 0.01;
  const recommendedQty =
    rawRecommendedQty > 0
      ? Math.max(
          specification.minQuantity,
          Number((Math.floor(rawRecommendedQty / step) * step).toFixed(specification.volumePrecision))
        )
      : specification.minQuantity;

  useEffect(() => {
    if (autoSizeByRisk && slDistance > 0 && recommendedQty > 0) {
      setQuantity(String(recommendedQty));
    }
  }, [autoSizeByRisk, recommendedQty, slDistance]);

  const numQty = parseFloat(quantity) || 0;

  // Apply R:R preset button (e.g. 1:2, 1:3, 1:5)
  const handleApplyRrr = (rrr: number) => {
    if (!numSL || numReqPrice <= 0) return;
    const dist = Math.abs(numReqPrice - numSL);
    const targetTp = direction === 'BUY' ? numReqPrice + dist * rrr : numReqPrice - dist * rrr;
    setEnableTP(true);
    setTakeProfit(fmt(targetTp));
  };

  // Auto-flip SL & TP when switching BUY <-> SELL
  const handleSwitchDirection = (newDir: OrderDirection) => {
    if (newDir === direction) return;
    setDirection(newDir);
    setErrorMessage(null);
    if (numReqPrice > 0 && numSL) {
      const slDist = Math.abs(numReqPrice - numSL);
      const nextSl = newDir === 'BUY' ? numReqPrice - slDist : numReqPrice + slDist;
      setStopLoss(fmt(nextSl));
    }
    if (numReqPrice > 0 && numTP) {
      const tpDist = Math.abs(numReqPrice - numTP);
      const nextTp = newDir === 'BUY' ? numReqPrice + tpDist : numReqPrice - tpDist;
      setTakeProfit(fmt(nextTp));
    }
  };

  const estimatedExecPrice =
    currentPrice > 0
      ? ExecutionCostModel.getExecutablePrice(direction, numReqPrice, executionAssumptions)
      : 0;

  const estimatedMargin = PositionCalculator.calculateRequiredMargin(
    numQty,
    estimatedExecPrice,
    account.leverage,
    specification.contractSize
  );

  const liveRrr =
    numSL && numTP && Math.abs(numReqPrice - numSL) > 0
      ? Math.abs(numTP - numReqPrice) / Math.abs(numReqPrice - numSL)
      : null;

  const potentialLossUsd =
    numSL && numReqPrice > 0 ? Math.abs(numReqPrice - numSL) * numQty * specification.contractSize : 0;
  const potentialProfitUsd =
    numTP && numReqPrice > 0 ? Math.abs(numTP - numReqPrice) * numQty * specification.contractSize : 0;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!specification.tradingSupported) {
      setErrorMessage(specification.unsupportedReason || 'Trading is not supported for this instrument.');
      return;
    }

    if (numQty <= 0) {
      setErrorMessage('Please enter a valid quantity.');
      return;
    }

    const res = onSubmitOrder({
      direction,
      orderType,
      quantity: numQty,
      requestedPrice: orderType !== 'MARKET' ? numReqPrice : undefined,
      stopLoss: numSL,
      takeProfit: numTP,
    });

    if (!res.success) {
      setErrorMessage(res.error || 'Failed to place order.');
    } else {
      setErrorMessage(null);
    }
  };

  return (
    <div className="order-entry-panel">
      <div className="order-entry-header">
        <h3 className="order-entry-title">Smart Order &amp; Risk Sizer</h3>
        <span className="badge-direction badge-direction--buy">
          {specification.provider} &bull; {specification.priceBasis}
        </span>
      </div>

      {/* Buy / Sell Direction Selector */}
      <div className="order-direction-tabs">
        <button
          type="button"
          className={`order-direction-btn order-direction-btn--buy ${direction === 'BUY' ? 'active' : ''}`}
          onClick={() => handleSwitchDirection('BUY')}
        >
          <span>BUY / LONG</span>
          <small style={{ fontSize: '0.68rem', opacity: 0.85 }}>
            Ask: {currentPrice ? (currentPrice + executionAssumptions.spreadPipsOrPts / 2).toFixed(specification.pricePrecision) : '-'}
          </small>
        </button>
        <button
          type="button"
          className={`order-direction-btn order-direction-btn--sell ${direction === 'SELL' ? 'active' : ''}`}
          onClick={() => handleSwitchDirection('SELL')}
        >
          <span>SELL / SHORT</span>
          <small style={{ fontSize: '0.68rem', opacity: 0.85 }}>
            Bid: {currentPrice ? (currentPrice - executionAssumptions.spreadPipsOrPts / 2).toFixed(specification.pricePrecision) : '-'}
          </small>
        </button>
      </div>

      {/* Order Type Selector */}
      <div className="order-type-selector" role="group" aria-label="Order Type">
        {(['MARKET', 'LIMIT', 'STOP'] as OrderType[]).map((ot) => (
          <button
            key={ot}
            type="button"
            className={`order-type-btn ${orderType === ot ? 'active' : ''}`}
            onClick={() => {
              setOrderType(ot);
              setErrorMessage(null);
            }}
          >
            {ot}
          </button>
        ))}
      </div>

      {/* Smart Risk % Position Calculator (FX Replay + SNRBD APK Style) */}
      <div className="order-risk-box">
        <div className="order-field-label-row" style={{ marginBottom: 4 }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 5, cursor: 'pointer', color: '#38bdf8', fontWeight: 700 }}>
            <input
              type="checkbox"
              checked={autoSizeByRisk}
              onChange={(e) => setAutoSizeByRisk(e.target.checked)}
            />
            <span>Auto Risk % Position Sizer</span>
          </label>
          <span style={{ color: '#f87171', fontWeight: 700 }}>-${riskDollarAmount.toFixed(2)}</span>
        </div>

        <div className="order-risk-presets">
          {RISK_PRESETS.map((rp) => (
            <button
              key={rp}
              type="button"
              className={`order-preset-chip ${parseFloat(riskPct) === rp ? 'active' : ''}`}
              onClick={() => {
                setRiskPct(rp.toString());
                setAutoSizeByRisk(true);
              }}
            >
              {rp}%
            </button>
          ))}
          <input
            type="number"
            step="0.1"
            min="0.1"
            max="20"
            value={riskPct}
            onChange={(e) => {
              setRiskPct(e.target.value);
              setAutoSizeByRisk(true);
            }}
            className="order-risk-mini-input"
            title="Custom Risk %"
          />
        </div>
      </div>

      {/* Form Fields */}
      <form onSubmit={handleSubmit} className="order-entry-form" noValidate>
        {/* Quantity Field */}
        <div className="order-field-group">
          <div className="order-field-label-row">
            <span>Lot / Qty ({specification.baseAsset}):</span>
            <span>Rec: {recommendedQty}</span>
          </div>
          <div className="order-input-wrapper">
            <input
              type="number"
              step={specification.quantityStep}
              min={specification.minQuantity}
              value={quantity}
              onChange={(e) => {
                setAutoSizeByRisk(false);
                setQuantity(e.target.value);
              }}
              className="order-input"
              required
            />
            <span className="order-input-unit">{specification.baseAsset}</span>
          </div>
        </div>

        {/* Requested Price (if Limit or Stop) */}
        {orderType !== 'MARKET' && (
          <div className="order-field-group">
            <div className="order-field-label-row">
              <span>{orderType === 'LIMIT' ? 'Limit Price' : 'Stop Price'}:</span>
              {onRequestChartPick && (
                <button
                  type="button"
                  className={`order-pick-btn ${chartPickTarget === 'ENTRY' ? 'active' : ''}`}
                  onClick={() => onRequestChartPick(chartPickTarget === 'ENTRY' ? 'NONE' : 'ENTRY')}
                >
                  🎯 Pick on Chart
                </button>
              )}
            </div>
            <div className="order-input-wrapper">
              <input
                type="number"
                step={specification.tickSize}
                value={requestedPrice}
                onChange={(e) => setRequestedPrice(e.target.value)}
                className="order-input"
                required
              />
              <span className="order-input-unit">{specification.quoteAsset}</span>
            </div>
          </div>
        )}

        {/* Stop Loss Field */}
        <div className="order-field-group">
          <div className="order-field-label-row">
            <label style={{ display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={enableSL}
                onChange={(e) => setEnableSL(e.target.checked)}
              />
              <span>Stop Loss (SL)</span>
            </label>
            {enableSL && onRequestChartPick && (
              <button
                type="button"
                className={`order-pick-btn ${chartPickTarget === 'SL' ? 'active' : ''}`}
                onClick={() => onRequestChartPick(chartPickTarget === 'SL' ? 'NONE' : 'SL')}
              >
                🎯 Pick SL
              </button>
            )}
          </div>
          {enableSL && (
            <div className="order-input-wrapper">
              <input
                type="number"
                step={specification.tickSize}
                value={stopLoss}
                onChange={(e) => setStopLoss(e.target.value)}
                placeholder={direction === 'BUY' ? 'Below entry' : 'Above entry'}
                className="order-input"
              />
              <span className="order-input-unit" style={{ color: '#f87171' }}>
                -${potentialLossUsd.toFixed(0)}
              </span>
            </div>
          )}
        </div>

        {/* Take Profit Field + Target RRR Presets */}
        <div className="order-field-group">
          <div className="order-field-label-row">
            <label style={{ display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={enableTP}
                onChange={(e) => setEnableTP(e.target.checked)}
              />
              <span>Take Profit (TP)</span>
            </label>
            {enableTP && onRequestChartPick && (
              <button
                type="button"
                className={`order-pick-btn ${chartPickTarget === 'TP' ? 'active' : ''}`}
                onClick={() => onRequestChartPick(chartPickTarget === 'TP' ? 'NONE' : 'TP')}
              >
                🎯 Pick TP
              </button>
            )}
          </div>
          {enableTP && (
            <>
              <div className="order-input-wrapper">
                <input
                  type="number"
                  step={specification.tickSize}
                  value={takeProfit}
                  onChange={(e) => setTakeProfit(e.target.value)}
                  placeholder={direction === 'BUY' ? 'Above entry' : 'Below entry'}
                  className="order-input"
                />
                <span className="order-input-unit" style={{ color: '#4ade80' }}>
                  +${potentialProfitUsd.toFixed(0)}
                </span>
              </div>
              {enableSL && numSL && (
                <div className="order-risk-presets" style={{ marginTop: 4 }}>
                  <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>Target R:R:</span>
                  {RRR_PRESETS.map((r) => (
                    <button
                      key={r}
                      type="button"
                      className="order-preset-chip"
                      onClick={() => handleApplyRrr(r)}
                    >
                      1:{r}
                    </button>
                  ))}
                </div>
              )}
            </>
          )}
        </div>

        {/* Order Calculations Summary */}
        <div className="order-info-card">
          <div className="order-info-row">
            <span>Execution Price:</span>
            <strong>{estimatedExecPrice.toFixed(specification.pricePrecision)}</strong>
          </div>
          <div className="order-info-row">
            <span>Required Margin:</span>
            <strong style={{ color: estimatedMargin > account.freeMargin ? '#f43f5e' : 'inherit' }}>
              ${estimatedMargin.toFixed(2)}
            </strong>
          </div>
          {liveRrr !== null && (
            <div className="order-info-row">
              <span>Setup R-Multiple:</span>
              <strong style={{ color: liveRrr >= 2 ? '#4ade80' : '#fbbf24' }}>
                1 : {liveRrr.toFixed(2)} R
              </strong>
            </div>
          )}
        </div>

        {/* SNRBD APK Style Drawdown Simulator Toggle */}
        <div className="order-drawdown-box">
          <button
            type="button"
            className="order-drawdown-toggle"
            onClick={() => setShowDrawdownSim(!showDrawdownSim)}
          >
            <span>⚡ Drawdown Simulator ({numRiskPct}% Risk)</span>
            <span>{showDrawdownSim ? '▲' : '▼'}</span>
          </button>
          {showDrawdownSim && (
            <div className="order-drawdown-grid">
              {[3, 5, 8, 10].map((streak) => {
                const remBalance = account.balance * Math.pow(1 - numRiskPct / 100, streak);
                const ddUsd = account.balance - remBalance;
                const ddPct = (ddUsd / account.balance) * 100;
                return (
                  <div key={streak} className="order-drawdown-item">
                    <span>{streak}L Streak</span>
                    <strong style={{ color: ddPct >= 8 ? '#f43f5e' : '#fbbf24' }}>
                      -{ddPct.toFixed(1)}% (-${ddUsd.toFixed(0)})
                    </strong>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Error message */}
        {errorMessage && <div className="order-unsupported-box">{errorMessage}</div>}

        {/* Submit Button */}
        {!specification.tradingSupported ? (
          <div className="order-unsupported-box">{specification.unsupportedReason}</div>
        ) : (
          <button
            type="submit"
            className={`order-submit-btn ${
              direction === 'BUY' ? 'order-submit-btn--buy' : 'order-submit-btn--sell'
            }`}
            disabled={estimatedMargin > account.freeMargin || currentPrice <= 0}
          >
            {orderType} {direction} ({quantity} {specification.baseAsset})
          </button>
        )}
      </form>
    </div>
  );
};
