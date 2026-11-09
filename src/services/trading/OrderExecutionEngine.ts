import { ApiCandle } from '../marketDataApi';
import { ExecutionCostModel } from './ExecutionCostModel';
import { PositionCalculator } from './PositionCalculator';
import { Order, Position } from './TradingTypes';

export interface PendingOrderTriggerResult {
  triggeredFills: Array<{
    order: Order;
    position: Position;
    requiredMargin: number;
  }>;
  rejectedOrders: Array<{
    order: Order;
    reason: string;
  }>;
}

export class OrderExecutionEngine {
  /**
   * Executes an immediate Market Order using current permitted price.
   */
  public static executeMarketOrder(
    order: Order,
    marketPrice: number,
    timestamp: number,
    leverage: number,
    contractSize: number = 1.0
  ): { filledOrder: Order; position: Position } {
    const fillPrice = ExecutionCostModel.getExecutablePrice(
      order.direction,
      marketPrice,
      order.executionAssumptions
    );

    const filledOrder: Order = {
      ...order,
      status: 'FILLED',
      filledAt: timestamp,
      filledPrice: fillPrice,
    };

    const usedMargin = PositionCalculator.calculateRequiredMargin(
      order.quantity,
      fillPrice,
      leverage,
      contractSize
    );

    const position: Position = {
      id: 'pos_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
      orderId: order.id,
      sessionId: order.sessionId,
      instrumentId: order.instrumentId,
      direction: order.direction,
      quantity: order.quantity,
      initialQuantity: order.quantity,
      entryPrice: fillPrice,
      entryTimestamp: timestamp,
      currentPrice: fillPrice,
      stopLoss: order.stopLoss,
      takeProfit: order.takeProfit,
      status: 'OPEN',
      realizedPnL: 0,
      unrealizedPnL: 0,
      usedMargin,
      executionAssumptions: order.executionAssumptions,
    };

    return { filledOrder, position };
  }

  /**
   * Evaluates pending Limit and Stop orders against newly revealed historical M1 candle.
   * Enforces:
   * 1. Price improvement on favorable gaps for Limit orders.
   * 2. Actual market open on adverse gaps for Stop orders.
   * 3. Margin verification at fill time.
   */
  public static evaluatePendingOrders(
    pendingOrders: Order[],
    m1: ApiCandle,
    currentFreeMargin: number,
    leverage: number,
    contractSize: number = 1.0
  ): PendingOrderTriggerResult {
    const triggeredFills: PendingOrderTriggerResult['triggeredFills'] = [];
    const rejectedOrders: PendingOrderTriggerResult['rejectedOrders'] = [];
    let remainingFreeMargin = currentFreeMargin;

    for (const order of pendingOrders) {
      if (order.status !== 'PENDING') continue;

      let triggered = false;
      let rawFillPrice = order.requestedPrice;

      // 1. BUY LIMIT: triggers when price <= requested
      if (order.orderType === 'LIMIT' && order.direction === 'BUY') {
        if (m1.low <= order.requestedPrice) {
          triggered = true;
          // If opened lower than requested price, take favorable open price
          rawFillPrice = m1.open < order.requestedPrice ? m1.open : order.requestedPrice;
        }
      }
      // 2. SELL LIMIT: triggers when price >= requested
      else if (order.orderType === 'LIMIT' && order.direction === 'SELL') {
        if (m1.high >= order.requestedPrice) {
          triggered = true;
          // If opened higher than requested price, take favorable open price
          rawFillPrice = m1.open > order.requestedPrice ? m1.open : order.requestedPrice;
        }
      }
      // 3. BUY STOP: triggers when price >= requested
      else if (order.orderType === 'STOP' && order.direction === 'BUY') {
        if (m1.high >= order.requestedPrice) {
          triggered = true;
          // If opened higher than requested price, fill at market open (gap)
          rawFillPrice = m1.open > order.requestedPrice ? m1.open : order.requestedPrice;
        }
      }
      // 4. SELL STOP: triggers when price <= requested
      else if (order.orderType === 'STOP' && order.direction === 'SELL') {
        if (m1.low <= order.requestedPrice) {
          triggered = true;
          // If opened lower than requested price, fill at market open (gap)
          rawFillPrice = m1.open < order.requestedPrice ? m1.open : order.requestedPrice;
        }
      }

      if (triggered) {
        const fillPrice = ExecutionCostModel.getExecutablePrice(
          order.direction,
          rawFillPrice,
          order.executionAssumptions
        );

        const requiredMargin = PositionCalculator.calculateRequiredMargin(
          order.quantity,
          fillPrice,
          leverage,
          contractSize
        );

        // Margin check at fill time
        if (requiredMargin > remainingFreeMargin) {
          rejectedOrders.push({
            order: {
              ...order,
              status: 'REJECTED',
              rejectionReason: `Insufficient free margin ($${remainingFreeMargin.toFixed(2)}) at execution time. Required: $${requiredMargin.toFixed(2)}.`,
            },
            reason: `Insufficient free margin at execution time`,
          });
          continue;
        }

        remainingFreeMargin -= requiredMargin;

        const filledOrder: Order = {
          ...order,
          status: 'FILLED',
          filledAt: m1.timestamp,
          filledPrice: fillPrice,
        };

        const position: Position = {
          id: 'pos_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
          orderId: order.id,
          sessionId: order.sessionId,
          instrumentId: order.instrumentId,
          direction: order.direction,
          quantity: order.quantity,
          initialQuantity: order.quantity,
          entryPrice: fillPrice,
          entryTimestamp: m1.timestamp,
          currentPrice: fillPrice,
          stopLoss: order.stopLoss,
          takeProfit: order.takeProfit,
          status: 'OPEN',
          realizedPnL: 0,
          unrealizedPnL: 0,
          usedMargin: requiredMargin,
          executionAssumptions: order.executionAssumptions,
        };

        triggeredFills.push({
          order: filledOrder,
          position,
          requiredMargin,
        });
      }
    }

    return { triggeredFills, rejectedOrders };
  }
}
