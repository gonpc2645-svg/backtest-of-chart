import { Position, TradingAccount } from './TradingTypes';

export class AccountManager {
  public static createDefaultAccount(
    initialBalance: number = 10000,
    leverage: number = 100
  ): TradingAccount {
    return {
      currency: 'USD',
      initialBalance,
      balance: initialBalance,
      equity: initialBalance,
      usedMargin: 0,
      freeMargin: initialBalance,
      marginLevel: null,
      stopOutLevel: 50, // 50% Margin Level Stop-Out
      leverage,
      realizedPnL: 0,
      unrealizedPnL: 0,
      tradingMode: 'HEDGING',
      isLocked: false,
    };
  }

  /**
   * Recalculates equity, used margin, free margin and margin level based on current positions.
   */
  public static recalculate(
    account: TradingAccount,
    openPositions: Position[]
  ): TradingAccount {
    const activePositions = openPositions.filter((p) => p.status === 'OPEN');

    let totalUsedMargin = 0;
    let totalUnrealizedPnL = 0;

    for (const p of activePositions) {
      totalUsedMargin += p.usedMargin || 0;
      totalUnrealizedPnL += p.unrealizedPnL || 0;
    }

    totalUsedMargin = Number(totalUsedMargin.toFixed(2));
    totalUnrealizedPnL = Number(totalUnrealizedPnL.toFixed(2));

    const equity = Number((account.balance + totalUnrealizedPnL).toFixed(2));
    const freeMargin = Number((equity - totalUsedMargin).toFixed(2));
    const marginLevel =
      totalUsedMargin > 0
        ? Number(((equity / totalUsedMargin) * 100).toFixed(2))
        : null;

    return {
      ...account,
      equity,
      usedMargin: totalUsedMargin,
      freeMargin,
      marginLevel,
      unrealizedPnL: totalUnrealizedPnL,
      isLocked: account.isLocked || activePositions.length > 0,
    };
  }

  /**
   * Applies realized P/L to account balance upon position closing.
   */
  public static applyRealizedTrade(
    account: TradingAccount,
    realizedPnL: number,
    commission: number = 0
  ): TradingAccount {
    const balanceDelta = realizedPnL - commission;
    const newBalance = Number((account.balance + balanceDelta).toFixed(2));
    const newRealizedPnL = Number((account.realizedPnL + realizedPnL).toFixed(2));

    return {
      ...account,
      balance: newBalance,
      realizedPnL: newRealizedPnL,
      isLocked: true, // Account settings locked once first trade completes
    };
  }

  /**
   * Checks whether account equity has breached the Stop-Out threshold.
   * If breached, selects positions to close starting with the largest loss first.
   */
  public static evaluateStopOut(
    account: TradingAccount,
    openPositions: Position[]
  ): {
    triggered: boolean;
    positionsToLiquidate: Position[];
    currentMarginLevel: number;
  } {
    if (account.marginLevel === null || account.marginLevel > account.stopOutLevel) {
      return { triggered: false, positionsToLiquidate: [], currentMarginLevel: account.marginLevel || 100 };
    }

    // Stop-out condition met: marginLevel <= stopOutLevel (e.g. <= 50%)
    // Sort open positions by largest loss first (deterministic tie-breaking)
    const active = [...openPositions.filter((p) => p.status === 'OPEN')];
    active.sort((a, b) => {
      if (a.unrealizedPnL !== b.unrealizedPnL) {
        return a.unrealizedPnL - b.unrealizedPnL; // Ascending: largest negative loss first
      }
      return a.entryTimestamp - b.entryTimestamp; // Older position first on tie
    });

    const positionsToLiquidate: Position[] = [];
    let simulatedBalance = account.balance;
    let simulatedUsedMargin = account.usedMargin;
    let simulatedUnrealizedPnL = account.unrealizedPnL;

    for (const pos of active) {
      positionsToLiquidate.push(pos);
      simulatedBalance += pos.unrealizedPnL;
      simulatedUsedMargin -= pos.usedMargin;
      simulatedUnrealizedPnL -= pos.unrealizedPnL;

      const simulatedEquity = simulatedBalance + simulatedUnrealizedPnL;
      const simMarginLevel =
        simulatedUsedMargin > 0
          ? (simulatedEquity / simulatedUsedMargin) * 100
          : 999;

      // Stop once margin level recovers above stop-out threshold
      if (simMarginLevel > account.stopOutLevel) {
        break;
      }
    }

    return {
      triggered: true,
      positionsToLiquidate,
      currentMarginLevel: account.marginLevel,
    };
  }
}
