import { OrderDirection } from './TradingTypes';

export class PositionCalculator {
  /**
   * Calculates unrealized (floating) profit/loss in USD for an open position.
   */
  public static calculateUnrealizedPnL(
    direction: OrderDirection,
    entryPrice: number,
    currentPrice: number,
    quantity: number,
    contractSize: number = 1.0
  ): number {
    if (quantity <= 0 || entryPrice <= 0 || currentPrice <= 0) return 0;

    let pnl = 0;
    if (direction === 'BUY') {
      pnl = (currentPrice - entryPrice) * quantity * contractSize;
    } else {
      pnl = (entryPrice - currentPrice) * quantity * contractSize;
    }

    return Number(pnl.toFixed(2));
  }

  /**
   * Calculates realized profit/loss in USD upon full or partial close.
   */
  public static calculateRealizedPnL(
    direction: OrderDirection,
    entryPrice: number,
    exitPrice: number,
    closedQuantity: number,
    contractSize: number = 1.0
  ): number {
    if (closedQuantity <= 0 || entryPrice <= 0 || exitPrice <= 0) return 0;

    let pnl = 0;
    if (direction === 'BUY') {
      pnl = (exitPrice - entryPrice) * closedQuantity * contractSize;
    } else {
      pnl = (entryPrice - exitPrice) * closedQuantity * contractSize;
    }

    return Number(pnl.toFixed(2));
  }

  /**
   * Calculates required margin in USD to hold a position with given leverage.
   */
  public static calculateRequiredMargin(
    quantity: number,
    price: number,
    leverage: number,
    contractSize: number = 1.0
  ): number {
    if (quantity <= 0 || price <= 0 || leverage <= 0) return 0;
    const notional = quantity * contractSize * price;
    return Number((notional / leverage).toFixed(2));
  }
}
