import { ExecutionAssumptions } from './TradingTypes';

export class ExecutionCostModel {
  public static readonly DEFAULT_ASSUMPTIONS: ExecutionAssumptions = {
    priceModel: 'LAST_PRICE',
    spreadPipsOrPts: 0,
    commissionPerLotOrUnit: 0,
    slippagePoints: 0,
    swapLong: 0,
    swapShort: 0,
  };

  /**
   * Computes the executable price applying declared spread and slippage models.
   * Long entry & Short close require Ask price.
   * Short entry & Long close require Bid price.
   */
  public static getExecutablePrice(
    action: 'BUY' | 'SELL',
    marketPrice: number,
    assumptions: ExecutionAssumptions = this.DEFAULT_ASSUMPTIONS
  ): number {
    const halfSpread = (assumptions.spreadPipsOrPts || 0) / 2;
    const slippage = assumptions.slippagePoints || 0;

    if (action === 'BUY') {
      // Buying costs half spread up + slippage
      return Number((marketPrice + halfSpread + slippage).toFixed(8));
    } else {
      // Selling receives half spread down - slippage
      return Number((marketPrice - halfSpread - slippage).toFixed(8));
    }
  }

  /**
   * Computes commission charged for opening/closing the position.
   */
  public static calculateCommission(
    quantity: number,
    assumptions: ExecutionAssumptions = this.DEFAULT_ASSUMPTIONS
  ): number {
    if (!assumptions.commissionPerLotOrUnit || assumptions.commissionPerLotOrUnit <= 0) {
      return 0;
    }
    return Number((quantity * assumptions.commissionPerLotOrUnit).toFixed(4));
  }
}
