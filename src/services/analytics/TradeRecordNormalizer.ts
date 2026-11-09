import type { Order, TradingState } from '../trading/TradingTypes';
import { NormalizedTrade, OpenPositionSnapshot } from './AnalyticsTypes';

export class TradeRecordNormalizer {
  /**
   * Normalizes closed trade records from TradingState, enforcing replay cursor bounds.
   * If replayCursor is provided, only trades with exitTime <= replayCursor are included.
   * Zero future data leakage is strictly guaranteed.
   */
  public static normalizeClosedTrades(
    state: TradingState,
    replayCursor?: number,
    contractSize: number = 1.0
  ): NormalizedTrade[] {
    const ordersMap = new Map<string, Order>();
    if (state.completedOrders) {
      for (const ord of state.completedOrders) {
        ordersMap.set(ord.id, ord);
      }
    }
    if (state.pendingOrders) {
      for (const ord of state.pendingOrders) {
        ordersMap.set(ord.id, ord);
      }
    }

    const eligibleRecords = state.tradeRecords.filter((tr) => {
      if (replayCursor !== undefined && tr.exitTime > replayCursor) {
        return false;
      }
      return true;
    });

    // Chronologically sort by exitTime ASC, tie-break by ID
    eligibleRecords.sort((a, b) => {
      if (a.exitTime !== b.exitTime) return a.exitTime - b.exitTime;
      return a.id.localeCompare(b.id);
    });

    return eligibleRecords.map((tr) => {
      const durationMs = Math.max(0, tr.exitTime - tr.entryTime);
      const totalCostBasis = tr.entryPrice * tr.quantity * contractSize;
      const returnPct = totalCostBasis > 0 ? (tr.pnl / totalCostBasis) * 100 : 0;

      // Extract initial risk and R-multiple if stop loss was defined
      let initialStopLoss: number | undefined;
      let initialRisk: number | undefined;
      let rMultiple: number | undefined;

      const order = ordersMap.get(tr.orderId);
      if (order && order.stopLoss && order.stopLoss > 0) {
        initialStopLoss = order.stopLoss;
        const priceDelta = Math.abs(tr.entryPrice - order.stopLoss);
        initialRisk = priceDelta * tr.quantity * contractSize;
        if (initialRisk > 0) {
          rMultiple = tr.pnl / initialRisk;
        }
      }

      return {
        id: tr.id,
        positionId: tr.positionId,
        orderId: tr.orderId,
        instrumentId: tr.instrumentId,
        direction: tr.direction,
        quantity: tr.quantity,
        entryPrice: tr.entryPrice,
        exitPrice: tr.exitPrice,
        entryTime: tr.entryTime,
        exitTime: tr.exitTime,
        durationMs,
        pnl: tr.pnl,
        returnPct,
        exitReason: tr.exitReason,
        isAmbiguous: tr.isAmbiguous,
        initialStopLoss,
        initialRisk,
        rMultiple,
      };
    });
  }

  /**
   * Filters and normalizes open positions, ensuring entryTimestamp <= replayCursor.
   */
  public static normalizeOpenPositions(
    state: TradingState,
    replayCursor?: number
  ): OpenPositionSnapshot[] {
    const eligiblePositions = state.positions.filter((p) => {
      if (replayCursor !== undefined && p.entryTimestamp > replayCursor) {
        return false;
      }
      return p.status === 'OPEN';
    });

    return eligiblePositions.map((p) => ({
      id: p.id,
      instrumentId: p.instrumentId,
      direction: p.direction,
      quantity: p.quantity,
      entryPrice: p.entryPrice,
      entryTimestamp: p.entryTimestamp,
      currentPrice: p.currentPrice,
      stopLoss: p.stopLoss,
      takeProfit: p.takeProfit,
      unrealizedPnL: p.unrealizedPnL,
      usedMargin: p.usedMargin,
    }));
  }
}
