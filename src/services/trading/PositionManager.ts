import { ExecutionCostModel } from './ExecutionCostModel';
import { PositionCalculator } from './PositionCalculator';
import { Position, PositionCloseReason, TradeRecord } from './TradingTypes';

export interface PositionCloseResult {
  updatedPosition: Position;
  realizedPnL: number;
  freedMargin: number;
  tradeRecord: TradeRecord;
  isFullClose: boolean;
}

export class PositionManager {
  /**
   * Closes an open position either partially or in full.
   */
  public static closePosition(
    position: Position,
    marketExitPrice: number,
    timestamp: number,
    reason: PositionCloseReason,
    quantityToClose?: number,
    contractSize: number = 1.0
  ): PositionCloseResult {
    // Action required to close is opposite of direction:
    // Long position closes via SELL, Short position closes via BUY
    const closeAction = position.direction === 'BUY' ? 'SELL' : 'BUY';
    const effectiveExitPrice = ExecutionCostModel.getExecutablePrice(
      closeAction,
      marketExitPrice,
      position.executionAssumptions
    );

    const isFullClose = !quantityToClose || quantityToClose >= position.quantity;
    const actualQtyToClose = isFullClose ? position.quantity : quantityToClose!;

    const realizedPnL = PositionCalculator.calculateRealizedPnL(
      position.direction,
      position.entryPrice,
      effectiveExitPrice,
      actualQtyToClose,
      contractSize
    );

    const tradeRecord: TradeRecord = {
      id: 'trade_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
      positionId: position.id,
      orderId: position.orderId,
      instrumentId: position.instrumentId,
      direction: position.direction,
      quantity: actualQtyToClose,
      entryPrice: position.entryPrice,
      exitPrice: effectiveExitPrice,
      entryTime: position.entryTimestamp,
      exitTime: timestamp,
      pnl: realizedPnL,
      exitReason: reason,
      isAmbiguous: position.isAmbiguous,
    };

    if (isFullClose) {
      const closedPos: Position = {
        ...position,
        status: 'CLOSED',
        quantity: 0,
        closePrice: effectiveExitPrice,
        closeTimestamp: timestamp,
        closeReason: reason,
        realizedPnL: Number((position.realizedPnL + realizedPnL).toFixed(2)),
        unrealizedPnL: 0,
      };

      return {
        updatedPosition: closedPos,
        realizedPnL,
        freedMargin: position.usedMargin,
        tradeRecord,
        isFullClose: true,
      };
    } else {
      // Partial close
      const remainingQty = Number((position.quantity - actualQtyToClose).toFixed(6));
      const marginFraction = remainingQty / position.initialQuantity;
      const originalMargin = position.usedMargin * (position.initialQuantity / position.quantity);
      const newMargin = Number((originalMargin * marginFraction).toFixed(2));
      const freedMargin = Number((position.usedMargin - newMargin).toFixed(2));

      const updatedPos: Position = {
        ...position,
        quantity: remainingQty,
        realizedPnL: Number((position.realizedPnL + realizedPnL).toFixed(2)),
        usedMargin: newMargin,
        unrealizedPnL: PositionCalculator.calculateUnrealizedPnL(
          position.direction,
          position.entryPrice,
          position.currentPrice,
          remainingQty,
          contractSize
        ),
      };

      return {
        updatedPosition: updatedPos,
        realizedPnL,
        freedMargin,
        tradeRecord,
        isFullClose: false,
      };
    }
  }

  /**
   * Revalues open positions given newly revealed market valuation price.
   */
  public static revaluePositions(
    positions: Position[],
    currentPrice: number,
    contractSize: number = 1.0
  ): Position[] {
    return positions.map((pos) => {
      if (pos.status !== 'OPEN') return pos;
      const unrealizedPnL = PositionCalculator.calculateUnrealizedPnL(
        pos.direction,
        pos.entryPrice,
        currentPrice,
        pos.quantity,
        contractSize
      );
      return {
        ...pos,
        currentPrice,
        unrealizedPnL,
      };
    });
  }
}
