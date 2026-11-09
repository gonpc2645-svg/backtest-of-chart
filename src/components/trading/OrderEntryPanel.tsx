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

interface OrderEntryPanelProps {
  specification: InstrumentSpecification;
  account: TradingAccount;
  currentPrice: number;
  executionAssumptions: ExecutionAssumptions;
  onSubmitOrder: (req: CreateOrderRequest) => { success: boolean; error?: string };
}

export const OrderEntryPanel: React.FC<OrderEntryPanelProps> = ({
  specification,
  account,
  currentPrice,
  executionAssumptions,
  onSubmitOrder,
}) => {
  const [direction, setDirection] = useState<OrderDirection>('BUY');
  const [orderType, setOrderType] = useState<OrderType>('MARKET');
  const [quantity, setQuantity] = useState<string>('0.1');
  const [requestedPrice, setRequestedPrice] = useState<string>('');
  const [enableSL, setEnableSL] = useState<boolean>(false);
  const [stopLoss, setStopLoss] = useState<string>('');
  const [enableTP, setEnableTP] = useState<boolean>(false);
  const [takeProfit, setTakeProfit] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Sync default requested price with current market price
  useEffect(() => {
    if (currentPrice > 0 && !requestedPrice) {
      setRequestedPrice(currentPrice.toString());
    }
  }, [currentPrice, requestedPrice]);

  const numQty = parseFloat(quantity) || 0;
  const numReqPrice = orderType === 'MARKET' ? currentPrice : parseFloat(requestedPrice) || currentPrice;
  const numSL = enableSL && parseFloat(stopLoss) > 0 ? parseFloat(stopLoss) : undefined;
  const numTP = enableTP && parseFloat(takeProfit) > 0 ? parseFloat(takeProfit) : undefined;

  // Estimated executable price
  const estimatedExecPrice = currentPrice > 0
    ? ExecutionCostModel.getExecutablePrice(direction, numReqPrice, executionAssumptions)
    : 0;

  // Estimated required margin
  const estimatedMargin = PositionCalculator.calculateRequiredMargin(
    numQty,
    estimatedExecPrice,
    account.leverage,
    specification.contractSize
  );

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
        <h3 className="order-entry-title">Order Entry</h3>
        <span className="badge-direction badge-direction--buy">
          {specification.provider} &bull; {specification.priceBasis}
        </span>
      </div>

      {/* Buy / Sell Direction Selector */}
      <div className="order-direction-tabs">
        <button
          type="button"
          className={`order-direction-btn order-direction-btn--buy ${direction === 'BUY' ? 'active' : ''}`}
          onClick={() => {
            setDirection('BUY');
            setErrorMessage(null);
          }}
        >
          <span>BUY / LONG</span>
          <small style={{ fontSize: '0.68rem', opacity: 0.85 }}>
            Ask: {currentPrice ? (currentPrice + executionAssumptions.spreadPipsOrPts / 2).toFixed(specification.pricePrecision) : '-'}
          </small>
        </button>
        <button
          type="button"
          className={`order-direction-btn order-direction-btn--sell ${direction === 'SELL' ? 'active' : ''}`}
          onClick={() => {
            setDirection('SELL');
            setErrorMessage(null);
          }}
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

      {/* Form Fields */}
      <form onSubmit={handleSubmit} className="order-entry-form" noValidate>
        {/* Quantity Field */}
        <div className="order-field-group">
          <div className="order-field-label-row">
            <span>Quantity ({specification.baseAsset}):</span>
            <span>Min: {specification.minQuantity}</span>
          </div>
          <div className="order-input-wrapper">
            <input
              type="number"
              step={specification.quantityStep}
              min={specification.minQuantity}
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
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
              <span>{orderType === 'LIMIT' ? 'Limit Price' : 'Stop Price'} ({specification.quoteAsset}):</span>
              <span>Tick: {specification.tickSize}</span>
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
              <span>Stop Loss</span>
            </label>
            {enableSL && <span>{direction === 'BUY' ? '< Entry' : '> Entry'}</span>}
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
              <span className="order-input-unit">{specification.quoteAsset}</span>
            </div>
          )}
        </div>

        {/* Take Profit Field */}
        <div className="order-field-group">
          <div className="order-field-label-row">
            <label style={{ display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={enableTP}
                onChange={(e) => setEnableTP(e.target.checked)}
              />
              <span>Take Profit</span>
            </label>
            {enableTP && <span>{direction === 'BUY' ? '> Entry' : '< Entry'}</span>}
          </div>
          {enableTP && (
            <div className="order-input-wrapper">
              <input
                type="number"
                step={specification.tickSize}
                value={takeProfit}
                onChange={(e) => setTakeProfit(e.target.value)}
                placeholder={direction === 'BUY' ? 'Above entry' : 'Below entry'}
                className="order-input"
              />
              <span className="order-input-unit">{specification.quoteAsset}</span>
            </div>
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
          <div className="order-info-row">
            <span>Execution Basis:</span>
            <span>{specification.priceBasis === 'LAST' ? 'Last Traded Price' : 'Bid / Ask'}</span>
          </div>
        </div>

        {/* Error message */}
        {errorMessage && (
          <div className="order-unsupported-box">
            {errorMessage}
          </div>
        )}

        {/* Submit Button */}
        {!specification.tradingSupported ? (
          <div className="order-unsupported-box">
            {specification.unsupportedReason}
          </div>
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
